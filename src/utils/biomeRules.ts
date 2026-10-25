import { BIOMES, BIOME_SPAWN, SPECIAL_SINGLE_TYPE_BIOMES, EMPTY_BIOMES } from '@/config/gameConfig';
import { BIOME_RULES } from '@/config/biomeRules';
import type { BiomeType, Tile } from '@/types/game';

/** Whether a biome may turn up on one tile, and why not. */
export interface BiomeVerdict {
	biome: BiomeType;
	allowed: boolean;
	reason?: string; // why it is blocked
	extends?: boolean; // continues a biome already touching this tile (4-neighbour)
}

const SIDES4: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const SIDES8: [number, number][] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

const label = (b: string) => BIOMES[b]?.label ?? b;
const ownedBiome = (t: Tile | undefined): BiomeType | null => (t?.isOwned && t.biome !== 'castle' ? t.biome : null);

/** Biomes of the owned non-castle neighbours: 4-neighbours and all 8. */
export function neighbourBiomes(tiles: Tile[][], x: number, y: number) {
	const pick = (sides: [number, number][]) =>
		sides.map(([dx, dy]) => ownedBiome(tiles[y + dy]?.[x + dx])).filter((b): b is BiomeType => b !== null);
	return { four: pick(SIDES4), eight: pick(SIDES8) };
}

/** Every biome a purchase can produce (castle and empty are not; Grounds, the old building lot, no longer turns up: buildings go on any tile). */
export const SELECTABLE_BIOMES = Object.keys(BIOMES).filter(
	(name) => !SPECIAL_SINGLE_TYPE_BIOMES.includes(name as BiomeType) && !EMPTY_BIOMES.includes(name as BiomeType) && name !== 'grounds'
) as BiomeType[];

/** Verdict for each biome a purchase can produce on tile (x, y) after `purchased` purchases. */
export function biomeVerdicts(tiles: Tile[][], x: number, y: number, purchased: number): BiomeVerdict[] {
	const { four, eight } = neighbourBiomes(tiles, x, y);
	const hasWater = eight.some((b) => b === 'lake' || b === 'coast');
	return SELECTABLE_BIOMES.map((biome) => {
		const ext = four.includes(biome);
		const unlock = BIOME_RULES.unlockAfterPurchases[biome] ?? 0;
		if (purchased < unlock) return { biome, allowed: false, reason: `Unlocks after ${unlock} tiles` };
		if (!BIOME_RULES.neutral.includes(biome)) {
			if (BIOME_RULES.needsWater.includes(biome) && !hasWater) return { biome, allowed: false, reason: 'Needs water nearby' };
			for (const [a, b] of BIOME_RULES.conflicts) {
				const other = biome === a ? b : biome === b ? a : null;
				if (other && eight.includes(other as BiomeType)) return { biome, allowed: false, reason: `Not next to ${label(other)}` };
			}
		}
		return { biome, allowed: true, extends: ext };
	});
}

/** Pick one by weight from [item, weight][] using a [0,1) roll. */
function weighted<T>(items: [T, number][], roll: number): T {
	const total = items.reduce((s, [, w]) => s + w, 0);
	let r = roll * total;
	for (const [item, w] of items) {
		r -= w;
		if (r < 0) return item;
	}
	return items[items.length - 1][0];
}

/**
 * The biome of a random purchase on (x, y): first a chance to continue an adjoining area (stronger with every extra
 * same-biome neighbour), otherwise a weighted roll among everything the rules allow. Water still pulls water and shore
 * (BIOME_SPAWN). Always returns an allowed biome (plains is never blocked).
 */
export function rollBiome(tiles: Tile[][], x: number, y: number, purchased: number, random: () => number = Math.random): BiomeType {
	const allowed = biomeVerdicts(tiles, x, y, purchased).filter((v) => v.allowed).map((v) => v.biome);
	const { four } = neighbourBiomes(tiles, x, y);

	const copyable = [...new Set(four)].filter((b) => allowed.includes(b) && !BIOME_RULES.cluster.neverCopy.includes(b));
	if (copyable.length) {
		const pick = copyable.length === 1 ? copyable[0] : copyable[Math.floor(random() * copyable.length)];
		const same = four.filter((b) => b === pick).length;
		const pct = Math.min(
			BIOME_RULES.cluster.capPct,
			(BIOME_RULES.cluster.basePct[pick] ?? 40) + BIOME_RULES.cluster.perExtraNeighbourPct * (same - 1)
		);
		if (random() * 100 < pct) return pick;
	}

	const nearLake = four.includes('lake');
	const nearCoast = four.includes('coast');
	const weights = allowed.map((b): [BiomeType, number] => {
		let w = BIOME_SPAWN.weights[b] ?? 1;
		if (nearLake) w *= BIOME_SPAWN.nearLake[b] ?? 1;
		if (nearCoast) w *= BIOME_SPAWN.nearCoast[b] ?? 1;
		return [b, w];
	});
	return weighted(weights, random());
}

/** Ring order around the castle, clockwise from the north-west corner. */
export const RING: [number, number][] = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];

/**
 * The castle's 8 neighbours for a new game: patches of the basic biomes (plains most), always at least `minPlains`
 * plains and never more than `maxOfOther` of any other biome. Retries with the same random source until it fits.
 */
export function generateStartRing(random: () => number = Math.random): BiomeType[] {
	const { weights, copyPreviousPct, minPlains, maxOfOther } = BIOME_RULES.startRing;
	const entries = Object.entries(weights) as [BiomeType, number][];
	for (let attempt = 0; attempt < 50; attempt++) {
		const ring: BiomeType[] = [];
		for (let i = 0; i < RING.length; i++) {
			ring.push(i > 0 && random() * 100 < copyPreviousPct ? ring[i - 1] : weighted(entries, random()));
		}
		const count = (b: string) => ring.filter((r) => r === b).length;
		if (count('plains') >= minPlains && entries.every(([b]) => b === 'plains' || count(b) <= maxOfOther)) return ring;
	}
	return RING.map((_, i) => (i % 2 === 0 ? 'plains' : 'forest')) as BiomeType[];
}
