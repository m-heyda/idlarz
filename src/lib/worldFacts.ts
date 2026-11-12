import { BUILDING_RULES } from '@/config/buildings';
import { buildingDef } from '@/catalog/buildings';
import { forEachOwned, getTile, type World } from '@/utils/world';

// What the deeds read off the owned land and the farm (IDL-305). Computed by the server when it accepts a save (`summarize`) and kept in the stored summary, so judging a deed never walks the map. Pure.

/** The land and farm facts of one accepted save. All maps are small (a few biomes, a few animals). */
export interface WorldFacts {
	/** Biomes the player owns at least one tile of (castle and empty excluded) */
	biomes: string[];
	/** Largest group of owned tiles of the same biome that touch each other on a side, per biome */
	largestGroup: Record<string, number>;
	/** Animals owned per kind */
	animals: Record<string, number>;
	/** Buildings standing now, how many of them are at the top level, and the standing ones per biome of their building */
	buildingsBuilt: number;
	buildingsMaxed: number;
	buildingsByBiome: Record<string, number>;
}

const SIDES: readonly (readonly [number, number])[] = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1],
];

/**
 * The facts of a map and a farm. The largest group per biome is a flood fill over the owned tiles (each tile is visited once), so a map of tens of thousands of tiles costs one pass.
 *
 * @category Progression/Achievements
 * @order 5
 */
export const worldFacts = (tiles: World, farmLevels: Record<string, number> = {}, withBuildings = true): WorldFacts => {
	const seen = new Set<string>();
	const largestGroup: Record<string, number> = {};
	const buildingsByBiome: Record<string, number> = {};
	let buildingsBuilt = 0;
	let buildingsMaxed = 0;
	const ownedBiomes = new Set<string>();
	forEachOwned(tiles, (tile, x, y) => {
		if (tile.biome !== 'castle' && tile.biome !== 'empty') ownedBiomes.add(tile.biome);
		const def = withBuildings ? buildingDef(tile.building) : undefined;
		if (def) {
			buildingsBuilt++;
			buildingsByBiome[def.biome] = (buildingsByBiome[def.biome] ?? 0) + 1;
			if ((tile.buildingLevel ?? 1) >= BUILDING_RULES.maxLevel) buildingsMaxed++;
		}
		if (tile.biome === 'castle' || tile.biome === 'empty' || seen.has(`${x},${y}`)) return;
		// one group: walk every touching tile of the same biome
		let size = 0;
		const stack: [number, number][] = [[x, y]];
		seen.add(`${x},${y}`);
		while (stack.length > 0) {
			const [cx, cy] = stack.pop()!;
			size++;
			for (const [dx, dy] of SIDES) {
				const nx = cx + dx;
				const ny = cy + dy;
				const key = `${nx},${ny}`;
				if (seen.has(key) || getTile(tiles, nx, ny)?.biome !== tile.biome) continue;
				seen.add(key);
				stack.push([nx, ny]);
			}
		}
		if (size > (largestGroup[tile.biome] ?? 0)) largestGroup[tile.biome] = size;
	});
	const animals: Record<string, number> = {};
	for (const [id, n] of Object.entries(farmLevels)) if (typeof n === 'number' && n > 0) animals[id] = Math.floor(n);
	return { biomes: [...ownedBiomes].sort(), largestGroup, animals, buildingsBuilt, buildingsMaxed, buildingsByBiome };
};

/** A stored copy read back: anything missing or malformed reads as nothing. */
export const readWorldFacts = (raw: unknown): WorldFacts | null => {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const r = raw as Record<string, unknown>;
	const counts = (value: unknown): Record<string, number> => {
		const out: Record<string, number> = {};
		if (value && typeof value === 'object' && !Array.isArray(value))
			for (const [key, n] of Object.entries(value)) if (typeof n === 'number' && Number.isFinite(n) && n > 0) out[key] = Math.floor(n);
		return out;
	};
	const n = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);
	return {
		biomes: Array.isArray(r.biomes) ? r.biomes.filter((b): b is string => typeof b === 'string' && b.length <= 24) : [],
		largestGroup: counts(r.largestGroup),
		animals: counts(r.animals),
		buildingsBuilt: n(r.buildingsBuilt),
		buildingsMaxed: n(r.buildingsMaxed),
		buildingsByBiome: counts(r.buildingsByBiome),
	};
};
