import { CHEST, LUCK } from '@/config/spawns';
import type { Rng } from '@/lib/rng';

// What Luck does beyond the gold multipliers in chests.ts / loot/kill.ts. Pure; the server and the Character window use the same numbers.

const points = (luck: number): number => (Number.isFinite(luck) ? Math.max(0, luck) : 0);

/**
 * How much of its base time every spawn timer needs at this Luck (chests, rocks, monsters and bosses share it): Luck shortens it, never below `LUCK.spawnIntervalFloor`.
 *
 * @category Economy/Chests and Luck
 * @order 3
 * @formula
 * factor = max(0.5, 1 / (1 + 0.006 x Luck))
 */
export const spawnIntervalFactor = (luck: number): number => Math.max(LUCK.spawnIntervalFloor, 1 / (1 + points(luck) * LUCK.spawnSpeedPerPoint));

/**
 * Seconds between two chests: the base interval times {@link spawnIntervalFactor}, then the class and idol chest speed.
 *
 * @category Economy/Chests and Luck
 * @order 4
 * @formula
 * interval = 720 x max(0.5, 1 / (1 + 0.006 x Luck)) / (1 + class chest speed% / 100)
 */
export const chestIntervalSec = (luck: number, classChestSpeedPct = 0): number =>
	(CHEST.intervalSec * spawnIntervalFactor(luck)) / (1 + Math.max(0, classChestSpeedPct) / 100);

/** % more chests than at Luck 0 (what the Character window shows), the Ranger's chest speed included. */
export const chestRateBonusPct = (luck: number, classChestSpeedPct = 0): number => (CHEST.intervalSec / chestIntervalSec(luck, classChestSpeedPct) - 1) * 100;

/**
 * What the weight of every rarity above Common/Uncommon is multiplied by (the roll is normalised afterwards, so it moves odds toward rare gear).
 *
 * @category Economy/Chests and Luck
 * @order 8
 * @formula
 * multiplier = min(1.6, 1 + 0.004 x Luck)             applies to the weights of rare and better
 */
export const rarityLuckMultiplier = (luck: number): number => Math.min(LUCK.rarityCap, 1 + points(luck) * LUCK.rarityPerPoint);

/**
 * Multiplier on a monster's gear drop chance.
 *
 * @category Economy/Chests and Luck
 * @order 9
 * @formula
 * multiplier = 1 + 0.002 x Luck
 */
export const dropChanceMultiplier = (luck: number): number => 1 + points(luck) * LUCK.dropChancePerPoint;

/**
 * Chance (0-1) that a chest also holds gems.
 *
 * @category Economy/Chests and Luck
 * @order 7
 * @formula
 * gem chance = min(15%, 3% + 0.06% x Luck)             amount 5-50, skewed to the low end
 */
export const gemChance = (luck: number): number => Math.min(LUCK.gem.cap, LUCK.gem.base + points(luck) * LUCK.gem.perPoint);

/** How many gems a gem find holds: LUCK.gem.min..max, skewed toward the low end. */
export const rollGemAmount = (rng: Rng): number => {
	const { min, max } = LUCK.gem;
	const u = rng();
	return Math.min(max, min + Math.floor((max - min + 1) * u * u));
};

/**
 * Chance (0-1) that a newly arrived rat is a lucky one.
 *
 * @category Economy/Chests and Luck
 * @order 10
 * @formula
 * golden monster chance = min(10%, 2% + 0.05% x Luck)
 */
export const goldenMonsterChance = (luck: number): number =>
	Math.min(LUCK.goldenMonster.cap, LUCK.goldenMonster.base + points(luck) * LUCK.goldenMonster.perPoint);

/** The bonus gem roll of one chest: 0 (most of the time) or a gem find. Server only: the browser never rolls it. */
export const rollGemFind = (luck: number, rng: Rng): number => (rng() < gemChance(luck) ? rollGemAmount(rng) : 0);
