import { BIOMES, BIOME_SPAWN, SPECIAL_SINGLE_TYPE_BIOMES, EMPTY_BIOMES } from '@/config/gameConfig';
import { BIOME_RULES } from '@/config/biomeRules';
import type { BiomeType, Tile } from '@/types/game';
import { getTile, type World } from '@/utils/world';

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
export function neighbourBiomes(tiles: World, x: number, y: number) {
	const pick = (sides: [number, number][]) =>
		sides.map(([dx, dy]) => ownedBiome(getTile(tiles, x + dx, y + dy))).filter((b): b is BiomeType => b !== null);
	return { four: pick(SIDES4), eight: pick(SIDES8) };
}

/** An owned non-castle tile with no same-biome 4-neighbour: a 1x1 speck that the next purchase beside it should join. */
function isLonely(tiles: World, x: number, y: number): boolean {
	const biome = ownedBiome(getTile(tiles, x, y));
	return biome !== null && !SIDES4.some(([dx, dy]) => getTile(tiles, x + dx, y + dy)?.biome === biome);
}

/** Every biome a purchase can produce (castle and empty are not). */
export const SELECTABLE_BIOMES = Object.keys(BIOMES).filter(
	(name) => !SPECIAL_SINGLE_TYPE_BIOMES.includes(name as BiomeType) && !EMPTY_BIOMES.includes(name as BiomeType)
) as BiomeType[];

/** Verdict for each biome a purchase can produce on tile (x, y) after `purchased` purchases. */
export function biomeVerdicts(tiles: World, x: number, y: number, purchased: number): BiomeVerdict[] {
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

const DIAGONALS: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

/**
 * What the four 2x2 blocks round (x, y) say about the new tile, to keep two tiles of a biome from touching only at a corner
 * (the dual-grid then pinches them into a neck or a stray blob, never a clean shore):
 *   `avoid`   biomes that would meet a diagonal tile of the same biome with both tiles between them owned and different;
 *   `require` biomes of a diagonal pair of owned tiles whose fourth corner is owned and different: the new tile must join them.
 */
function saddleRules(tiles: World, x: number, y: number): { avoid: Set<BiomeType>; require: Set<BiomeType> } {
	const avoid = new Set<BiomeType>();
	const require = new Set<BiomeType>();
	for (const [dx, dy] of DIAGONALS) {
		const diag = getTile(tiles, x + dx, y + dy);
		const o1 = getTile(tiles, x + dx, y);
		const o2 = getTile(tiles, x, y + dy);
		if (diag && o1 && o2 && o1.biome !== diag.biome && o2.biome !== diag.biome && diag.biome !== 'castle') avoid.add(diag.biome);
		if (diag && o1 && o2 && o1.biome === o2.biome && o1.biome !== diag.biome && o1.biome !== 'castle') require.add(o1.biome);
	}
	return { avoid, require };
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
export function rollBiome(tiles: World, x: number, y: number, purchased: number, random: () => number = Math.random): BiomeType {
	const everyAllowed = biomeVerdicts(tiles, x, y, purchased).filter((v) => v.allowed).map((v) => v.biome);
	const { four } = neighbourBiomes(tiles, x, y);

	// No corner-only contacts (see saddleRules): join the pair that needs it, otherwise stay off the biomes that would pinch.
	const saddle = saddleRules(tiles, x, y);
	const required = [...saddle.require].filter((b) => everyAllowed.includes(b));
	if (required.length) return required[Math.floor(random() * required.length)];
	const unpinched = everyAllowed.filter((b) => !saddle.avoid.has(b));
	const allowed = unpinched.length ? unpinched : everyAllowed;

	// Buddy rule: join a lone neighbour, so every biome ends up at least two tiles big.
	const lonely = SIDES4.filter(([dx, dy]) => isLonely(tiles, x + dx, y + dy))
		.map(([dx, dy]) => getTile(tiles, x + dx, y + dy)!.biome)
		.filter((b) => allowed.includes(b));
	if (lonely.length && random() * 100 < BIOME_RULES.cluster.buddyPct) return lonely[Math.floor(random() * lonely.length)];

	// A gap (every side owned) can never be joined later, so it must continue a neighbour.
	const ownedSides = SIDES4.filter(([dx, dy]) => getTile(tiles, x + dx, y + dy) !== undefined).length;
	if (ownedSides === 4) {
		const fits = four.filter((b) => allowed.includes(b));
		if (fits.length) return fits[Math.floor(random() * fits.length)]; // a biome on more sides is likelier
	}

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
		// the ring is a cycle of 4-adjacent tiles: every tile needs a same-biome neighbour in it (no 1x1 patch)
		const paired = ring.every((b, i) => b === ring[(i + 7) % 8] || b === ring[(i + 1) % 8]);
		if (paired && count('plains') >= minPlains && entries.every(([b]) => b === 'plains' || count(b) <= maxOfOther)) return ring;
	}
	return RING.map((_, i) => (i % 4 < 2 ? 'plains' : 'forest')) as BiomeType[];
}
