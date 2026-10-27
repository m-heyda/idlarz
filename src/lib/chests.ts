import { CHEST, CASTLE_X, CASTLE_Y } from '@/config/gameConfig';
import { lootPool, pickWeighted } from '@/catalog';
import { addToBag } from '@/lib/inventory';
import { isInWard } from '@/lib/castleWard';
import type { BagSlot, Resources, Tile } from '@/types/game';
import { isOwnedAt, ownedRowMajor, type World } from '@/utils/world';

// Treasure chests: where they appear and what is inside. Pure, with an injectable random(), unit-tested in chests.test.ts.

// ----------------------------------------------------------------------------------------------- placement
const SIDES4: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** A tile with a building: the building stands on it, so no chest goes there. */
const isBuilt = (t: Tile) => !!t.building;

/**
 * Where the next chest goes. Eligible: owned, not the castle, no chest, no monster (`taken` = "x,y" keys), no building,
 * outside the castle ward. Weight = 1 + frontier bonus (touches unowned land) + distance from the castle, times a
 * penalty when another chest is within `nearbyRadius`. So chests lean toward the edge of your land and spread out.
 */
export function pickChestSpot(
	tiles: World,
	taken: Set<string>,
	castleLevel: number,
	random: () => number = Math.random
): { x: number; y: number } | null {
	const P = CHEST.placement;
	const chests: [number, number][] = [];
	const entries = ownedRowMajor(tiles);
	if (tiles.stats.chests > 0) for (const { x, y, tile } of entries) if (tile.hasChest) chests.push([x, y]);

	const spots: { x: number; y: number; w: number }[] = [];
	for (const { x, y, tile: t } of entries) {
		if (t.biome === 'castle' || t.hasChest || isBuilt(t) || taken.has(`${x},${y}`) || isInWard(x, y, castleLevel)) continue;
		let w = 1;
		if (SIDES4.some(([dx, dy]) => !isOwnedAt(tiles, x + dx, y + dy))) w += P.frontierBonus;
		w += Math.floor(Math.max(Math.abs(x - CASTLE_X), Math.abs(y - CASTLE_Y)) / P.distanceStep);
		if (chests.some(([cx, cy]) => Math.max(Math.abs(cx - x), Math.abs(cy - y)) <= P.nearbyRadius)) w *= P.nearbyFactor;
		spots.push({ x, y, w });
	}
	if (spots.length === 0) return null;
	let r = random() * spots.reduce((s, p) => s + p.w, 0);
	for (const p of spots) {
		r -= p.w;
		if (r < 0) return { x: p.x, y: p.y };
	}
	const last = spots[spots.length - 1];
	return { x: last.x, y: last.y };
}

// ----------------------------------------------------------------------------------------------- loot
export type ChestLoot =
	| { kind: 'gold'; gold: number; minutes: number; goldRate: number }
	| { kind: 'boost'; gold: number; minutes: number; goldRate: number; multiplier: number }
	| { kind: 'bundle'; items: { resource: 'wood' | 'stone' | 'coal' | 'food'; amount: number }[] }
	| { kind: 'xp'; xp: number; minutes: number }
	| { kind: 'item'; itemId: string };

export interface ChestContext {
	rates: Resources; // total per-second income (resourceRates.total)
	luck: number;
	/** Gold Find of the gear, in %: extra gold from gold and lucky chests */
	goldFind?: number;
	bag: BagSlot[];
}

const between = (random: () => number, [lo, hi]: [number, number]) => lo + random() * (hi - lo);

/** Chest items: whatever the catalog puts in the `chest` pool (the Rattatui set drops only from the Rat King). */
export const CHEST_ITEMS: string[] = lootPool('chest').map((entry) => entry.id);

/** Relative chances with Luck shifted from plain gold toward the lucky chest and the item. */
export function rewardWeights(luck: number): Record<keyof typeof CHEST.rewards, number> {
	const w = { ...CHEST.rewards };
	const shift = Math.min(w.gold * 0.6, w.gold * luck * CHEST.luckRewardBonusPerPoint);
	w.gold -= shift;
	w.boost += shift * 0.8;
	w.item += shift * 0.2;
	return w;
}

/** Rolls the contents of a chest. Gold is "minutes of income", like before; a full bag turns an item into gold. */
export function rollChestLoot(ctx: ChestContext, random: () => number = Math.random): ChestLoot {
	const weights = rewardWeights(ctx.luck);
	const entries = Object.entries(weights) as [keyof typeof weights, number][];
	let r = random() * entries.reduce((s, [, w]) => s + w, 0);
	let kind: keyof typeof weights = entries[entries.length - 1][0];
	for (const [k, w] of entries) {
		r -= w;
		if (r < 0) {
			kind = k;
			break;
		}
	}

	const luck = 1 + ctx.luck * CHEST.luckBonusPerPoint;
	const goldLoot = (multiplier: number): ChestLoot => {
		const minutes = between(random, [CHEST.minMinutes, CHEST.maxMinutes]);
		const gold = Math.floor(ctx.rates.gold * minutes * 60 * luck * multiplier * (1 + (ctx.goldFind ?? 0) / 100));
		return multiplier > 1
			? { kind: 'boost', gold, minutes, goldRate: ctx.rates.gold, multiplier }
			: { kind: 'gold', gold, minutes, goldRate: ctx.rates.gold };
	};

	if (kind === 'boost') return goldLoot(CHEST.boostMultiplier);
	if (kind === 'bundle') {
		const pool = [...CHEST.bundle.resources];
		const count = Math.min(pool.length, Math.round(between(random, CHEST.bundle.count)));
		const items: { resource: (typeof pool)[number]; amount: number }[] = [];
		for (let i = 0; i < count; i++) {
			const resource = pool.splice(Math.floor(random() * pool.length) % pool.length, 1)[0];
			const minutes = between(random, CHEST.bundle.minutes);
			items.push({ resource, amount: Math.max(CHEST.bundle.floor, Math.floor(ctx.rates[resource] * minutes * 60 * luck)) });
		}
		return { kind: 'bundle', items };
	}
	if (kind === 'xp') {
		const minutes = between(random, CHEST.xp.minutes);
		return { kind: 'xp', xp: Math.max(CHEST.xp.floor, Math.floor(ctx.rates.xp * minutes * 60)), minutes };
	}
	if (kind === 'item') {
		const itemId = pickWeighted(lootPool('chest'), random);
		if (itemId && addToBag(ctx.bag, itemId, 1).added === 1) return { kind: 'item', itemId };
	}
	return goldLoot(1); // gold, or an item that did not fit in the bag
}
