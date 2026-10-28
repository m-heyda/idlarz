import { CHEST, LUCK } from '@/config/gameConfig';
import type { Rng } from '@/lib/rng';

// What Luck does beyond the gold multipliers in chests.ts / loot/kill.ts. Pure; the server and the Character window use the same numbers.

const points = (luck: number): number => (Number.isFinite(luck) ? Math.max(0, luck) : 0);

/** Seconds between two chests: Luck shortens it, never below `LUCK.chestIntervalFloor` of the base. */
export const chestIntervalSec = (luck: number): number =>
	CHEST.intervalSec * Math.max(LUCK.chestIntervalFloor, 1 / (1 + points(luck) * LUCK.chestSpeedPerPoint));

/** % more chests than at Luck 0 (what the Character window shows). */
export const chestRateBonusPct = (luck: number): number => (CHEST.intervalSec / chestIntervalSec(luck) - 1) * 100;

/** What the weight of every rarity above Common/Uncommon is multiplied by (the roll is normalised afterwards, so it moves odds toward rare gear). */
export const rarityLuckMultiplier = (luck: number): number => Math.min(LUCK.rarityCap, 1 + points(luck) * LUCK.rarityPerPoint);

/** Multiplier on a monster's gear drop chance. */
export const dropChanceMultiplier = (luck: number): number => 1 + points(luck) * LUCK.dropChancePerPoint;

/** Chance (0-1) that a chest also holds gems. */
export const gemChance = (luck: number): number => Math.min(LUCK.gem.cap, LUCK.gem.base + points(luck) * LUCK.gem.perPoint);

/** How many gems a gem find holds: LUCK.gem.min..max, skewed toward the low end. */
export const rollGemAmount = (rng: Rng): number => {
	const { min, max } = LUCK.gem;
	const u = rng();
	return Math.min(max, min + Math.floor((max - min + 1) * u * u));
};

/** Chance (0-1) that a newly arrived rat is a lucky one. */
export const luckyRatChance = (luck: number): number => Math.min(LUCK.luckyRat.cap, LUCK.luckyRat.base + points(luck) * LUCK.luckyRat.perPoint);

/** The bonus gem roll of one chest: 0 (most of the time) or a gem find. Server only: the browser never rolls it. */
export const rollGemFind = (luck: number, rng: Rng): number => (rng() < gemChance(luck) ? rollGemAmount(rng) : 0);
