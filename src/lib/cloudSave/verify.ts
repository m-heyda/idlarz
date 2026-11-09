import { MERCHANT_RESOURCE_PRICES } from '@/config/merchant';
import type { GrantTotals } from '@/lib/offline/ledger';
import type { Resources } from '@/types/game';
import type { SaveSummary } from './summary';
import { settleXp } from './xpModel';

/**
 * Plausibility checks between two consecutive saves of one player, run on the SERVER with the SERVER's clock, from the
 * summaries alone (no state is opened). Structural forgery (impossible items, points, tiles) is refused earlier by
 * `sanitizeSave`; "the land and balance are worth more than the game could have paid" is `netWorth.ts`.
 *
 * Shadow mode: nothing here rejects a save. Every finding becomes a flag stored next to the save, so the thresholds
 * can be tuned on real play before anything is enforced. Legitimate bursts exist (chests, kills, merchant sales,
 * rebirth), so gains get a generous allowance on top of what the income rates explain.
 */
export const VERIFY = {
	/** A save cannot hold more play time than real time passed (plus a little slack for clock rounding and tick batching). */
	playtimeSlack: 1.05,
	playtimeGraceSec: 30,
	/** Income that rates x play time explain is multiplied by this before a gain counts as suspicious. */
	gainSlack: 1.5,
	/** One-off gains (chests, loot, sales) are allowed up to this many seconds of current income, plus a floor. */
	burstSec: 900,
	/** Flat part of the gold allowance (IDL-167: it was 10,000 per save, up to ~2.9 million gold a day at the 5-minute heartbeat; the rest now grows with the account). */
	goldFloor: 1_000,
	/** The share of the previous balance a save may add on top (a rich account has bigger legitimate bursts, a poor one almost none). */
	goldFloorShare: 0.02,
	/** The best a maxed Haggler pays on a sale (+30 %): stock sold at the merchant is judged at this multiple of the base price. */
	sellBonusMax: 1.3,
	/** Relative slack on the comparison itself: past 2^53 a double cannot tell neighbouring balances apart (IDL-112). */
	relativeTolerance: 1e-9,
	/** Without a previous save the whole balance has to be explained by the current income over the play time. */
	baselineSlack: 3,
	baselineBurstSec: 3600,
	/** A first save with at most this much play time counts as a fresh start (ranking-eligible). */
	freshStartSec: 900,
	/** A castle upgrade's timer cannot run faster than real time (same slack as the play time). */
	castleSlack: 1.05,
	castleGraceSec: 30,
} as const;

export interface Snapshot {
	summary: SaveSummary;
	/** Server time when this save was accepted (ms). */
	serverSavedAt: number;
}

export type SaveFlag =
	| 'baseline_rich'
	| 'networth_exceeds'
	| 'playtime_regress'
	| 'playtime_fast'
	| 'gold_jump'
	| 'xp_jump'
	| 'gems_increase'
	| 'prestige_regress'
	| 'castle_jump'
	| 'ember_jump';

/**
 * What the server does when a flag fires (IDL-167, IDL-112), recorded in one place instead of scattered through the pipeline:
 *  - `flag`: accepted as sent, the account loses its ranking (`POISON_FLAGS`); nothing the server pays out depends on the claim.
 *  - `clamp`: accepted, but the server replaces the claimed number with the one it can explain (XP, Embers), or pays from the last trusted
 *    economy (`trustedEconomy.ts`: castle level, rates, merchant levels); the flag stays.
 *  - `reject`: the save is refused, but only while `ENFORCEMENT.enabled` is on (until then it behaves as `flag`).
 */
export type FlagDecision = 'flag' | 'clamp' | 'reject';

/**
 * The flags and what the server does with each. Meaning of each flag:
 *
 * - `baseline_rich`: the first save holds more gold than its rates and play time explain.
 * - `networth_exceeds`: land, buildings, castle, merchant levels, gold and stock worth more than income x time x 3 + 3,600 s of burst (`netWorth.ts`).
 * - `playtime_regress`: play time went back within a run. `playtime_fast`: more play time than real time passed (x1.05 + 30 s).
 * - `gold_jump`: gold gain above income x time x 1.5 + burst + 1,000 + 2% of the balance + server grants.
 * - `xp_jump`: XP above what bought tiles, play time and server payouts explain ({@link XP_MODEL}).
 * - `gems_increase`: gems above the server's balance. `prestige_regress`: rebirths or Embers earned went down.
 * - `castle_jump`: castle level or timer faster than real time. `ember_jump`: Embers above what the last save's castle and land can pay ({@link EMBER_MODEL}).
 *
 * **Rejection is switched off**: `ENFORCEMENT.enabled = false`. In this shadow mode flagged saves are stored and only the account's ranking eligibility suffers ({@link POISON_FLAGS}).
 * With it on, only `playtime_fast`, `gold_jump` and `gems_increase` refuse a save (HTTP 422).
 *
 * @category Saves & Server/Accepting a save
 * @order 2
 * @table flag-policy
 */
export const FLAG_POLICY: Readonly<Record<SaveFlag, FlagDecision>> = {
	baseline_rich: 'flag', // a first save holds a whole history (an imported or older game): nothing to compare with, so it cannot be refused
	networth_exceeds: 'clamp', // land, buildings, castle and merchant levels are paid from the last trusted rates, not the claimed ones
	playtime_regress: 'flag', // going back to an older save is the player's choice
	playtime_fast: 'reject', // more play time than real time passed: the clock is forged
	gold_jump: 'reject', // more gold than income, stock and the server's grants explain
	xp_jump: 'clamp',
	gems_increase: 'reject', // gems are the ledger's; a save that claims more is forged
	prestige_regress: 'flag', // a New Game or an older save
	castle_jump: 'clamp',
	ember_jump: 'clamp',
};

export interface Enforcement {
	enabled: boolean;
	reject: ReadonlySet<SaveFlag>;
}

/**
 * The kill switch and the allowlist for enforcement (IDL-112). Shadow mode is the default: nothing is refused until the flags of real
 * accounts have been read (`check-live-saves`), no honest account is among them, and someone flips `enabled`. Only flags that are `reject`
 * in `FLAG_POLICY` AND listed here refuse a save, so one noisy check can be taken out without touching the others.
 *
 * @category Saves & Server/Accepting a save
 * @order 10
 */
export const ENFORCEMENT: Enforcement = {
	enabled: false,
	reject: new Set<SaveFlag>(['playtime_fast', 'gold_jump', 'gems_increase']),
};

/** The flags that make this save refused under the given enforcement (none while it is off). */
export const rejectedFlags = (flags: readonly SaveFlag[], enforcement: Enforcement = ENFORCEMENT): SaveFlag[] =>
	enforcement.enabled ? flags.filter((flag) => FLAG_POLICY[flag] === 'reject' && enforcement.reject.has(flag)) : [];

/**
 * Flags that make an account ineligible for rankings for good. Going back in time is a player choice (older save), not a cheat.
 *
 * @category Saves & Server/Accepting a save
 * @order 9
 */
export const POISON_FLAGS: ReadonlySet<SaveFlag> = new Set<SaveFlag>([
	'baseline_rich',
	'networth_exceeds',
	'playtime_fast',
	'gold_jump',
	'xp_jump',
	'gems_increase',
	'prestige_regress',
	'castle_jump',
	'ember_jump',
]);

/**
 * `grants`: what the server itself handed out since the previous save (income while away, chest and kill rewards): a save may
 * contain that much more than its income explains. When it is given the server also holds the gem balance, so the gem check
 * happens against that balance in the pipeline instead of here.
 */
/**
 * The castle upgrade is a timer the server can check from two summaries: it runs at most as fast as real time. So a new castle level is
 * only believable when an upgrade was running and the real time between the saves covers what was left of its timer, and a running timer
 * cannot have lost more seconds than passed. (Setting `remainingSec` to 0 in a save, or a level the timer never paid for, is a jump.)
 */
const castleJumped = (before: SaveSummary, next: SaveSummary, elapsedSec: number): boolean => {
	const allowed = elapsedSec * VERIFY.castleSlack + VERIFY.castleGraceSec;
	const was = before.derived.castleUpgrade;
	const now = next.derived.castleUpgrade;
	if (next.castleLevel > before.castleLevel) {
		// every level needs its own upgrade: more than one level between two saves, or a level with no running upgrade behind it, is a jump
		return next.castleLevel > before.castleLevel + 1 || !was || was.toLevel !== next.castleLevel || was.remainingSec > allowed;
	}
	// still the same level: a timer that carries on must not have run faster than the clock
	return !!was && !!now && was.toLevel === now.toLevel && was.remainingSec - now.remainingSec > allowed;
};

/** Gold-equivalent income per second: gold plus every sellable resource at the merchant's best price (stock sold is gold gained). */
const goldWorthRate = (summary: SaveSummary): number => {
	let perSec = summary.rates.gold;
	for (const [key, price] of Object.entries(MERCHANT_RESOURCE_PRICES) as [keyof Resources, number][])
		perSec += (summary.rates[key] ?? 0) * price * VERIFY.sellBonusMax;
	return perSec;
};

/**
 * Runs every plausibility check between two consecutive saves and returns the flags that fired; see {@link FLAG_POLICY} for what each one means and does.
 *
 * @category Saves & Server/Accepting a save
 * @order 7
 */
export const verifyTransition = (prev: Snapshot | null, next: SaveSummary, nowMs: number, grants?: GrantTotals): SaveFlag[] => {
	const flags = new Set<SaveFlag>();

	if (!prev) {
		// First save of this account (often an existing player's whole history): can only be sanity checked
		const rate = next.rates.gold;
		const explained = rate * next.playSeconds * VERIFY.baselineSlack + rate * VERIFY.baselineBurstSec + VERIFY.goldFloor;
		if (next.gold > explained) flags.add('baseline_rich');
		if (settleXp(null, next, nowMs, grants).clamped) flags.add('xp_jump');
		return [...flags];
	}

	const before = prev.summary;
	const elapsedSec = Math.max(0, (nowMs - prev.serverSavedAt) / 1000);
	const playedSec = next.playSeconds - before.playSeconds;
	const sameRun = next.rebirths === before.rebirths;

	if (sameRun && playedSec < -1) flags.add('playtime_regress');
	if (playedSec > elapsedSec * VERIFY.playtimeSlack + VERIFY.playtimeGraceSec) flags.add('playtime_fast');

	if (next.rebirths < before.rebirths || next.legacyEarned < before.legacyEarned) flags.add('prestige_regress');
	if (!grants && next.gems > before.gems) flags.add('gems_increase'); // without a ledger gems have no source in the game

	if (sameRun && castleJumped(before, next, elapsedSec)) flags.add('castle_jump');

	if (sameRun) {
		const played = Math.max(0, playedSec);
		const rate = Math.max(goldWorthRate(before), goldWorthRate(next));
		/**
		 * What may have been added to the balance since the previous save: income over the time played; selling the stock the previous save held
		 * (it was earned before, so it is no burst of the income); a burst bounded by the time that REALLY passed, not a flat amount per upload;
		 * a floor that grows with the balance; and what the server itself granted. A row from before the stock was recorded keeps the old burst.
		 */
		const stock = before.derived.stockWorth;
		const burst = stock === undefined ? rate * VERIFY.burstSec : stock + rate * Math.min(VERIFY.burstSec, elapsedSec);
		const floor = VERIFY.goldFloor + VERIFY.goldFloorShare * Math.max(0, before.gold);
		const tolerance = VERIFY.relativeTolerance * Math.max(Math.abs(next.gold), Math.abs(before.gold));
		const goldAllowed = rate * played * VERIFY.gainSlack + burst + floor + tolerance + (grants?.gold ?? 0);
		if (next.gold - before.gold > goldAllowed) flags.add('gold_jump');
	}

	// XP is lifetime progress (it carries over a rebirth) and is judged by the server's model of it: see xpModel.ts
	if (settleXp(prev, next, nowMs, grants).clamped) flags.add('xp_jump');

	return [...flags];
};
