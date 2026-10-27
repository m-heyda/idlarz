import { AMBIENT_LIFE, FARM_BONUS, TILE_SIZE, type AmbientCritterType } from '@/config/gameConfig';
import { getTile, ownedBounds, type World } from '@/utils/world';

export type AmbientType = AmbientCritterType;

/** Only these four can carry a clickable gift (the farm critters); fish, frogs and crabs are decoration. */
export const GIFT_CRITTERS = Object.keys(FARM_BONUS.critters) as AmbientType[];

/** Visible part of the map in tile coordinates (inclusive). */
export interface Viewport {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
}

export interface AmbientCritter {
	id: number;
	type: AmbientType;
	golden: boolean; // carries a clickable gift
	x: number; // map pixels (world coordinates)
	y: number;
	dx: number; // how far it strays, in pixels
	dy: number;
	flip: boolean; // faces left
	lifeMs: number;
}

let nextId = 1;
const between = (rng: () => number, a: number, b: number) => a + rng() * (b - a);

/** Pause before the next critter appears. */
export const nextSpawnDelay = (rng: () => number = Math.random) =>
	between(rng, AMBIENT_LIFE.spawnMinMs, AMBIENT_LIFE.spawnMaxMs);

/**
 * Picks a random owned tile in view (the castle excluded) and a critter that likes its biome (or its foundation biome).
 * Returns null when nothing in view can host one. Pure apart from the id counter, so it is easy to test.
 */
export const pickAmbientCritter = (
	tiles: World,
	view: Viewport,
	rng: () => number = Math.random
): AmbientCritter | null => {
	const candidates: { x: number; y: number; types: readonly AmbientType[] }[] = [];
	const bounds = ownedBounds(tiles);
	if (!bounds) return null;
	// only the part of the view that can hold explored tiles
	const minY = Math.max(bounds.minY, Math.floor(view.minY));
	const maxY = Math.min(bounds.maxY, Math.ceil(view.maxY));
	const minX = Math.max(bounds.minX, Math.floor(view.minX));
	const maxX = Math.min(bounds.maxX, Math.ceil(view.maxX));
	for (let y = minY; y <= maxY; y++) {
		for (let x = minX; x <= maxX; x++) {
			const tile = getTile(tiles, x, y);
			if (!tile || tile.biome === 'castle') continue;
			const biome = tile.biome;
			let types = AMBIENT_LIFE.byBiome[biome];
			// fish need open water: not on a lake tile that touches the shore
			if (types && biome === 'lake' && !([[0, -1], [1, 0], [0, 1], [-1, 0]] as const).every(([dx, dy]) => getTile(tiles, x + dx, y + dy)?.biome === 'lake')) {
				types = types.filter((t) => t !== 'fish');
			}
			if (types?.length) candidates.push({ x, y, types });
		}
	}
	if (candidates.length === 0) return null;

	const spot = candidates[Math.floor(rng() * candidates.length)];
	const type = spot.types[Math.floor(rng() * spot.types.length)];
	const reach = AMBIENT_LIFE.roamTiles * TILE_SIZE * (AMBIENT_LIFE.roamScale[type] ?? 1);
	const dx = between(rng, -reach, reach);
	const giftRoll = rng() < AMBIENT_LIFE.giftChance; // always one roll, so the sequence does not depend on the type
	return {
		id: nextId++,
		type,
		golden: giftRoll && GIFT_CRITTERS.includes(type),
		x: (spot.x + between(rng, 0.2, 0.8)) * TILE_SIZE,
		y: (spot.y + between(rng, 0.25, 0.8)) * TILE_SIZE,
		dx,
		dy: between(rng, -reach, reach) * 0.6,
		flip: dx < 0,
		lifeMs: between(rng, AMBIENT_LIFE.lifeMinMs, AMBIENT_LIFE.lifeMaxMs),
	};
};
