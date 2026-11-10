// The castle: its position, base output, area, and the timed upgrade.
// Part of the former gameConfig.ts (split in IDL-15); the values are unchanged.
import { amounts } from '@/catalog/resourceKeys';

/**
 * Map. The map itself is unbounded (utils/world.ts): there is no grid size. The castle stays at its logical position, so
 * old saves and the procedural art (which hashes absolute coordinates) are unchanged.
 */
export const CASTLE_X = 25;
export const CASTLE_Y = 25;

// The castle's own per-second output (single source of truth: BIOMES.castle reads from it).
export const CASTLE_BASE_RATES = amounts({ gold: 0.1, wood: 0.05, stone: 0.1, food: 0.05, xp: 0.5 });

// Castle range: tiles within this many steps of the castle (3x3 at radius 1) will get the castle's range bonus. From
// `growFromLevel` the area (and the ward) grows by `growPerLevel` tiles on every side per level: 3x3 up to level 7, then 5x5, 7x7 and 9x9 at level 10.
/**
 * The castle range (violet area): radius 1 (3x3) up to level 7; from level 8 it grows one tile per level: 5x5 at 8, 7x7 at 9, 9x9 at 10 ({@link castleRangeRadius}).
 *
 * @category Economy/Castle
 * @order 4
 */
export const CASTLE_RANGE = { radius: 1, growFromLevel: 8, growPerLevel: 1 };

// Production bonus inside the castle range: below `fromLevel` every tile of the 3x3 range, and the building on
// it, produces `earlyBonus` extra (+50%, x1.5). From `fromLevel` it produces `perRadiusTile` times its output extra for every
// tile the range reaches out: +100% at radius 1 (level 7) up to +400% at radius 4 (level 10).
/**
 * Area bonus: tiles in range (and their buildings) make extra output, +50% below level 7; from level 7 it is +100% per tile of range radius: +100% (7), +200% (8), +300% (9), +400% (10)
 * ({@link castleAreaBonus}). It is part of the base income, so the modifiers apply on top.
 *
 * @category Economy/Castle
 * @order 5
 */
export const CASTLE_AREA_BONUS = { fromLevel: 7, perRadiusTile: 1, earlyBonus: 0.5 };

// From this castle level no monsters and no chests spawn inside the range area and monsters already there are driven out.
/**
 * The ward: from castle level 7 the whole range area around the castle (3x3 growing to 9x9 at level 10) is safe, no monsters or chests spawn there and monsters standing in it are driven out (`isInWard`, `wardTiles`).
 *
 * @category Economy/Castle
 * @order 6
 */
export const CASTLE_WARD = { fromLevel: 7 };

// Exponential castle upgrade system
/**
 * The castle: levels 1-10. An upgrade pays its cost up front, then runs a timer counted by the tick (saved, counted while away at full speed). One upgrade at a time.
 *
 * - **Modifier** added to every resource: see {@link castleModifier}. **Flat XP**: +0.5 xp/s per level above 1 (`xpBonus`).
 * - **Timers** (`durationsSec`), level 1 to 2 first: 30 min, 2 h, 6 h, 12 h, 24 h, 1.5 d, 2 d, 2.5 d, 3.5 d. Master Builders (Ember shop) cuts them 5% per level ({@link castleUpgradeDuration}).
 * - **Costs** per step (`upgradeCosts`): coal appears from 2 to 3, food and meat from 3 to 4. The full per-step table is in `docs/generated/balance-tables.md`.
 * - **Range** (violet area), **area bonus** and **ward**: {@link CASTLE_RANGE}, {@link CASTLE_AREA_BONUS}, {@link CASTLE_WARD}.
 *
 * @category Economy/Castle
 * @order 1
 * @table castle-levels
 * @see castleModifier, castleUpgradeDuration
 */
export const CASTLE_UPGRADE = {
	maxLevel: 10,
	baseResourceMultiplier: 0.2, // +20% to every resource at level 1
	doublingUntil: 6, // the bonus doubles with every level up to this level ...
	lateLevelStep: 3.2, // ... then grows linearly by this much per level (level 10 = +1920%)
	xpBonus: 0.5, // Additional flat XP/s for every castle level above 1
	// Real upgrade time in seconds, indexed by the level being left (1 -> 2 is index 0). Counted by the tick loop.
	// Halved in the 2026-11 balancing pass (was 1 h, 4 h, 12 h, 24 h, 48 h, 3 d, 4 d, 5 d, 7 d): 30 min, 2 h, 6 h, 12 h, 24 h, 1.5 d, 2 d, 2.5 d, 3.5 d
	durationsSec: [1800, 7200, 21600, 43200, 86400, 129600, 172800, 216000, 302400],
	upgradeCosts: [
		{ gold: 70000, wood: 10000, stone: 10000 },
		{ gold: 200000, wood: 30000, stone: 30000, coal: 20000 },
		{ gold: 1000000, wood: 100000, stone: 100000, coal: 50000, food: 200000, meat: 40000 },
		{ gold: 4000000, wood: 400000, stone: 400000, coal: 200000, food: 2000000, meat: 100000 },
		{ gold: 8000000, wood: 2000000, stone: 2000000, coal: 1000000, food: 4000000, meat: 500000 },
		{ gold: 30000000, wood: 3000000, stone: 3000000, coal: 1600000, food: 16000000, meat: 800000 },
		{ gold: 48000000, wood: 4800000, stone: 4800000, coal: 2600000, food: 25600000, meat: 1280000 },
		{ gold: 76800000, wood: 7600000, stone: 7600000, coal: 4000000, food: 41000000, meat: 2000000 },
		{ gold: 122800000, wood: 12200000, stone: 12200000, coal: 6600000, food: 65600000, meat: 3200000 },
	],
};
