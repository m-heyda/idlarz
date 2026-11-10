import { EMPTY_WORLD, setTiles, type World } from '@/utils/world';
import type { BiomeType } from '@/types/game';

/**
 * The world behind the landing page: a vast, seeded land of the basic biomes (plains, forest, swamp, tundra, coast) with a sea around it, a river and ponds, and the word IDLE spelled
 * out in hills on a snow plain that is part of the mainland (patches of the biomes, not slabs). `/map-lab/landing-bake` draws it with the real terrain renderer and saves `public/landing/map.png`, which the landing page shows (so the landing never runs the generator).
 * Deterministic: the same seed gives the same picture. Pure: no canvas, no store.
 *
 * @title The landing world
 * @category Architecture/Art
 * @order 3
 */

/** Size of the baked world in tiles (one tile is 48 px in the picture). The picture is cropped one tile inside this on every side. */
export const LANDING_WORLD = { width: 74, height: 38, seed: 7 } as const;

/** Where the letters start (tile x, y) and their size: the title block of the page is laid out around these. */
export const LANDING_LETTERS = { x: 21, y: 4, height: 10 } as const;

/** Each letter is rows of cells, stroke two tiles wide, ten tiles tall. */
const rect = (x: number, y: number, w: number, h: number): [number, number][] => {
	const out: [number, number][] = [];
	for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.push([x + i, y + j]);
	return out;
};

const LETTERS: Record<string, { width: number; cells: [number, number][] }> = {
	I: { width: 6, cells: [...rect(0, 0, 6, 2), ...rect(2, 2, 2, 6), ...rect(0, 8, 6, 2)] },
	D: { width: 7, cells: [...rect(0, 0, 2, 10), ...rect(2, 0, 3, 2), ...rect(2, 8, 3, 2), ...rect(5, 1, 2, 8)] },
	L: { width: 6, cells: [...rect(0, 0, 2, 10), ...rect(2, 8, 4, 2)] },
	E: { width: 6, cells: [...rect(0, 0, 2, 10), ...rect(2, 0, 4, 2), ...rect(2, 4, 3, 2), ...rect(2, 8, 4, 2)] },
};

/** The tiles of the word IDLE (hills), as "x,y" keys, starting at `LANDING_LETTERS`. */
export const letterTiles = (): Set<string> => {
	const out = new Set<string>();
	let x = LANDING_LETTERS.x;
	for (const ch of 'IDLE') {
		const letter = LETTERS[ch];
		for (const [i, j] of letter.cells) out.add(`${x + i},${LANDING_LETTERS.y + j}`);
		x += letter.width + 2;
	}
	return out;
};

/** Total width of the word in tiles. */
export const LETTERS_WIDTH = 'IDLE'.split('').reduce((sum, ch) => sum + LETTERS[ch].width, 0) + 2 * 3;

const seeded = (seed: number) => {
	let a = (seed + 1) * 0x9e3779b1;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

/** Smooth value noise in 0..1 on a lattice of `cell` tiles. */
const makeNoise = (random: () => number, cell: number) => {
	const lattice = new Map<string, number>();
	const at = (i: number, j: number) => {
		const key = `${i},${j}`;
		let v = lattice.get(key);
		if (v === undefined) lattice.set(key, (v = random()));
		return v;
	};
	return (x: number, y: number) => {
		const fx = x / cell;
		const fy = y / cell;
		const i = Math.floor(fx);
		const j = Math.floor(fy);
		const u = fx - i;
		const v = fy - j;
		const s = (t: number) => t * t * (3 - 2 * t);
		const top = at(i, j) * (1 - s(u)) + at(i + 1, j) * s(u);
		const bottom = at(i, j + 1) * (1 - s(u)) + at(i + 1, j + 1) * s(u);
		return top * (1 - s(v)) + bottom * s(v);
	};
};

/** The landing world: a map of tiles, every one owned, ready for the terrain renderer. */
export const buildLandingWorld = (): World => {
	const { width, height, seed } = LANDING_WORLD;
	const random = seeded(seed);
	const moistBig = makeNoise(random, 12);
	const moistSmall = makeNoise(random, 5);
	const warmBig = makeNoise(random, 14);
	const warmSmall = makeNoise(random, 6);
	const patch = makeNoise(random, 4);
	const wobble = makeNoise(random, 5);
	const ponds = makeNoise(random, 7);
	const coastline = makeNoise(random, 6);
	const letters = letterTiles();
	const x0 = LANDING_LETTERS.x - 7;
	const x1 = LANDING_LETTERS.x + LETTERS_WIDTH + 7;
	const y0 = 0;
	const y1 = LANDING_LETTERS.y + LANDING_LETTERS.height + 6;
	// the snow plain the word stands on: a rectangle around the letters with a ragged edge, joined to the north edge so it is part of the mainland
	const snow = (x: number, y: number) => {
		const w = (wobble(x, y) - 0.5) * 7;
		return x > x0 + w && x < x1 + w && y >= y0 && y < y1 + w * 0.5;
	};
	// rivers: two run north to south either side of the word (through the snow and on through the woods), two short ones cross the snow below the letters (with a land bridge between them), one winds through the south
	const rivers = (x: number, y: number): number =>
		Math.min(
			Math.abs(x - (16 + Math.sin(y / 3.3) * 2)),
			Math.abs(x - (60 + Math.sin(y / 3.7 + 1) * 2)),
			y > 21 ? Math.abs(x - (36 + Math.sin(y / 3) * 4)) : 99,
			(x > 6 && x < 30) || (x > 44 && x < 68) ? Math.abs(y - (18 + Math.sin(x / 4.5) * 1.3)) : 99,
		);

	const ground: BiomeType[][] = [];
	for (let y = 0; y < height; y++) {
		const row: BiomeType[] = [];
		for (let x = 0; x < width; x++) {
			const edge = Math.min(x, width - 1 - x, height - 1 - y, y * 1.6); // thinner sea in the north: the land runs up to the top edge
			const sea = 1.5 + coastline(x, y) * 2.5;
			const m = moistBig(x, y) * 0.6 + moistSmall(x, y) * 0.4;
			const t = warmBig(x + 30, y) * 0.6 + warmSmall(x, y + 30) * 0.4;
			const p = patch(x + 70, y + 70);
			let biome: BiomeType = 'plains';
			if (t < 0.27) biome = 'tundra';
			else if (m > 0.7 && p > 0.35) biome = 'swamp';
			else if (m > 0.56 || p > 0.84) biome = 'forest';
			if (p < 0.16 && biome !== 'tundra') biome = 'plains'; // clearings inside the woods and bogs
			if (snow(x, y)) biome = 'tundra';
			const inSnow = snow(x, y);
			if (letters.has(`${x},${y}`)) biome = 'hills';
			else if (edge < sea) biome = 'lake';
			else if (y > 1 && ((rivers(x, y) < 0.45 + ponds(x, y) * 0.3 && wobble(x * 2.3 + 9, y * 2.3 + 9) > 0.3) || (!inSnow && ponds(x * 1.3 + 40, y * 1.3 + 40) > 0.8))) biome = 'lake';
			else if (!inSnow && patch(x * 1.7, y * 1.7) > 0.88) biome = 'hills';
			row.push(biome);
		}
		ground.push(row);
	}
	// no lone specks: a land tile with no neighbour of its own biome takes the commonest neighbour (letters and water stay as they are)
	const SIDES: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
	for (let pass = 0; pass < 2; pass++)
		for (let y = 1; y < height - 1; y++)
			for (let x = 1; x < width - 1; x++) {
				const mine = ground[y][x];
				if (mine === 'lake' || letters.has(`${x},${y}`)) continue;
				const around = SIDES.map(([dx, dy]) => ground[y + dy][x + dx]);
				if (around.includes(mine)) continue;
				const counts = new Map<BiomeType, number>();
				for (const b of around) if (b !== 'lake') counts.set(b, (counts.get(b) ?? 0) + 1);
				const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
				if (best) ground[y][x] = best[0];
			}
	// a beach on land next to water (not the hills of the letters)
	const isWater = (x: number, y: number) => ground[y]?.[x] === 'lake';
	const beaches: [number, number][] = [];
	for (let y = 1; y < height - 1; y++)
		for (let x = 1; x < width - 1; x++) {
			if (ground[y][x] === 'lake' || ground[y][x] === 'hills') continue;
			if (SIDES.some(([dx, dy]) => isWater(x + dx, y + dy)) && random() < 0.85) beaches.push([x, y]);
		}
	for (const [x, y] of beaches) ground[y][x] = 'coast';

	const changes: { x: number; y: number; tile: { biome: BiomeType; isOwned: boolean } }[] = [];
	for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) changes.push({ x, y, tile: { biome: ground[y][x], isOwned: true } });
	return setTiles(EMPTY_WORLD, changes);
};
