import type { GrantTotals } from '@/lib/offline/ledger';
import { calculateXpGain } from '@/utils/gameUtils';
import type { SaveSummary } from './summary';
import type { Snapshot } from './verify';

/**
 * The server's model of how much XP a character can have. XP is lifetime progress (it carries over a rebirth), and most of it comes from
 * buying tiles, which the browser does by itself. The server therefore adds up what two consecutive saves can explain, from numbers it
 * derives itself: the XP of the tiles bought in between (the same `calculateXpGain` the game uses), the passive XP of the play time (rates
 * x the time that really passed), and what the server itself paid (kills, chests, absences: the ledger's grants). That sum is kept
 * from save to save as `derived.xpBase`; a save that holds more than the base plus a one-off headroom is clamped to it (and flagged).
 *
 * Generous on purpose: an honest player is never clamped (the numbers include a margin for gifts and rounding), while XP out of thin air is
 * bounded by what the player has really bought and played.
 */
export const XP_MODEL = {
	/** Tile XP is exact; this is rounding and the XP bonus changing between saves. */
	tileSlack: 1.02,
	/** Passive XP (and the small gifts that come with play: critters) may be this much above rates x time. */
	passiveSlack: 1.25,
	/** Play time can not be longer than the real time between the saves (plus this slack and a grace). */
	playtimeSlack: 1.05,
	playtimeGraceSec: 30,
	/** One-off gains the model does not itemise (a gift, a lucky stretch) are allowed up to this many seconds of income, plus a floor. */
	headroomSec: 900,
	floor: 2000,
	/** The first save the server sees of an account holds the whole history, kills and chests of the time before the server paid them included. */
	firstSaveSlack: 3,
	/** A rebirth in between: the old run may have bought this many more tiles before it ended. */
	runEndTiles: 100,
} as const;

/** Tiles bought so far, as the XP formula counts them (the castle and the purchases): the saved figure, or what the map says for older rows. */
export const purchasedOf = (s: SaveSummary): number => Math.max(1, s.derived.purchased ?? s.tilesOwned - 8);

/** The XP of buying tiles number `from + 1` ... `to` (the n-th purchase gives `calculateXpGain(n)`), with the player's XP bonus. */
export const tileXp = (from: number, to: number, xpGainPct: number): number => {
	let sum = 0;
	for (let k = Math.max(1, from) + 1; k <= to; k++) sum += calculateXpGain(k);
	return sum * (1 + xpGainPct / 100);
};

const xpRate = (s: SaveSummary): number => s.rates.xp * (1 + s.xpGainPct / 100);

export interface XpVerdict {
	/** What the save holds, or the most it may hold when it asked for more */
	xp: number;
	/** True when the save held more than it could have earned: `xp` is the limit and the save was flagged */
	clamped: boolean;
	/** Kept in the stored summary (`derived.xpBase`) for the next save */
	base: number;
}

/**
 * Judges the XP of a new save against the previous one. `grants` is what the server paid since that save (the ledger), `nowMs` the
 * server's clock. With no previous save the whole history has to be explained at once, with a wide margin (`firstSaveSlack`).
 */
export const settleXp = (prev: Snapshot | null, next: SaveSummary, nowMs: number, grants?: GrantTotals): XpVerdict => {
	const headroom = xpRate(next) * XP_MODEL.headroomSec + XP_MODEL.floor;
	if (!prev) {
		const explained = tileXp(1, purchasedOf(next), next.xpGainPct) * XP_MODEL.tileSlack + xpRate(next) * Math.max(0, next.playSeconds) * XP_MODEL.passiveSlack;
		const limit = explained * XP_MODEL.firstSaveSlack + headroom;
		return next.xp > limit ? { xp: limit, clamped: true, base: limit } : { xp: next.xp, clamped: false, base: next.xp };
	}
	const before = prev.summary;
	const newRun = next.rebirths > before.rebirths;
	const elapsedSec = Math.max(0, (nowMs - prev.serverSavedAt) / 1000);
	const playedSec = Math.min(Math.max(0, next.playSeconds - before.playSeconds), elapsedSec * XP_MODEL.playtimeSlack + XP_MODEL.playtimeGraceSec);

	// the purchases in between: a rebirth starts the count again (the old run may have run on for a few more tiles first)
	const bought = newRun
		? tileXp(1, purchasedOf(next), next.xpGainPct) + tileXp(purchasedOf(before), purchasedOf(before) + XP_MODEL.runEndTiles, before.xpGainPct)
		: tileXp(purchasedOf(before), purchasedOf(next), next.xpGainPct);
	const rate = Math.max(xpRate(before), xpRate(next));
	const earned = bought * XP_MODEL.tileSlack + rate * playedSec * XP_MODEL.passiveSlack + (grants?.xp ?? 0);

	const base = (before.derived.xpBase ?? before.xp) + earned;
	const limit = base + headroom;
	// the credit never runs far ahead of the XP the player really has (loading an older save must not bank what was lost)
	const kept = (xp: number) => Math.min(base, xp + headroom);
	return next.xp > limit ? { xp: limit, clamped: true, base: kept(limit) } : { xp: next.xp, clamped: false, base: kept(next.xp) };
};
