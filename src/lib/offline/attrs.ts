import { INITIAL_CHARACTER_STATS } from '@/config/character';
import { isRecord } from '@/lib/isRecord';
import type { CharacterStats } from '@/types/game';
import { calculateCombatStats, calculateLevel, totalStatPoints } from '@/utils/game/character';

// The attribute points are the server's (the ledger's `attrs` column): the browser previews a point at once and asks the server for it, the save pipeline puts the ledger's allocation over whatever an upload claims, and a respec is an operation
// the server charges for. What is stored is only how many points the player put into each attribute above the start value; the points still free are always worked out from the level (`availablePoints = budget - spent`).

export const ATTR_KEYS = ['strength', 'dexterity', 'intelligence', 'vitality', 'charisma'] as const;
export type AttrKey = (typeof ATTR_KEYS)[number];

/** The most points one request may add to one attribute (a sanity bound on the body; the budget is the real limit). */
const ADD_MAX = 1000;

/**
 * The server's record of the attribute allocation (ledger column `attrs`, null until the first request after the deploy seeds it from the stored save): the points put into each attribute above the start value, a version that moves with every change
 * (the browser compares it), and whether the account's one free respec is used.
 */
export interface Attrs {
	ver: number;
	alloc: Record<AttrKey, number>;
	freeUsed: boolean;
}

export const emptyAlloc = (): Record<AttrKey, number> => ({ strength: 0, dexterity: 0, intelligence: 0, vitality: 0, charisma: 0 });

export const newAttrs = (): Attrs => ({ ver: 1, alloc: emptyAlloc(), freeUsed: false });

export const spentOf = (alloc: Record<AttrKey, number>): number => ATTR_KEYS.reduce((sum, key) => sum + alloc[key], 0);

/**
 * How many attribute points a character holds in all: what its level has earned (`totalStatPoints`), plus a term per rebirth that is 0 today (the +20 pool of IDL-100 goes here, in the one place the budget is worked out).
 *
 * @category Progression/Levels
 * @order 4
 * @formula
 * attributeBudget(level, rebirths) = totalStatPoints(level) + 0 x rebirths
 * @see totalStatPoints
 */
export const attributeBudget = (level: number, rebirths = 0): number => totalStatPoints(level) + Math.max(0, Math.floor(rebirths)) * 0;

/** Reads the stored column back: null for a missing column or anything that is not an allocation (the first request seeds it), otherwise a clean value (negative or fractional points read as zero). */
export const readAttrs = (raw: unknown): Attrs | null => {
	if (!isRecord(raw) || !isRecord(raw.alloc)) return null;
	const alloc = emptyAlloc();
	for (const key of ATTR_KEYS) {
		const v = raw.alloc[key];
		alloc[key] = typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(100000, Math.floor(v)) : 0;
	}
	const ver = typeof raw.ver === 'number' && Number.isFinite(raw.ver) && raw.ver >= 1 ? Math.floor(raw.ver) : 1;
	return { ver, alloc, freeUsed: raw.freeUsed === true };
};

/** The stored column's value: an unseeded or never-touched allocation is stored as null. */
export const attrsToJson = (attrs: Attrs | null): Attrs | null => attrs;

/** The allocation a stored save holds (its attributes above the start value): how an account that predates the column is seeded, so everyone keeps what they have. */
export const attrsFromCore = (core: Record<string, unknown>): Attrs => {
	const saved = isRecord(core.characterStats) ? core.characterStats : {};
	const alloc = emptyAlloc();
	for (const key of ATTR_KEYS) {
		const v = saved[key];
		alloc[key] = typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100000, Math.floor(v - INITIAL_CHARACTER_STATS[key]))) : 0;
	}
	return { ver: 1, alloc, freeUsed: false };
};

/** The character's level worked out from the XP a stored save holds (a save does not store the level). */
export const levelOfXp = (xp: unknown): number => (typeof xp === 'number' && Number.isFinite(xp) && xp > 0 ? calculateLevel(xp).level : 1);

/** The attributes of a save with the ledger's allocation in place: the five base values, and the points still free for `level`. Everything else in the record is kept. */
export const coreWithAttrs = <T extends Record<string, unknown>>(core: T, attrs: Attrs | null, level: number, rebirths = 0): T => {
	if (!attrs) return core;
	const saved = isRecord(core.characterStats) ? core.characterStats : {};
	const next: Record<string, unknown> = { ...saved };
	for (const key of ATTR_KEYS) next[key] = INITIAL_CHARACTER_STATS[key] + attrs.alloc[key];
	next.availablePoints = Math.max(0, attributeBudget(level, rebirths) - spentOf(attrs.alloc));
	return { ...core, characterStats: next };
};

/** The same for a decoded game state (the save pipeline): the five attributes from the ledger, the free points from the level, every derived number worked out again. */
export const stateWithAttrs = <S extends { characterStats: CharacterStats }>(state: S, attrs: Attrs, level: number, rebirths = 0): S => {
	const stats: CharacterStats = { ...state.characterStats };
	for (const key of ATTR_KEYS) stats[key] = INITIAL_CHARACTER_STATS[key] + attrs.alloc[key];
	stats.availablePoints = Math.max(0, attributeBudget(level, rebirths) - spentOf(attrs.alloc));
	Object.assign(stats, calculateCombatStats(stats));
	return { ...state, characterStats: stats };
};

/** A new run (a rebirth, a New Game) gives every point back: the allocation starts again, the free respec stays as it was. */
export const clearedAttrs = (attrs: Attrs | null): Attrs => ({ ver: (attrs?.ver ?? 0) + 1, alloc: emptyAlloc(), freeUsed: attrs?.freeUsed ?? false });

/**
 * Cuts an allocation that holds more than the level has earned (the XP was clamped lower, a curve change): every point goes back, as the old repair did. Returns the same object when it is within the budget.
 */
export const fitAttrs = (attrs: Attrs, level: number, rebirths = 0): Attrs =>
	spentOf(attrs.alloc) <= attributeBudget(level, rebirths) ? attrs : clearedAttrs(attrs);

export type AllocateResult = { ok: true; attrs: Attrs } | { ok: false; reason: 'bad_request' | 'no_points' };

/**
 * Puts points into attributes: `add` is how many per attribute. Refused (nothing changes) when it is empty or malformed, or when it would spend more than the level's budget holds.
 *
 * @category Progression/Levels
 * @order 5
 */
export const allocatePoints = (attrs: Attrs, add: unknown, budget: number): AllocateResult => {
	if (!isRecord(add)) return { ok: false, reason: 'bad_request' };
	const alloc = { ...attrs.alloc };
	let total = 0;
	for (const [key, raw] of Object.entries(add)) {
		if (!(ATTR_KEYS as readonly string[]).includes(key)) return { ok: false, reason: 'bad_request' };
		if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > ADD_MAX) return { ok: false, reason: 'bad_request' };
		alloc[key as AttrKey] += raw;
		total += raw;
	}
	if (total === 0) return { ok: false, reason: 'bad_request' };
	if (spentOf(alloc) > budget) return { ok: false, reason: 'no_points' };
	return { ok: true, attrs: { ...attrs, ver: attrs.ver + 1, alloc } };
};

/** Gives every point back (the price is the caller's: free the first time, see `GEM_SHOP`). */
export const respecAttrs = (attrs: Attrs): Attrs => ({ ver: attrs.ver + 1, alloc: emptyAlloc(), freeUsed: true });
