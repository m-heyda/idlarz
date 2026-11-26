import { PARAGON_ADD_MAX, PARAGON_IDS, PARAGON_UPGRADES, paragonEffect, paragonRoom, paragonUpgrade, type ParagonId } from '@/config/paragon';
import { isRecord } from '@/lib/isRecord';
import { calculateParagon } from '@/utils/game/character';

// The paragon points are the server's (the ledger's `paragon` column), like the attribute points (`attrs.ts`): the browser previews a point at once and asks the server for it; what is stored is only how many points the player put into each
// upgrade. The points still free are always worked out from the XP (`available = paragon level - spent`), so a curve change or a clamped XP never leaves a stale number behind.

/**
 * The server's record of the paragon points (ledger column `paragon`, null until the first request): the points in each upgrade, a version that moves with every change (the browser compares it), and whether the account's one free respec is used.
 *
 * @category Progression/Paragon
 * @order 2
 */
export interface Paragon {
	ver: number;
	spent: Partial<Record<ParagonId, number>>;
	freeUsed: boolean;
}

export const newParagon = (): Paragon => ({ ver: 1, spent: {}, freeUsed: false });

/** The points in all upgrades together */
export const paragonSpent = (spent: Partial<Record<ParagonId, number>>): number => PARAGON_IDS.reduce((sum, id) => sum + (spent[id] ?? 0), 0);

/** The points a character holds in all: one per paragon level worked out from the lifetime XP (the server's clamped XP, never an upload's) */
export const paragonBudget = (xp: number): number => calculateParagon(xp).paragon;

/** Points still free */
export const paragonFree = (xp: number, spent: Partial<Record<ParagonId, number>>): number => Math.max(0, paragonBudget(xp) - paragonSpent(spent));

/** Reads the stored column back: null for a missing column or anything that is not a record, otherwise a clean value (unknown ids dropped, negative or fractional points read as zero, a capped upgrade clamped to its cap). */
export const readParagon = (raw: unknown): Paragon | null => {
	if (!isRecord(raw) || !isRecord(raw.spent)) return null;
	const spent: Partial<Record<ParagonId, number>> = {};
	for (const u of PARAGON_UPGRADES) {
		const v = raw.spent[u.id];
		if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue;
		const n = Math.min(100000, Math.floor(v));
		spent[u.id] = u.capped ? Math.min(n, paragonRoom(u, 0)) : n;
	}
	const ver = typeof raw.ver === 'number' && Number.isFinite(raw.ver) && raw.ver >= 1 ? Math.floor(raw.ver) : 1;
	return { ver, spent, freeUsed: raw.freeUsed === true };
};

export type ParagonAllocateResult = { ok: true; paragon: Paragon } | { ok: false; reason: 'bad_request' | 'no_points' | 'capped' };

/**
 * Puts points into upgrades: `add` is how many per upgrade. Refused (nothing changes) when it is empty or malformed, when it would spend more than the paragon level has earned, or when it would take a capped upgrade past its cap.
 *
 * @category Progression/Paragon
 * @order 3
 */
export const allocateParagon = (paragon: Paragon, add: unknown, budget: number): ParagonAllocateResult => {
	if (!isRecord(add)) return { ok: false, reason: 'bad_request' };
	const spent = { ...paragon.spent };
	let total = 0;
	for (const [key, raw] of Object.entries(add)) {
		const u = paragonUpgrade(key);
		if (!u) return { ok: false, reason: 'bad_request' };
		if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > PARAGON_ADD_MAX) return { ok: false, reason: 'bad_request' };
		if (raw > paragonRoom(u, spent[u.id] ?? 0)) return { ok: false, reason: 'capped' };
		spent[u.id] = (spent[u.id] ?? 0) + raw;
		total += raw;
	}
	if (total === 0) return { ok: false, reason: 'bad_request' };
	if (paragonSpent(spent) > budget) return { ok: false, reason: 'no_points' };
	return { ok: true, paragon: { ...paragon, ver: paragon.ver + 1, spent } };
};

/** Gives every point back (the price is the caller's: free the first time, see `GEM_SHOP`). */
export const respecParagon = (paragon: Paragon): Paragon => ({ ver: paragon.ver + 1, spent: {}, freeUsed: true });

/** Cuts a record that holds more than the XP has earned (the XP was clamped lower): every point goes back. Returns the same object when it is within the budget. */
export const fitParagon = (paragon: Paragon, xp: number): Paragon =>
	paragonSpent(paragon.spent) <= paragonBudget(xp) ? paragon : { ver: paragon.ver + 1, spent: {}, freeUsed: paragon.freeUsed };

/** The numbers every consumer reads: each upgrade's effect for the points spent, in the upgrade's unit (0 when nothing is spent). */
export type ParagonBonuses = Record<ParagonId, number>;

export const NO_PARAGON_BONUS: ParagonBonuses = Object.fromEntries(PARAGON_IDS.map((id) => [id, 0])) as ParagonBonuses;

/**
 * What the points spent are worth, per upgrade, in the upgrade's unit: a capped upgrade `rate x points` up to its cap, an uncapped one `k x sqrt(points)`. The one function the browser and the server both read, so what the grid shows is what is paid.
 *
 * @category Progression/Paragon
 * @order 4
 */
export const paragonBonuses = (spent: Partial<Record<ParagonId, number>> | null | undefined): ParagonBonuses => {
	const out = { ...NO_PARAGON_BONUS };
	if (!spent) return out;
	for (const u of PARAGON_UPGRADES) out[u.id] = paragonEffect(u, spent[u.id] ?? 0);
	return out;
};
