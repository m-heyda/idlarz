import { CASTLE_X, CASTLE_Y } from '@/config/gameConfig';
import { rollBiome } from '@/utils/biomeRules';
import { createInitialWorld } from '@/utils/gameUtils';
import { getTile, hasOwnedNeighbour, isOwnedAt, ownedBounds, setTile, type World } from '@/utils/world';

/** Seeded generator (mulberry32): the same seed always gives the same stream. */
export const seededRandom = (seed: number): (() => number) => {
	let a = (seed + 1) * 0x9e3779b1;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

/** How the next tile to buy is chosen: the free tile nearest the castle (a tidy blob) or any free tile beside the land (ragged edges). */
export type BuyPolicy = 'nearest' | 'random';

const SIDES: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** Every unowned tile with an owned 4-neighbour. */
export function frontierTiles(world: World): [number, number][] {
	const b = ownedBounds(world);
	const out: [number, number][] = [];
	if (!b) return out;
	for (let y = b.minY - 1; y <= b.maxY + 1; y++)
		for (let x = b.minX - 1; x <= b.maxX + 1; x++) if (!isOwnedAt(world, x, y) && hasOwnedNeighbour(world, x, y)) out.push([x, y]);
	return out;
}

/**
 * A new game plus `purchases` rolled purchases, the way the store does it (rollBiome on a tile beside the land), without
 * the economy. Deterministic for a given seed; used by the map lab, the lone-tile report and the tests.
 */
export function growWorld(purchases: number, seed: number, policy: BuyPolicy = 'nearest'): World {
	const random = seededRandom(seed);
	let world = createInitialWorld(random);
	for (let n = 0; n < purchases; n++) {
		const frontier = frontierTiles(world);
		if (!frontier.length) break;
		let pick = frontier[0];
		if (policy === 'random') pick = frontier[Math.floor(random() * frontier.length)];
		else {
			let best = Infinity;
			for (const f of frontier) {
				const d = Math.abs(f[0] - CASTLE_X) + Math.abs(f[1] - CASTLE_Y) + random() * 0.5; // jitter breaks ties
				if (d < best) {
					best = d;
					pick = f;
				}
			}
		}
		const [x, y] = pick;
		world = setTile(world, x, y, { biome: rollBiome(world, x, y, n, random), isOwned: true });
	}
	return world;
}

/**
 * Owned non-castle tiles without a same-biome 4-neighbour (the 1x1 specks), how many of those are `stuck` (every side is
 * owned, so no purchase can ever join them) and how many non-castle tiles there are.
 */
export function loneTileStats(world: World): { lone: number; stuck: number; total: number } {
	const b = ownedBounds(world);
	let lone = 0;
	let stuck = 0;
	let total = 0;
	if (!b) return { lone, stuck, total };
	for (let y = b.minY; y <= b.maxY; y++)
		for (let x = b.minX; x <= b.maxX; x++) {
			const t = getTile(world, x, y);
			if (!t || t.biome === 'castle') continue;
			total++;
			if (SIDES.some(([dx, dy]) => getTile(world, x + dx, y + dy)?.biome === t.biome)) continue;
			lone++;
			if (SIDES.every(([dx, dy]) => getTile(world, x + dx, y + dy) !== undefined)) stuck++;
		}
	return { lone, stuck, total };
}

/** 2x2 blocks where two tiles of a biome touch only at a corner (the other two are owned and different): the pinches the dual-grid cannot draw cleanly. */
export function saddleCount(world: World): number {
	const b = ownedBounds(world);
	let n = 0;
	if (!b) return n;
	for (let y = b.minY; y < b.maxY; y++)
		for (let x = b.minX; x < b.maxX; x++) {
			const a = getTile(world, x, y);
			const d = getTile(world, x + 1, y + 1);
			const o1 = getTile(world, x + 1, y);
			const o2 = getTile(world, x, y + 1);
			if (a && d && o1 && o2 && a.biome === d.biome && o1.biome !== a.biome && o2.biome !== a.biome) n++;
			else if (o1 && o2 && a && d && o1.biome === o2.biome && a.biome !== o1.biome && d.biome !== o1.biome) n++;
		}
	return n;
}
