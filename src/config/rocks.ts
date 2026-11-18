// Mineable rocks: the numbers. Pure data; the rules that use it are in `src/lib/rocks.ts` (spots, tier roll, loot) and `src/lib/offline/*` (the server owns every spawn, hit count and drop).

/** The rarity of a rock: how many clicks it takes and what it can hold. The names match the item rarities, so the colours are the game's own. */
export type RockTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const ROCK_TIER_ORDER: readonly RockTier[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export interface RockTierDef {
	label: string;
	/** Clicks that break it */
	clicks: number;
	/** Weight when a new rock is rolled; the rare and better tiers are multiplied by the Luck bonus (`rarityLuckMultiplier`) */
	weight: number;
	/** The pictures of the tier in `public/pixel/rocks/`; one is picked from the ticket number, so a map shows a mix */
	sprites: readonly string[];
}

/**
 * The rock tiers. A common rock takes 50 clicks, an uncommon one 125, a rare one 250 and an epic one 500 and a legendary one 1,000. Weights: 70 / 22 / 7 / 1 / 0.25 before Luck.
 *
 * @category Economy/Rocks and Mining
 * @order 1
 * @table rock-tiers
 */
export const ROCK_TIERS: Record<RockTier, RockTierDef> = {
	common: { label: 'Rock', clicks: 50, weight: 70, sprites: ['rock_stone'] },
	uncommon: { label: 'Silver ore', clicks: 125, weight: 22, sprites: ['rock_silver'] },
	rare: { label: 'Rich ore', clicks: 250, weight: 7, sprites: ['rock_gold'] },
	epic: { label: 'Crystal', clicks: 500, weight: 1, sprites: ['rock_crystal'] },
	legendary: { label: 'Legendary ore', clicks: 1000, weight: 0.25, sprites: ['rock_legendary'] },
};

/** The picture of a rock: one of its tier's sprites, chosen from the ticket number so a rock never changes its look. */
export const rockSprite = (tier: RockTier, n: number): string => {
	const list = ROCK_TIERS[tier].sprites;
	return `/pixel/rocks/${list[Math.abs(Math.floor(n)) % list.length]}.png`;
};

/**
 * How rocks appear and how fast they may be mined (server rules).
 *
 * - **Timer**: one new rock every 150 s of play time (shorter with Luck, never under 60% of it), much faster than a chest's 600 s. It runs apart from the chest and monster timers and has its own room, so rocks never take the place of a chest or a monster.
 * - **Room**: at most `maxOnMap` rocks wait at once, and no more than `landShare` of the free land (at least `minAllowed`).
 * - **Tiles**: owned land that is not water, the castle, its ward or a tile holding a monster, boss, chest, building or another rock.
 * - **Clicks**: the browser sends its clicks in batches. The server lets in at most `maxCps` clicks per second (a bucket of `burst` clicks), so a rock cannot be broken faster than a person can click.
 *
 * @category Economy/Rocks and Mining
 * @order 2
 * @table rock-rules
 */
export const ROCK = {
	intervalSec: 150,
	maxOnMap: 15,
	landShare: 0.12,
	minAllowed: 2,
	maxCps: 24,
	burst: 48,
	/** The most clicks one request may carry */
	maxBatch: 200,
} as const;

/** What a rock can drop. A resource is paid like a chest bundle: minutes of the player's income of it (never under `floor`); an ingredient goes into the crafting bag. */
export type RockDrop =
	| { kind: 'resource'; id: 'stone' | 'coal'; minutes: readonly [number, number]; floor: number }
	| { kind: 'ingredient'; id: string; chance: number; qty: readonly [number, number] };

/**
 * What each tier drops. Stone and coal always drop (minutes of income); the ingredients are chances per rock (Luck raises them like the monsters' ingredients). To add a loot or a new ore, add a line here: the server rolls every line of the tier's table.
 * Ingredient ids are the crafting bag ids (`ing_<name>`, see `catalog/ingredients.ts`). Ember Coal is the rare one: 1 to 3 at a low chance.
 *
 * @category Economy/Rocks and Mining
 * @order 3
 * @table rock-drops
 */
export const ROCK_DROPS: Record<RockTier, readonly RockDrop[]> = {
	common: [
		{ kind: 'resource', id: 'stone', minutes: [2, 4], floor: 25 },
		{ kind: 'resource', id: 'coal', minutes: [1, 2], floor: 15 },
		{ kind: 'ingredient', id: 'ing_copper_ore', chance: 0.1, qty: [1, 1] },
		{ kind: 'ingredient', id: 'ing_ember_coal', chance: 0.02, qty: [1, 1] },
	],
	uncommon: [
		{ kind: 'resource', id: 'stone', minutes: [5, 8], floor: 60 },
		{ kind: 'resource', id: 'coal', minutes: [3, 5], floor: 35 },
		{ kind: 'ingredient', id: 'ing_silver_ore', chance: 0.12, qty: [1, 1] },
		{ kind: 'ingredient', id: 'ing_copper_ore', chance: 0.1, qty: [1, 1] },
		{ kind: 'ingredient', id: 'ing_ember_coal', chance: 0.04, qty: [1, 1] },
	],
	rare: [
		{ kind: 'resource', id: 'stone', minutes: [10, 15], floor: 120 },
		{ kind: 'resource', id: 'coal', minutes: [6, 10], floor: 70 },
		{ kind: 'ingredient', id: 'ing_gold_ore', chance: 0.12, qty: [1, 1] },
		{ kind: 'ingredient', id: 'ing_silver_ore', chance: 0.2, qty: [1, 1] },
		{ kind: 'ingredient', id: 'ing_copper_ore', chance: 0.15, qty: [1, 2] },
		{ kind: 'ingredient', id: 'ing_ember_coal', chance: 0.08, qty: [1, 2] },
	],
	epic: [
		{ kind: 'resource', id: 'stone', minutes: [20, 30], floor: 250 },
		{ kind: 'resource', id: 'coal', minutes: [12, 20], floor: 150 },
		{ kind: 'ingredient', id: 'ing_crystal', chance: 0.25, qty: [1, 1] },
		{ kind: 'ingredient', id: 'ing_gold_ore', chance: 0.25, qty: [1, 1] },
		{ kind: 'ingredient', id: 'ing_silver_ore', chance: 0.3, qty: [1, 2] },
		{ kind: 'ingredient', id: 'ing_ember_coal', chance: 0.15, qty: [1, 3] },
	],
	// MVP (the pool is adjusted later): much more stone and coal than an epic rock, the better ores often, and Ember Coal now and then (1 to 3)
	legendary: [
		{ kind: 'resource', id: 'stone', minutes: [40, 60], floor: 500 },
		{ kind: 'resource', id: 'coal', minutes: [25, 40], floor: 300 },
		{ kind: 'ingredient', id: 'ing_crystal', chance: 0.4, qty: [1, 2] },
		{ kind: 'ingredient', id: 'ing_gold_ore', chance: 0.4, qty: [1, 2] },
		{ kind: 'ingredient', id: 'ing_silver_ore', chance: 0.5, qty: [1, 3] },
		{ kind: 'ingredient', id: 'ing_copper_ore', chance: 0.3, qty: [1, 2] },
		{ kind: 'ingredient', id: 'ing_ember_coal', chance: 0.1, qty: [1, 3] },
	],
};
