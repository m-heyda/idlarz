// Stat audit helpers: a strict economy environment and independent oracles.
//
// The oracles below are written from the SPEC (docs and the audit plan), with every constant spelled out. They deliberately
// do not import the production formulas, so a wrong production number cannot hide behind a copy of itself.
import assert from 'node:assert/strict';
import { BASE_GENERATION_RATES } from '../../src/config/economy';
import { BIOMES } from '../../src/config/biomes';
import { CASTLE_UPGRADE, CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import { INITIAL_CHARACTER_STATS } from '../../src/config/character';
import { EMPTY_WORLD, setTiles, type World } from '../../src/utils/world';
import { calculateCombatStats } from '../../src/utils/game/character';
import type { CharacterStats, PrestigeState, Resources, Tile } from '../../src/types/game';

/** The flat base income of every resource in the strict environment. It is never raised: only modifiers may move a total. */
export const PINNED_BASE = 1000;

/**
 * Makes the base income exactly `base` per second for every resource and removes every other flat source: the castle's own
 * output, all biome output, the castle XP bonus. Call once at the top of a test file (each file is its own process).
 * Farms are never created in the strict environment, so they add nothing.
 */
export const pinEconomy = (base = PINNED_BASE) => {
	for (const key of Object.keys(BASE_GENERATION_RATES) as (keyof Resources)[]) BASE_GENERATION_RATES[key] = base;
	for (const biome of Object.values(BIOMES)) biome.resourceGeneration = {};
	CASTLE_UPGRADE.xpBonus = 0;
};

/** A map that is only the castle, at `level`. */
export const castleWorld = (level = 1): World => setTiles(EMPTY_WORLD, [{ x: CASTLE_X, y: CASTLE_Y, tile: { biome: 'castle', isOwned: true, level } as Tile }]);

/** The castle plus `n` extra owned tiles of `biome`, in a row (the tiles carry no output in the strict environment). */
export const worldWithTiles = (n: number, biome = 'plains', level = 1): World => {
	const changes: { x: number; y: number; tile: Tile }[] = [{ x: CASTLE_X, y: CASTLE_Y, tile: { biome: 'castle', isOwned: true, level } as Tile }];
	for (let i = 0; i < n; i++) {
		changes.push({ x: CASTLE_X + 1 + i, y: CASTLE_Y, tile: { biome, isOwned: true } as Tile });
	}
	return setTiles(EMPTY_WORLD, changes);
};

/** Character with the five base attributes set and every derived stat filled in the way the game does. */
export const character = (over: Partial<Pick<CharacterStats, 'strength' | 'dexterity' | 'intelligence' | 'vitality' | 'charisma'>> = {}): CharacterStats => {
	const s = { ...INITIAL_CHARACTER_STATS, ...over } as CharacterStats;
	return Object.assign(s, calculateCombatStats(s));
};

export const prestigeWith = (earned: number, upgrades: PrestigeState['upgrades'] = {}, rebirths = earned > 0 ? 1 : 0): PrestigeState => ({
	rebirths,
	legacyPoints: earned,
	legacyEarned: earned,
	upgrades,
});

/** Relative-tolerance equality (floating point), with a clear message. */
export const near = (actual: number, expected: number, what: string, rel = 1e-9) => {
	const tol = Math.max(Math.abs(expected) * rel, 1e-9);
	assert.ok(Math.abs(actual - expected) <= tol, `${what}: got ${actual}, expected ${expected}`);
};

// ---------------------------------------------------------------------------
// Oracles: the economy

export type Attr = 'strength' | 'dexterity' | 'intelligence' | 'vitality' | 'charisma';

export const oracle = {
	/** +20 % at level 1, doubling to level 6 (640 %), then +320 % per level (level 10 = 1920 %) */
	castle: (level: number) => (level <= 6 ? 0.2 * 2 ** (level - 1) : 0.2 * 2 ** 5 + 3.2 * (level - 6)),
	/** 2.5 % of the base per attribute point, on the resources each attribute feeds. The FULL attribute counts (not just points above 5). */
	stat: (resource: string, a: Record<Attr, number>) => {
		const p = 0.025;
		switch (resource) {
			case 'gold':
				return p * (a.intelligence + a.charisma);
			case 'wood':
				return p * (a.dexterity + a.vitality);
			case 'stone':
				return p * a.strength;
			case 'coal':
				return p * (a.strength + a.charisma);
			case 'food':
				return p * (a.dexterity + a.vitality);
			case 'xp':
				return 0.002 * a.intelligence + 0.0025 * a.charisma;
			default:
				return 0;
		}
	},
	/** 1 + 0.1 x (Embers ever earned)^0.6 */
	ember: (earned: number) => 1 + 0.1 * Math.max(0, earned) ** 0.6,
	foreman: (level: number) => 1 + 0.01 * level,
	gear: (pct: number) => 1 + pct / 100,
	plains: (count: number) => 0.05 * count,

	/** The whole modifier bracket: castle + plains + stat add inside one pair of brackets; Embers x Foreman x gear multiply it. */
	multiplier: (o: {
		resource: string;
		castleLevel: number;
		attrs: Record<Attr, number>;
		earned: number;
		foreman: number;
		gearPct: number;
		plainsCount?: number;
	}) => {
		const plains = o.resource === 'meat' ? oracle.plains(o.plainsCount ?? 0) : 0;
		const bracket = 1 + oracle.castle(o.castleLevel) + plains + oracle.stat(o.resource, o.attrs);
		const isXp = o.resource === 'xp';
		return bracket * oracle.ember(o.earned) * (isXp ? 1 : oracle.foreman(o.foreman)) * (isXp ? 1 : oracle.gear(o.gearPct));
	},

	/** Gold price of the next tile at `owned` economy tiles, before discounts. */
	tilePrice: (owned: number) => {
		const n = Math.min(owned, 300);
		let price = 55 * 1.13 ** Math.min(n, 15) * 1.07 ** Math.max(Math.min(n, 100) - 15, 0) * 1.007 ** Math.max(n - 100, 0);
		if (owned > 300) price *= (owned / 300) ** 3.5;
		return Math.floor(Math.min(price, 1e21 / 100));
	},
	/** Extra resource costs of a tile: [from tile, resource, share of the gold price] */
	tileResourceCost: [
		[15, 'wood', 0.3],
		[15, 'stone', 0.2],
		[30, 'coal', 0.2],
		[40, 'food', 0.1],
		[100, 'hide', 0.02],
	] as [number, string, number][],

	/** Embers for a rebirth */
	emberGain: (castle: number, tiles: number, rebirths: number, titheLevel: number) => {
		const needed = 400 + 50 * rebirths;
		const base = Math.floor(3 * Math.max(0, castle - 5) ** 1.3 * (Math.sqrt(Math.max(0, tiles) / 10) + 0.02 * Math.max(0, tiles - needed)));
		return Math.floor(base * (1 + 0.05 * titheLevel));
	},
	/** Cost in Embers of the next level of a shop upgrade */
	emberCost: (base: number, currentLevel: number) => Math.ceil(base * 1.4 ** currentLevel),
};

// ---------------------------------------------------------------------------
// Oracles: items and combat

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const round1 = (v: number) => Math.round(v * 10) / 10;
export const round2 = (v: number) => Math.round(v * 100) / 100;

export const combatOracle = {
	/** Points above the starting 5 */
	above: (v: number) => Math.max(0, v - 5),
	physicalPct: (str: number) => combatOracle.above(str) * 2,
	magicPct: (int: number) => combatOracle.above(int) * 2.4,
	attrArmor: (s: { dex: number; vit: number; str: number }) =>
		combatOracle.above(s.dex) * 0.5 + combatOracle.above(s.vit) * 0.5 + combatOracle.above(s.str) * 0.25,
	critDamagePct: (s: { str: number; dex: number; cha: number }) =>
		combatOracle.above(s.str) * 1 + combatOracle.above(s.dex) * 0.5 + combatOracle.above(s.cha) * 0.5,
	atkSpeedPct: (dex: number) => combatOracle.above(dex) * 0.25,
	attrMana: (int: number) => 20 + int * 4,
	attrManaRegen: (int: number) => 0.5 + int * 0.05,
	levelScale: (level: number) => 1 + 0.07 * (clamp(level, 1, 100) - 1),
	quality: (q: number) => 1 + ((clamp(q, 0, 100) - 50) / 50) * 0.08,
	/** Armor to damage reduction: a/(a+40), halved above 50 % (asymptote 75 %) */
	armorReduction: (armor: number) => {
		if (armor <= 0) return 0;
		const raw = armor / (armor + 40);
		return raw <= 0.5 ? raw : 0.5 + (raw - 0.5) * 0.5;
	},
};
