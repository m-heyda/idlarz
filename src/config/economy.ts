// Tile prices and XP, the resource caps, clicks and the starting gems: the numbers the economy runs on.
// Part of the former gameConfig.ts (split in IDL-15); the values are unchanged.
import { amounts } from '@/catalog/resourceKeys';

// Game Constants
export const TICK_RATE = 100; // 10 times per second
export const BASE_TILE_COST = 55; // Base cost for first tile purchase

// XP calculation constants - Exponential XP system
export const BASE_XP_PER_TILE = 45; // was 125 (pacing commit): tile XP is now the smaller part of a level, the curve below is fitted to what the bot earns

// Hard limits shared by the tick loop and save validation
export const MAX_CATCHUP_SEC = 300; // one tick never advances the game by more than this (clock edits, device sleep)
// Every stockpile, XP included, stops here; a save above it is considered tampered. Raised from 1e15 so a map of tens of
// thousands of tiles stays buyable (see TILE_PRICE).
export const RESOURCE_CAP = 1e21;
export const XP_CAP = RESOURCE_CAP;

// The late part of the tile price. Up to `tailFrom` owned tiles the price is the three exponential stages of SCALING_CONFIG;
// beyond it grows like (n / tailFrom)^tailExponent, which is far gentler than any exponential, so the map can keep growing
// for as long as the player keeps earning. `ceiling` keeps the price a finite, affordable-in-principle number.
// The first 300 tiles are the "fill the map" part of a run (about 2-3 days); past them the price climbs much faster than the
// income, so 400 tiles take about twice as long per 100 as the stretch before. This is the knob for the later rebirth design:
// bigger starting resources and bigger maps mean raising `tailFrom` or lowering `tailExponent`.
export const TILE_PRICE = {
	tailFrom: 300,
	tailExponent: 3.5, // was 4.5: the medium-map decision (IDL-79, applied in IDL-181)
	ceiling: RESOURCE_CAP / 100,
};

// XP a tile purchase gives: BASE_XP_PER_TILE x growth^(k-1) x k/4 up to tile `growthUntil`, then a polynomial tail. The level curve above is
// fitted to the XP these numbers give the sim bot, so change them together (re-run the sim and move the anchors).
export const XP_TILE = {
	growth: 1.02,
	growthUntil: 300,
	tailExponent: 1.5,
};

// Tile cost curve: exponential growth that is steepest early (cheap first tiles), gentler through the mid game and
// gentler again past `lateTiles`, so a big territory stays a goal instead of an unreachable number. Tuned with scripts/sim.ts
// so the first ~100 tiles come within the first day, 200-300 within 2-3 days (docs/game/pacing-targets.md).
export const SCALING_CONFIG = {
	growthEarly: 1.13, // cost multiplier per owned tile up to `earlyTiles`
	earlyTiles: 15,
	growthLate: 1.07, // cost multiplier per owned tile from `earlyTiles` to `lateTiles`
	lateTiles: 100,
	growthEndgame: 1.007, // cost multiplier per owned tile after `lateTiles`, up to `TILE_PRICE.tailFrom`

	// Gold cost of the next tile when `ownedTiles` tiles are owned (castle counts), before discounts
	costFormula: (ownedTiles: number) => tilePrice(ownedTiles),
	adjacencyBonus: 0.25, // +25% output per same-biome neighbour
};

/**
 * Gold price of the next tile when `ownedTiles` are owned, before discounts: the three exponential stages of SCALING_CONFIG
 * up to TILE_PRICE.tailFrom, then the polynomial tail, never above TILE_PRICE.ceiling. Always finite.
 */
function tilePrice(ownedTiles: number): number {
	const S = SCALING_CONFIG;
	const n = Math.min(ownedTiles, TILE_PRICE.tailFrom);
	let price =
		BASE_TILE_COST *
		Math.pow(S.growthEarly, Math.min(n, S.earlyTiles)) *
		Math.pow(S.growthLate, Math.max(Math.min(n, S.lateTiles) - S.earlyTiles, 0)) *
		Math.pow(S.growthEndgame, Math.max(n - S.lateTiles, 0));
	if (ownedTiles > TILE_PRICE.tailFrom) price *= Math.pow(ownedTiles / TILE_PRICE.tailFrom, TILE_PRICE.tailExponent);
	return Math.floor(Math.min(price, TILE_PRICE.ceiling));
}

// Extra resources a tile purchase costs once enough tiles are owned. amount = gold cost x share
export const TILE_RESOURCE_COST: { from: number; resource: 'wood' | 'stone' | 'coal' | 'food' | 'hide'; share: number }[] = [
	{ from: 15, resource: 'wood', share: 0.3 },
	{ from: 15, resource: 'stone', share: 0.2 }, // was 0.25: stone has the thinnest income of the five, the sim showed it holding tiles back more than gold in the first 100
	{ from: 30, resource: 'coal', share: 0.2 },
	{ from: 40, resource: 'food', share: 0.1 },
	{ from: 100, resource: 'hide', share: 0.02 }, // milk and eggs are kept for other uses, so the big territories ask for leather
];

// Biome/building output is multiplied by this (the castle's own output and the base rates are not)
export const BIOME_YIELD = { scale: 1.3 };

export const INITIAL_RESOURCES = amounts({ gold: 125 });

// Base resource generation (per second) - slightly increased for better early game
// Meat, eggs, milk and hide come only from the farm, so they are 0 here
export const BASE_GENERATION_RATES = amounts({ gold: 0.1, xp: 0.25 });

// Gold per click = total gold/s x click power, but never less than the level's `floor` (so a click always feels like something, even in
// the first minutes when the income is tiny). Four upgrade levels, bought from the merchant.
export const CLICK_LADDER = [
	{ power: 2, floor: 2, price: 0 },
	{ power: 4, floor: 6, price: 750000 },
	{ power: 8, floor: 20, price: 2500000 },
	{ power: 15, floor: 60, price: 10000000 },
] as const;

/** Gold of one click at a ladder level: gold/s x power (at least the level's floor), then the multipliers (Click Mastery, set bonus). */
export const clickGold = (goldPerSec: number, clickLevel: number, multiplier = 1): number => {
	const level = CLICK_LADDER[clickLevel] ?? CLICK_LADDER[0];
	return Math.max(goldPerSec * level.power, level.floor) * multiplier;
};

// Click rate limiter: two token buckets, a click must take a token from both.
// - burst: up to `capacity` clicks at once, refilling `refillPerSec` per second (a fast human is never limited here;
//   anything faster than `refillPerSec` clicks/s earns nothing).
// - stamina: a long-run allowance (`staminaCapacity` clicks, refilling `staminaRefillPerSec`/s ~ 130K paid clicks a
//   day) so an auto-clicker running 24 h is no better than a very dedicated human, while normal sessions never notice it.
export const CLICK_LIMIT = {
	capacity: 8,
	refillPerSec: 5,
	staminaCapacity: 20000,
	staminaRefillPerSec: 1.5,
	requireTrusted: true, // ignore synthetic (script-dispatched) clicks
};

/** Gems every player starts with (also granted to saves from before Gems existed). */
export const STARTING_GEMS = 1000;
export const GEMS_CAP = 1_000_000_000;
