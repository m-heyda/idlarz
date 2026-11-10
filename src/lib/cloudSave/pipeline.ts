/**
 * What the browser keeps, what the server keeps, and what the server decides.
 *
 * **The rule of the game.** The game needs an account (there is no guest mode). The browser holds the game state and runs the economy (income, purchases, the map, the farm, the merchant's prices, stat allocation, rebirth bookkeeping).
 * The server owns what is worth cheating for: when chests and monsters appear and where they stand, every kill and chest reward, every fight, the gem balance, the bag and worn gear, away-time pay, the XP ceiling and the Ember bound.
 * The server judges the browser's save by plausibility, not by replaying actions.
 *
 * **What the server guarantees (and what it cannot)**
 *
 * | Guarantee | How |
 * | --- | --- |
 * | Away time is server time | `now - max(ledger.anchor_at, last accepted save)` on the server clock; the client sends no duration |
 * | Value only comes from server answers | income while away, chest and kill rewards and gems are computed by the server; the grant ledger (`granted`) holds the lifetime totals, and the save verifier allows a gain only up to `income x time + what the server granted since the last save` |
 * | Rolls cannot be re-rolled or predicted | a reward is seeded by `HMAC(LOOT_SECRET, userId / run / kind / ordinal)` ({@link sealedRng}); the ordinal is consumed on the server, a repeated request with the same key replays the stored answer |
 * | Opening 5 chests in 5 seconds earns nothing extra | a chest opens only against a **ticket** the server minted from its own clock; no ticket, no reward. The same logic catches a forged gold jump in the next upload (`gold_jump`, `networth_exceeds`) |
 * | Gems are the server's | `player_ledger.gems` is the balance; an upload can never raise it (a larger number is flagged `gems_increase` and replaced by the ledger balance); a new account starts at the 1000 gift at most |
 * | Two browsers cannot both claim | every ledger write is a compare-and-swap on `ver` |
 *
 * **Who checks what**
 *
 * | Thing | Browser | Server |
 * | --- | --- | --- |
 * | Time | game time from `performance.now()`, a tick is clamped to 0...300 s, castle timers count tick time | away time is the server clock since the last save or claim; claims are idempotent and compare-and-swap |
 * | Clicks | only trusted clicks on the map pay; shared token buckets (burst 8, 5/s, long-run 1.5/s) | none needed: click income is bounded by the save checks |
 * | Merchant | buy rounds up, sell rounds down, shelf price is 5x the sell value; tests sweep every resource | none |
 * | Edited save text | `sanitizeSave` rejects impossible data and recomputes derived values | the cloud copy is rebuilt from the sanitized state; gold, XP and gems are checked against income and grants |
 * | XP and level | save floor (XP the owned tiles must have produced) | `xpModel.ts` clamps a save's XP to what bought tiles, play time and server payouts can explain; the browser takes the lower number (`applyServerXp`) |
 * | Chests, kills, gems | none: a chest opens only against a server ticket | sealed rolls, the ledger holds the gem balance, a save can never raise it |
 * | Monsters and fights | none: the browser only displays and asks | the server places monsters, runs every fight and pays the win; HP, mana and potions are the ledger's |
 * | Gold jumps / forged land | none | the flags of {@link FLAG_POLICY}, in **shadow mode**: stored, the save is accepted; flagged accounts are never ranked |
 * | Rebirth | needs castle >= 6 and 400 tiles (+50 per rebirth); points computed in the store; shop spending is checked by the point-conservation rule on every load | the ledger starts a new run (sealed rolls never repeat) |
 * | Settings in `localStorage` | cosmetic only | not stored |
 *
 * **Honest limits.** A cheater who stays inside the spending bound (about 3x honest progress) is not caught; flags only un-rank because enforcement is off. The save text is not signed; editing localStorage is easy and the server is what is trusted.
 * Gear and bag contents cannot be verified from a save, which is why the server owns them. Gems cannot be raised by a save; the first save of an existing player cannot be delta-checked.
 * Tile purchases, building costs, farm and castle upgrades are paid in the browser, not by the server. Monsters and chests are placed by the server ({@link placeTickets}). The level a kill is paid at is not claimed by the client:
 * it comes from the ticket's spawn level and age ({@link levelAtAge}). Enforcing the checks and server-run economy actions are planned (`docs/plan/ROADMAP.md`); the inventory is already the server's.
 *
 * @title The server's rule and the threat model
 * @category Saves & Server/Threat model
 * @order 1
 * @see acceptSave, FLAG_POLICY, ENFORCEMENT
 */
import { PLAYER_CLASSES, type PlayerClassId } from '@/config/playerClasses';
import { createHash } from 'node:crypto';
import { STARTING_GEMS } from '@/config/economy';
import { countSave, emptyStats, statsDue } from '@/lib/offline/stats';
import { emptyBank } from '@/lib/offline/tickets';
import { inventoryFromCore, rebirthInventory, stampInventory } from '@/lib/offline/inventory';
import { seedLedger, subtractTotals, type Ledger, type LedgerRepo } from '@/lib/offline/ledger';
import { SAVE_SCHEMA, decodeSave, packBody, sealWire, type SaveBody } from '@/lib/saveFormat';
import { checkNetWorth } from './netWorth';
import { summarize, type SaveSummary } from './summary';
import { settleXp } from './xpModel';
import { clampPrestige, settleEmbers } from './emberModel';
import { rebirthRecordOf, type RebirthRecord } from './rebirthHistory';
import type { PrestigeState } from '@/types/game';
import { calculateLevel, reconcileCharacter } from '@/utils/game/character';
import { restoreMerchantLevels, sameRunAs, trustedEconomy } from './trustedEconomy';
import { ENFORCEMENT, POISON_FLAGS, VERIFY, rejectedFlags, verifyTransition, type Enforcement, type SaveFlag, type Snapshot } from './verify';

/** Accepted saves are copied into the history when this long passed since the last copy (not every N revisions: event saves make the revision count race ahead of the clock), and when a flag appears that the previous save did not have. */
export const HISTORY_EVERY_MS = 30 * 60_000;
/** How many history copies are kept per player, and how many extra pinned ones. */
export const HISTORY_KEEP = 6;
export const PINNED_KEEP = 3;

type Headline = Pick<SaveSummary, 'rebirths' | 'level' | 'tilesOwned'>;

/**
 * True when a new save holds less than the one it replaces: fewer rebirths, or the same rebirths with a lower level or fewer tiles (a rebirth
 * resets level and tiles, so a higher rebirth count never counts). The replaced save is then pinned in the history, like a New Game's (`PINNED_KEEP`).
 *
 * @category Saves & Server/Accepting a save
 * @order 10
 */
export const losesProgress = (previous: Headline, next: Headline): boolean =>
	next.rebirths < previous.rebirths || (next.rebirths === previous.rebirths && (next.level < previous.level || next.tilesOwned < previous.tilesOwned));
/**
 * Saves from one player are accepted at most this often (an honest client sends every ~90 s).
 *
 * @category Saves & Server/Accepting a save
 * @order 6
 */
export const MIN_SAVE_INTERVAL_MS = 10_000;

/** The map: large, changes only when land is bought or built on. Stored apart so a save that did not change it never rewrites it. */
export interface WorldPart {
	hash: string;
	land: unknown;
	extra: unknown;
	tiles: number;
}

/**
 * One stored save. `core` is everything but the map (small); `world` is the map and is only present when it was asked for.
 * Everything else is derived by the server and lives in typed columns.
 */
export interface StoredSave {
	rev: number;
	schema: number;
	core: SaveBody;
	worldHash: string;
	world?: WorldPart;
	summary: SaveSummary;
	flags: SaveFlag[];
	auditRatio: number;
	freshStart: boolean;
	everFlagged: boolean;
	/** Saved through a non-production server (local dev, preview): never ranked, flags never count against the account. Sticky. */
	testAccount: boolean;
	serverSavedAt: number;
	createdAt: number;
	/** When the history last got a full copy of this player's game. */
	lastArchiveAt: number;
}

/** What the leaderboard row of an account holds (the display name comes from the profile, never from the save). */
export interface StatsRow {
	displayName: string;
	trusted: boolean;
}

/** Storage behind the pipeline; Supabase in the app, a Map in tests. */
export interface SaveRepo {
	/** The small row. With `world` the map comes along (needed to give a save back or to keep a copy, never to verify one). */
	load(userId: string, options?: { world?: boolean }): Promise<StoredSave | null>;
	/**
	 * Atomically: replace (or, with `baseRev` 0, create) the save if it is still at `baseRev`, store `world` when given,
	 * and update the leaderboard row. False when someone else got there first.
	 */
	commit(userId: string, baseRev: number, save: StoredSave, world: WorldPart | null, stats: StatsRow): Promise<boolean>;
	/** Keeps a copy of a full save (map included) and drops all but the newest `keep` unpinned ones. */
	archive(userId: string, save: StoredSave, keep: number): Promise<void>;
	/** Keeps a copy of a full save that ordinary trimming never drops (only the newest `keep` pinned ones stay). */
	pin(userId: string, save: StoredSave, keep: number): Promise<void>;
	/**
	 * Keeps a copy of a full save for good (the new chapter's archive, IDL-76): flagged `epoch_archive`, so neither the pinned nor the ordinary trimming ever drops it. Unlike `pin` it
	 * THROWS when the copy could not be stored, because the caller deletes the save right after. Optional: a store without it cannot run the new chapter reset.
	 */
	pinChapter?(userId: string, save: StoredSave): Promise<void>;
	/** Keeps the record of a rebirth (the Rebirths tab); recording the same rebirth twice changes nothing. Optional: a store without history just has none. */
	recordRebirth?(userId: string, record: RebirthRecord): Promise<void>;
	/** Deletes the player's save (the map and the leaderboard row go with it) and the record of their rebirths: a New Game. */
	remove?(userId: string): Promise<void>;
}

export type SaveOutcome =
	| {
			kind: 'ok';
			rev: number;
			serverSavedAt: number;
			flags: SaveFlag[];
			/** The authoritative gem balance (the ledger's), when there is one */ gems?: number;
			/** The XP the server kept, only when the save held more than it could have earned (the browser takes the lower number) */ xp?: number;
			/** The Embers and rebirths the server kept, only when the save held more than a rebirth could have paid (the browser takes them) */ prestige?: PrestigeState;
			/** Set when the server paid this save from the last trusted economy instead of the claimed one (IDL-167); the flags say why */ economy?: 'trusted';
			/** Set when this save replaced one that held more (a New Game, or a browser re-basing a game that is behind): that save was pinned in the history first */
			replaced?: { fromRev: number; level: number; tilesOwned: number; playSeconds: number };
	  }
	| { kind: 'conflict'; rev: number; serverSavedAt: number }
	/** Enforcement is on and the save raised a flag that refuses it: nothing was stored (the account keeps its last accepted save) */
	| { kind: 'rejected'; flags: SaveFlag[] }
	| { kind: 'invalid'; reason: string }
	| { kind: 'too_soon'; retryAfterMs: number };

const hashWorld = (land: unknown, extra: unknown): string =>
	createHash('sha256')
		.update(JSON.stringify([land, extra]))
		.digest('hex');

/** Splits a canonical save body into the small part and the map. */
export const splitBody = (body: SaveBody, tiles: number): { core: SaveBody; world: WorldPart } => {
	const { land, extra, ...core } = body;
	return { core, world: { hash: hashWorld(land, extra), land, extra, tiles } };
};

/** Puts a stored save back together as the text the client imports (the client migrates and sanitizes it again). */
export const storedToText = (stored: StoredSave): string => {
	if (!stored.world) throw new Error('the map was not loaded');
	return sealWire({ v: stored.schema, t: stored.serverSavedAt, s: { ...stored.core, land: stored.world.land, extra: stored.world.extra } });
};

/**
 * Accepts a save from a client that says it was based on revision `baseRev` (0 = this account has no save yet).
 *   - the text must decode (checksum, schema, `sanitizeSave`), otherwise `invalid`
 *   - a stale `baseRev` is a `conflict`: the player picks a side in the hub, nothing is overwritten silently
 *   - the stored copy is rebuilt from the sanitized state, and rates and headline numbers are computed here
 *   - the spending check and the transition from the previous save are verified; each flag has a decision in `FLAG_POLICY` (flag, clamp or reject; reject only while `ENFORCEMENT.enabled`, shadow mode otherwise)
 *   - the map is only written when it changed; every ~30 min (by the clock) and when a new flag appears a full copy goes to the history
 *
 * Accepting a save (`POST /api/save`):
 *
 * 1. The user id comes from the session cookie only; the body is capped at 600,000 bytes (`SAVE_BODY_MAX`); at most one accepted save per 10 s per account ({@link MIN_SAVE_INTERVAL_MS}).
 * 2. The text must decode (checksum, schema, `sanitizeSave`). The stored copy is rebuilt from the sanitized state; rates and headline numbers are computed on the server (`summarize` in `cloudSave/summary.ts`).
 * 3. `baseRev` must equal the stored `rev` (compare-and-swap) or the answer is `conflict`.
 * 4. The server's inventory (bag, gear, pity, auto-sell) is stamped over the upload before anything is derived (a rebirth wipes it once, a New Game takes the new game's).
 * 5. The checks of {@link verifyTransition} run, each producing a flag with a policy in {@link FLAG_POLICY}.
 *
 * History: a full copy goes to `save_history` every 30 minutes of the clock and when a new flag appears; 6 newest + 3 pinned per player (`HISTORY_EVERY_MS`, `HISTORY_KEEP`, `PINNED_KEEP`).
 * Test accounts: a save through a non-production server marks the account `test_account` (sticky); its flags never count and it is never ranked ({@link isNonProduction}).
 * Ranking eligibility (`trusted`): the first save was a young game (<= 900 s of play) and no poison flag was ever raised ({@link POISON_FLAGS}).
 *
 * @category Saves & Server/Accepting a save
 * @order 1
 */
export const acceptSave = async (
	repo: SaveRepo,
	userId: string,
	displayName: string,
	text: string,
	baseRev: number,
	nowMs: number,
	/** True when this server is not production (see environment.ts). The route decides; nothing from the request is involved. */
	nonProduction = false,
	/** The server's own record of the player (gems, spawn tickets, what it granted). Without it saves are checked as before; a ledger that cannot be read never blocks a save. */
	ledgers: LedgerRepo | null = null,
	/** Which flags refuse a save. Shadow mode (nothing refused) unless `ENFORCEMENT.enabled` is switched on; a parameter so tests can run both. */
	enforcement: Enforcement = ENFORCEMENT,
	/** The hero class of the account's profile row (the route reads it): it is stamped over the upload, because class passives pay on the server (IDL-70). Absent = the upload's own, as before. */
	playerClass?: PlayerClassId,
): Promise<SaveOutcome> => {
	const decoded = decodeSave(text);
	if (!decoded.ok) return { kind: 'invalid', reason: decoded.reason };
	let state = decoded.state;
	if (playerClass && PLAYER_CLASSES[playerClass]) state = { ...state, playerClass };

	const current = await repo.load(userId);
	if (current && current.rev !== baseRev) return { kind: 'conflict', rev: current.rev, serverSavedAt: current.serverSavedAt };
	if (!current && baseRev !== 0) return { kind: 'conflict', rev: 0, serverSavedAt: 0 };
	if (current && nowMs - current.serverSavedAt < MIN_SAVE_INTERVAL_MS) {
		return { kind: 'too_soon', retryAfterMs: MIN_SAVE_INTERVAL_MS - (nowMs - current.serverSavedAt) };
	}

	const previous: Snapshot | null = current ? { summary: current.summary, serverSavedAt: current.serverSavedAt } : null;

	/**
	 * The ledger knows what the server itself granted since the last save (income while away, chest and kill rewards), so a save may
	 * contain that on top of its income, and it holds the real gem balance: whatever the save claims is checked against it, then replaced.
	 */
	let ledger: Ledger | null = null;
	let ledgerUsable = false;
	if (ledgers) {
		try {
			ledger = await ledgers.load(userId);
			ledgerUsable = true;
		} catch {
			ledgerUsable = false;
		}
	}
	/**
	 * Embers and rebirths: a rebirth the server ran itself (`POST /api/rebirth`, recorded in the ledger's inventory) pays exactly the Embers it
	 * computed (IDL-102). One that did not go through it is bounded by what the previous save's castle and territory could have paid (IDL-166).
	 * Either way a save that holds more is clamped before anything is derived from it, and flagged `ember_jump`.
	 */
	const emberVerdict = settleEmbers(
		previous,
		{ rebirths: state.prestige.rebirths, legacyEarned: state.prestige.legacyEarned, playSeconds: state.playSeconds },
		ledger?.inv?.rebirth ?? null,
	);
	if (emberVerdict.clamped) state = { ...state, prestige: clampPrestige(state.prestige, emberVerdict) };
	const gemsClaimed = state.gems;
	/**
	 * The bag, the worn gear, the loot pity and the auto-sell filter are the ledger's: the stored copy carries the server's, whatever the upload
	 * held. A New Game (the same run's play time going back) starts them again from the new game's own; a ledger without them yet is seeded
	 * from this save. Everything below (the summary, the checks, the stored copy) is worked out from the stamped state.
	 */
	const newGame = !!(current && state.prestige.rebirths === current.summary.rebirths && state.playSeconds < current.summary.playSeconds - 1);
	// A rebirth wipes the gear and the bag: the server's inventory starts again from the starter kit, whatever the upload carried
	const rebirthed = !!(current && !newGame && state.prestige.rebirths > current.summary.rebirths);
	// ... unless the server already did it when it ran the rebirth (`/api/rebirth`): the wipe happens once, and what was picked up since stays
	const serverWiped = ledger?.inv?.rebirth?.to === state.prestige.rebirths;
	const inventory = ledger?.inv && rebirthed && !serverWiped ? rebirthInventory(ledger.inv, state.merchantUpgrades) : (ledger?.inv ?? null);
	if (inventory && !newGame) state = stampInventory(state, inventory);
	let summary = summarize(state);
	const grants = ledger ? subtractTotals(ledger.granted, ledger.grantedSeen) : undefined;
	/**
	 * XP is the server's to bound: a save that holds more than the tiles bought, the time played and what the server paid can explain is
	 * clamped to what they explain (and its attribute points to the level that XP gives), and the stored copy, the level on the ranking
	 * and everything the server derives (rates, rewards) are computed from that
	 */
	const claimed = summary;
	const xpVerdict = settleXp(previous, claimed, nowMs, grants);
	if (xpVerdict.clamped) {
		state = {
			...state,
			resources: { ...state.resources, xp: xpVerdict.xp },
			level: calculateLevel(xpVerdict.xp),
			characterStats: reconcileCharacter(state.characterStats, xpVerdict.xp),
		};
		summary = summarize(state);
	}
	summary.derived.xpBase = xpVerdict.base;
	const flags = verifyTransition(previous, claimed, nowMs, grants); // judged as the player sent it (the XP check flags a clamp)
	if (ledger && gemsClaimed > ledger.gems) flags.push('gems_increase');
	if (emberVerdict.clamped) flags.push('ember_jump');
	const worth = checkNetWorth(state, summary, ledger?.granted);
	if (worth.exceeds) flags.push('networth_exceeds');

	/**
	 * Enforcement (IDL-112): while it is on, a save that raised a `reject` flag is refused whole, before anything is stored, pinned or granted.
	 * Off by default (shadow mode); the decision per flag is `FLAG_POLICY`.
	 */
	const refused = rejectedFlags(flags, enforcement);
	if (refused.length) return { kind: 'rejected', flags: refused };

	/**
	 * Trusted economy (IDL-167, IDL-168): a castle level its timer never paid for, or land, buildings and merchant levels worth more than the game
	 * could have paid, are stored as claimed (the flag stays) but never paid: the merchant levels go back to the last trusted save's, and the rates
	 * and the castle the server pays from are that save's too
	 */
	const trusted = flags.includes('castle_jump') || worth.exceeds;
	if (trusted) {
		const baseline = sameRunAs(previous?.summary ?? null, summary) ? current : null;
		if (worth.exceeds && baseline)
			state = {
				...state,
				merchantUpgrades: restoreMerchantLevels(state.merchantUpgrades, baseline.core.merchantUpgrades as Record<string, number> | undefined),
			};
		const restored = summarize(state);
		restored.derived.xpBase = summary.derived.xpBase;
		summary = trustedEconomy(baseline?.summary ?? null, restored, worth.ratio, baseline ? Math.max(0, nowMs - baseline.serverSavedAt) / 1000 : 0);
	}
	const newRun = !!(ledger && current && (summary.rebirths > current.summary.rebirths || flags.includes('playtime_regress')));

	// Starting over (New Game), or a browser re-basing its game over an account save that is further along (client `resolveConflict`) must not
	// push the old game out of the history: pin the save that is about to be replaced
	const replacesFurther = !!current && (flags.includes('playtime_regress') || losesProgress(current.summary, summary));
	if (current && replacesFurther) {
		const old = await repo.load(userId, { world: true });
		if (old?.world && old.rev === current.rev) await repo.pin(userId, old, PINNED_KEEP);
	}

	// The gem balance is the server's: a save can never raise it (a new ledger starts at the save's gems, but never above the starting gift)
	const gems = ledgerUsable ? (ledger ? ledger.gems : Math.max(0, Math.min(summary.gems, STARTING_GEMS))) : summary.gems;
	summary.gems = gems;
	const split = splitBody(packBody(state), summary.tilesOwned);
	const core = ledgerUsable ? { ...split.core, gems } : split.core;
	const world = split.world;
	// A test account's findings are still recorded (they show the checks working) but never count against it, and it is never ranked
	const testAccount = (current?.testAccount ?? false) || nonProduction;
	const everFlagged = !testAccount && ((current?.everFlagged ?? false) || flags.some((flag) => POISON_FLAGS.has(flag)));
	const freshStart = current ? current.freshStart : summary.playSeconds <= VERIFY.freshStartSec;

	// A flag already on the previous save is not archived again: an account that stays flagged must not make us store a full copy every upload (test accounts only get the regular copies)
	const newFlag = !testAccount && flags.some((flag) => !(current?.flags ?? []).includes(flag));
	const archive = !current || nowMs - current.lastArchiveAt >= HISTORY_EVERY_MS || newFlag;

	const save: StoredSave = {
		rev: (current?.rev ?? 0) + 1,
		schema: SAVE_SCHEMA,
		core,
		worldHash: world.hash,
		summary,
		flags,
		auditRatio: Number.isFinite(worth.ratio) ? worth.ratio : 1e9,
		freshStart,
		everFlagged,
		testAccount,
		serverSavedAt: nowMs,
		createdAt: current?.createdAt ?? nowMs,
		lastArchiveAt: archive ? nowMs : (current?.lastArchiveAt ?? nowMs),
	};
	const worldChanged = !current || current.worldHash !== world.hash;
	const written = await repo.commit(userId, baseRev, save, worldChanged ? world : null, { displayName, trusted: !testAccount && freshStart && !everFlagged });
	if (!written) {
		const latest = await repo.load(userId);
		return { kind: 'conflict', rev: latest?.rev ?? 0, serverSavedAt: latest?.serverSavedAt ?? 0 };
	}

	if (archive) await repo.archive(userId, { ...save, world }, HISTORY_KEEP);

	// A higher rebirth count: the run that just ended goes into the rebirth history, from the save before this one (a failure here never
	// loses the save: the history is a log, not the game)
	if (current && repo.recordRebirth) {
		const record = rebirthRecordOf(current.summary, summary, nowMs);
		if (record) await repo.recordRebirth(userId, record).catch(() => undefined);
	}

	if (ledgers && ledgerUsable) {
		try {
			// lifetime counters (IDL-69): tiles bought and income earned, counted from this accepted save; a first save or a new run only sets the baselines
			const counted = countSave(ledger?.stats ?? emptyStats(), {
				nowMs,
				playSeconds: summary.playSeconds,
				tilesOwned: summary.tilesOwned,
				rates: previous ? (previous.summary.rates as unknown as Record<string, number>) : null,
				newRun: newRun || !current,
			});
			if (!ledger) {
				await ledgers.commit(userId, 0, { ...seedLedger(save, nowMs), ver: 1, stats: counted });
			} else if (!current) {
				// the first save of an account whose game was reset (a New Game, or a season reset): the timers start now, not at the reset,
				// so the time since the reset is neither "played" spawn time nor an absence; the bag and gear come from this save
				await ledgers.commit(userId, ledger.ver, {
					...ledger,
					ver: ledger.ver + 1,
					anchorAt: nowMs,
					bank: emptyBank(nowMs / 1000),
					ordChest: 0,
					ordKill: 0,
					grantedSeen: ledger.granted,
					lastKey: null,
					lastResult: null,
					combat: null,
					inv: inventoryFromCore(split.core),
					stats: counted,
				});
			} else if (newRun) {
				/**
				 * a rebirth or a new game: the map and its monsters start over, so do the tickets, and rolls start again from ordinal 1 in a new run
				 * (the player's combat starts over too: HP and mana come from the new game, no fight is open)
				 * (a rebirth wipes gear and bag, see `rebirthed`; a New Game takes the new game's own)
				 */
				const inv = newGame || !ledger.inv ? inventoryFromCore(split.core) : (inventory ?? ledger.inv);
				const next: Ledger = {
					...ledger,
					ver: ledger.ver + 1,
					runId: ledger.runId + 1,
					rebirths: summary.rebirths,
					anchorAt: nowMs,
					bank: emptyBank(nowMs / 1000),
					ordChest: 0,
					ordKill: 0,
					grantedSeen: ledger.granted,
					lastKey: null,
					lastResult: null,
					combat: null,
					inv,
					stats: counted,
				};
				await ledgers.commit(userId, ledger.ver, next);
			} else if ((grants && Object.values(grants).some((amount) => amount > 0)) || !ledger.inv) {
				// the save knows what was granted so far; a ledger from before the inventory moved here takes this save's
				await ledgers.commit(userId, ledger.ver, {
					...ledger,
					ver: ledger.ver + 1,
					grantedSeen: ledger.granted,
					inv: ledger.inv ?? inventoryFromCore(split.core),
					stats: counted,
				});
			} else if (statsDue(ledger.stats, nowMs)) {
				// nothing else to write: the counters are brought up to date at most every STATS_EVERY_MS
				await ledgers.commit(userId, ledger.ver, { ...ledger, ver: ledger.ver + 1, stats: counted });
			}
		} catch {
			// the save is stored; the next one brings the ledger up to date
		}
	}
	return {
		kind: 'ok',
		rev: save.rev,
		serverSavedAt: nowMs,
		flags,
		gems: ledgerUsable ? gems : undefined,
		xp: xpVerdict.clamped ? xpVerdict.xp : undefined,
		prestige: emberVerdict.clamped ? state.prestige : undefined,
		economy: trusted ? 'trusted' : undefined,
		replaced:
			replacesFurther && current
				? { fromRev: current.rev, level: current.summary.level, tilesOwned: current.summary.tilesOwned, playSeconds: current.summary.playSeconds }
				: undefined,
	};
};
