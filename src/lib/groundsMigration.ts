// Schema 3 -> 4: the Grounds biome is gone. It was the old building lot (a built Grounds tile carried `level: 2`); buildings stand
// on any biome now. An old Grounds tile becomes the biome the terrain already drew it as: the land biome most common among its
// 8 neighbours (a lake counts as coast, so a lakeside plot becomes sand); ties go to the earlier entry; no land around -> plains.
// Neighbours are read from the ORIGINAL map, so the result does not depend on the order the tiles are visited, and other Grounds
// tiles are not counted (as the old foundation rule did). Its building and chest stay; the `level: 2` marker goes.
//
// FROZEN like every migration: it does not read the live biome table (the letters below are the save format's biome letters).

type Body = Record<string, unknown>;

const isRecord = (v: unknown): v is Body => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Land biomes a Grounds tile can become, in tie-break order (hills, forest, tundra, swamp, plains, coast). */
const LETTERS = ['h', 'f', 't', 's', 'p', 'c'] as const;
const NAMES = ['hills', 'forest', 'tundra', 'swamp', 'plains', 'coast'] as const;

/** The index (into LETTERS / NAMES) of the biome a Grounds tile at (x, y) becomes; `at` gives the neighbour's letter. */
const pick = (at: (x: number, y: number) => string | undefined, x: number, y: number): number => {
	const counts = [0, 0, 0, 0, 0, 0];
	for (let dy = -1; dy <= 1; dy++) {
		for (let dx = -1; dx <= 1; dx++) {
			if (!dx && !dy) continue;
			const letter = at(x + dx, y + dy);
			const key = letter === 'l' ? 'c' : letter; // a lake counts as coast
			const i = LETTERS.findIndex((l) => l === key);
			if (i >= 0) counts[i]++;
		}
	}
	const best = Math.max(...counts);
	return best === 0 ? LETTERS.indexOf('p') : counts.indexOf(best);
};

/**
 * The packed save body (`land` runs `[y, x0, letters]` and `extra` entries `[x, y, props]`). A body that is not in that layout, or
 * has no Grounds tile, is returned as it is (unpackBody refuses a malformed one later).
 */
export const convertGroundsBody = (body: Body): Body => {
	const rows = body.land;
	if (!Array.isArray(rows)) return body;
	const letterAt = new Map<string, string>();
	let any = false;
	for (const row of rows) {
		if (!Array.isArray(row) || row.length !== 3 || !Number.isInteger(row[0]) || !Number.isInteger(row[1]) || typeof row[2] !== 'string') return body;
		const [y, x0, letters] = row as [number, number, string];
		for (let i = 0; i < letters.length; i++) {
			letterAt.set(`${x0 + i},${y}`, letters[i]);
			if (letters[i] === 'g') any = true;
		}
	}
	if (!any) return body;

	const at = (x: number, y: number) => letterAt.get(`${x},${y}`);
	const converted = new Set<string>();
	const land = (rows as [number, number, string][]).map(([y, x0, letters]) => {
		let out = '';
		for (let i = 0; i < letters.length; i++) {
			if (letters[i] !== 'g') {
				out += letters[i];
				continue;
			}
			converted.add(`${x0 + i},${y}`);
			out += LETTERS[pick(at, x0 + i, y)];
		}
		return [y, x0, out];
	});

	let extra = body.extra;
	if (Array.isArray(extra)) {
		extra = extra.flatMap((entry): unknown[] => {
			if (!Array.isArray(entry) || entry.length !== 3 || !isRecord(entry[2]) || !converted.has(`${entry[0]},${entry[1]}`)) return [entry];
			const { level: _level, ...rest } = entry[2];
			void _level;
			return Object.keys(rest).length ? [[entry[0], entry[1], rest]] : [];
		});
	}
	return { ...body, land, extra };
};

/**
 * The 50 x 50 grid of the first save formats (`tiles`: rows of `{ biome, isOwned, level?, building?, hasChest? }`, what the old
 * vault holds). Returns the same grid with every Grounds tile converted; anything that is not that layout is returned as it is.
 */
export const convertGroundsGrid = (tiles: unknown): unknown => {
	if (!Array.isArray(tiles) || !tiles.every((row) => Array.isArray(row))) return tiles;
	const rows = tiles as unknown[][];
	const isGrounds = (t: unknown) => isRecord(t) && t.biome === 'grounds';
	if (!rows.some((row) => row.some(isGrounds))) return tiles;
	const at = (x: number, y: number): string | undefined => {
		const t = rows[y]?.[x];
		if (!isRecord(t) || t.isOwned !== true) return undefined;
		const i = NAMES.findIndex((n) => n === t.biome);
		if (i >= 0) return LETTERS[i];
		return t.biome === 'lake' ? 'l' : undefined;
	};
	return rows.map((row, y) =>
		row.map((t, x) => {
			if (!isGrounds(t)) return t;
			const { level: _level, ...rest } = t as Body;
			void _level;
			return { ...rest, biome: NAMES[pick(at, x, y)] };
		})
	);
};
