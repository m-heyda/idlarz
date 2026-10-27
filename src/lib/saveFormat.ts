import { convertGroundsBody } from '@/lib/groundsMigration';
import { LEGACY_GEAR } from '@/lib/legacyGear';
import { BASE_STAT_KEYS, PERSISTED_KEYS, sanitizeSave, type PersistedGame } from '@/lib/sanitizeSave';
import { MAX_OWNED_TILES, inRange, ownedRowMajor, tileKey, type World } from '@/utils/world';

/**
 * The save format: one plain text line that is the same in browser storage and in an exported file.
 *
 *     IDLZ2.<base64 of the UTF-8 JSON>.<8 hex check code>
 *
 * The JSON is `{ v, t, s }`: `v` the schema version, `t` the time it was written (ms), `s` the game. The check code
 * only catches a copy that was cut off or mangled (it is not a secret); what keeps a hand-edited save honest is
 * `sanitizeSave`, which rejects anything the game cannot produce and recomputes everything derived.
 *
 * The game inside is stored compactly and without derived values:
 *   - the map is only the OWNED tiles, as runs: `land` is a list of `[y, x0, letters]` (one letter per biome, for the
 *     tiles x0, x0 + 1, ... of row y) and `extra` lists the tiles that carry more than a biome, `[x, y, { level?, building?,
 *     chest? }]`. A 50,000-tile map is about 60 KB of text. Coordinates may be negative.
 *   - level, activeChests, previousLevel, tile upgrade costs and combat stats are left out (rebuilt on load).
 * Schema 1 wrote `land` as one `{ x, y, biome, level?, building?, chest? }` object per tile (MIGRATIONS[1] converts it).
 * Schema 2 stored gear as bare item ids (`equipment: { head: 'steel_helm' }`, bag entries `{ id, qty }`); schema 3 stores item
 * instances (`{ base, level, rarity, quality, affixes }`, bag gear as `{ item }`) and MIGRATIONS[2] converts them (src/lib/legacyGear.ts).
 * Schema 3 could still hold Grounds tiles (the old building lot, letter `g`, built lots with `level: 2`); schema 4 has no Grounds biome and
 * MIGRATIONS[3] turns each into the land biome around it (src/lib/groundsMigration.ts).
 *
 * ADDING THINGS LATER (keep old saves working):
 *   - A new field: add it to PERSISTED_KEYS, make `sanitizeSave` accept it as OPTIONAL with a default, and do
 *     nothing else. Old saves simply lack it. No version bump.
 *   - A renamed, moved or reinterpreted field, or removed content (an item, a building): bump SAVE_SCHEMA and add
 *     MIGRATIONS[oldVersion], which receives the old `s` and returns the new one. Never edit an old migration,
 *     and add a frozen save of the old version to tests/fixtures/saves (the fixture test loads every file there).
 *   - A save written by a NEWER schema than this game is refused with a clear message, never half-loaded.
 */

export const SAVE_SCHEMA = 4;
export const SAVE_PREFIX = 'IDLZ2.';

/** Longer than any real save by far; stops a pasted novel from freezing the page. */
const MAX_SAVE_CHARS = 3_000_000;

/** Values that are recomputed from the rest of the game on load, so they are not written. */
const NOT_WRITTEN = new Set<string>(['tiles', 'level', 'previousLevel', 'activeChests', 'characterStats']);

export type SaveBody = Record<string, unknown>;

/** Upgrades the `s` of schema N to schema N+1. */
export type Migration = (body: SaveBody) => SaveBody;

/** One letter per biome in the compact land. Frozen: never change or reuse a letter (a test checks every biome has one). */
export const BIOME_CODES: Readonly<Record<string, string>> = {
	castle: 'K',
	grounds: 'g', // LEGACY: the biome is gone (schema 4) but the letter stays reserved: MIGRATIONS[1] and [3] still read it, and a v4 save with it is refused
	forest: 'f',
	plains: 'p',
	hills: 'h',
	swamp: 's',
	tundra: 't',
	lake: 'l',
	coast: 'c',
};
const CODE_BIOMES = new Map(Object.entries(BIOME_CODES).map(([biome, code]) => [code, biome]));

/** The map as it is written (see the header): runs per row plus the tiles with extras. */
export interface PackedLand {
	land: [number, number, string][];
	extra: [number, number, SaveBody][];
}

interface LandCell {
	x: number;
	y: number;
	biome: string;
	level?: unknown;
	building?: unknown;
	chest?: boolean;
}

/** Packs cells that are already ordered by row, then column. */
const packCells = (cells: Iterable<LandCell>): PackedLand => {
	const land: [number, number, string][] = [];
	const extra: [number, number, SaveBody][] = [];
	let runY = 0;
	let runX0 = 0;
	let runNext = 0;
	let letters = '';
	for (const cell of cells) {
		const code = BIOME_CODES[cell.biome];
		if (!code) throw new Error(`the biome ${cell.biome} has no save letter`);
		if (letters && cell.y === runY && cell.x === runNext) {
			letters += code;
			runNext++;
		} else {
			if (letters) land.push([runY, runX0, letters]);
			runY = cell.y;
			runX0 = cell.x;
			runNext = cell.x + 1;
			letters = code;
		}
		if (cell.level !== undefined || cell.building !== undefined || cell.chest) {
			const props: SaveBody = {};
			if (cell.level !== undefined) props.level = cell.level;
			if (cell.building !== undefined) props.building = cell.building;
			if (cell.chest) props.chest = true;
			extra.push([cell.x, cell.y, props]);
		}
	}
	if (letters) land.push([runY, runX0, letters]);
	return { land, extra };
};

const packedCache = new WeakMap<World, PackedLand>();

/** The map of a World in the save layout. Cached per World: autosaves that only change resources do not repack it. */
export const packLand = (world: World): PackedLand => {
	let packed = packedCache.get(world);
	if (!packed) {
		packed = packCells(
			(function* () {
				for (const { x, y, tile } of ownedRowMajor(world)) {
					yield { x, y, biome: tile.biome, level: tile.level, building: tile.building, chest: tile.hasChest };
				}
			})()
		);
		packedCache.set(world, packed);
	}
	return packed;
};

/** The instance an old save's bare item id stands for, or null when the id is not old gear. */
const legacyItem = (id: unknown): SaveBody | null => {
	if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(LEGACY_GEAR, id)) return null;
	const [rarity, level] = LEGACY_GEAR[id];
	return { base: id, level, rarity, quality: 50, affixes: [] };
};

export const MIGRATIONS: Record<number, Migration> = {
	// 1 -> 2: `land` was one object per tile; it is runs now. A body that is not a plain list of such objects is left as it
	// is, and unpackBody then refuses it.
	1: (body) => {
		const old = body.land;
		if (!Array.isArray(old)) return body;
		const cells: LandCell[] = [];
		for (const entry of old) {
			if (!isRecord(entry) || !Number.isInteger(entry.x) || !Number.isInteger(entry.y) || typeof entry.biome !== 'string' || !(entry.biome in BIOME_CODES)) {
				return body;
			}
			cells.push({ x: entry.x as number, y: entry.y as number, biome: entry.biome, level: entry.level, building: entry.building, chest: entry.chest === true });
		}
		cells.sort((a, b) => a.y - b.y || a.x - b.x);
		const { land, extra } = packCells(cells);
		return { ...body, land, extra };
	},
	// 2 -> 3: gear was an item id; it is an instance now (the rarity and level the item had, neutral quality, no affixes: the
	// same stats). Anything that is not plain old gear is left as it is, and sanitizeSave refuses it.
	2: (body) => {
		const next: SaveBody = { ...body };
		if (isRecord(body.equipment)) {
			const equipment: SaveBody = {};
			for (const [slot, id] of Object.entries(body.equipment)) equipment[slot] = legacyItem(id) ?? id;
			next.equipment = equipment;
		}
		if (Array.isArray(body.bag)) {
			next.bag = body.bag.map((entry) => {
				if (!isRecord(entry) || Object.keys(entry).length !== 2 || entry.qty !== 1) return entry;
				const item = legacyItem(entry.id);
				return item ? { item } : entry;
			});
		}
		return next;
	},
	// 3 -> 4: no more Grounds tiles (see groundsMigration.ts)
	3: (body) => convertGroundsBody(body),
};

export const migrateBody = (
	body: SaveBody,
	from: number,
	to: number = SAVE_SCHEMA,
	table: Record<number, Migration> = MIGRATIONS
): SaveBody => {
	let current = body;
	for (let v = from; v < to; v++) {
		const step = table[v];
		if (!step) throw new Error(`no migration from schema ${v}`);
		current = step(current);
	}
	return current;
};

// ---- text helpers ------------------------------------------------------------------------------------------

const toBase64 = (bytes: Uint8Array): string => {
	let binary = '';
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(binary);
};

const fromBase64 = (text: string): Uint8Array => {
	const binary = atob(text);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
};

/** FNV-1a, 32 bit: enough to notice a truncated or garbled copy. */
const checkCode = (text: string): string => {
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(16).padStart(8, '0');
};

// ---- game <-> compact body --------------------------------------------------------------------------------------

export const packBody = (state: PersistedGame): SaveBody => {
	const body: SaveBody = {};
	for (const key of PERSISTED_KEYS) if (!NOT_WRITTEN.has(key)) body[key] = state[key];

	const stats = state.characterStats as unknown as Record<string, number>;
	const characterStats: Record<string, number> = { availablePoints: stats.availablePoints };
	for (const key of BASE_STAT_KEYS) characterStats[key] = stats[key];
	body.characterStats = characterStats;

	const { land, extra } = packLand(state.tiles);
	body.land = land;
	body.extra = extra;
	return body;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const EXTRA_KEYS = new Set(['level', 'building', 'chest']);

/**
 * The body as `sanitizeSave` reads it: the runs are expanded to one `{ x, y, biome, level?, building?, chest? }` entry per
 * tile (sanitizeSave checks those: duplicates, the castle, connectivity, what a tile may carry). Only the layout is checked
 * here; a layout error is returned as text.
 */
export const unpackBody = (body: SaveBody): { raw: SaveBody } | { error: string } => {
	const rows = body.land;
	if (!Array.isArray(rows)) return { error: 'the land list is missing' };
	const entries: SaveBody[] = [];
	const byKey = new Map<number, SaveBody>();
	for (const row of rows) {
		if (!Array.isArray(row) || row.length !== 3) return { error: 'a land row is malformed' };
		const [y, x0, letters] = row;
		if (!Number.isInteger(y) || !Number.isInteger(x0) || typeof letters !== 'string' || letters.length === 0) {
			return { error: 'a land row is malformed' };
		}
		if (entries.length + letters.length > MAX_OWNED_TILES) return { error: 'too many tiles' };
		if (!inRange(x0, y) || !inRange(x0 + letters.length - 1, y)) return { error: 'a land row is off the map' };
		for (let i = 0; i < letters.length; i++) {
			const biome = CODE_BIOMES.get(letters[i]);
			if (!biome) return { error: 'a land row has an unknown biome letter' };
			const entry: SaveBody = { x: x0 + i, y, biome };
			entries.push(entry);
			byKey.set(tileKey(x0 + i, y), entry);
		}
	}
	const extra = body.extra === undefined ? [] : body.extra;
	if (!Array.isArray(extra)) return { error: 'the extra list is malformed' };
	for (const item of extra) {
		if (!Array.isArray(item) || item.length !== 3 || !isRecord(item[2])) return { error: 'an extra entry is malformed' };
		const [x, y, props] = item;
		if (!Number.isInteger(x) || !Number.isInteger(y) || !inRange(x, y)) return { error: 'an extra entry is off the map' };
		const entry = byKey.get(tileKey(x, y));
		if (!entry) return { error: 'an extra entry is for a tile that is not there' };
		for (const [key, value] of Object.entries(props)) {
			if (!EXTRA_KEYS.has(key)) return { error: 'an extra entry has an unknown key' };
			entry[key] = value;
		}
	}
	const { land: _land, extra: _extra, ...rest } = body;
	void _land;
	void _extra;
	return { raw: { ...rest, land: entries } };
};

// ---- encode / decode ---------------------------------------------------------------------------------------------

/** Wraps any `{ v, t, s }` object as save text. Only encodeSave and tests (older / newer schemas) need this. */
export const sealWire = (wire: unknown): string => {
	const payload = toBase64(new TextEncoder().encode(JSON.stringify(wire)));
	return `${SAVE_PREFIX}${payload}.${checkCode(payload)}`;
};

export const encodeSave = (state: PersistedGame, now: number = Date.now()): string =>
	sealWire({ v: SAVE_SCHEMA, t: now, s: packBody(state) });

export type DecodeResult =
	| { ok: true; state: PersistedGame; savedAt: number | null; schema: number }
	| { ok: false; reason: string };

const bad = (reason: string): DecodeResult => ({ ok: false, reason });

/** Everything that can go wrong with a pasted or stored save becomes a readable reason, never an exception. */
export const decodeSave = (
	text: string,
	/** Tests run a different schema / migration table; the game always uses the defaults. */
	{ schema: current = SAVE_SCHEMA, migrations = MIGRATIONS }: { schema?: number; migrations?: Record<number, Migration> } = {}
): DecodeResult => {
	// Pasting often adds line breaks, spaces or quotes around the text
	const clean = text.replace(/\s+/g, '').replace(/^["'`]+|["'`]+$/g, '');
	if (clean.length > MAX_SAVE_CHARS) return bad('This text is far too long to be a save.');
	if (!clean.startsWith(SAVE_PREFIX)) return bad('This is not an idlarz save (it should start with IDLZ2.).');

	const rest = clean.slice(SAVE_PREFIX.length);
	const dot = rest.lastIndexOf('.');
	const payload = dot < 0 ? '' : rest.slice(0, dot);
	if (!payload || checkCode(payload) !== rest.slice(dot + 1)) {
		return bad('The save text is damaged or was cut off. Copy it again completely.');
	}

	let wire: unknown;
	try {
		wire = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(fromBase64(payload)));
	} catch {
		return bad('The save text is damaged and cannot be read.');
	}
	if (!isRecord(wire) || !Number.isInteger(wire.v) || (wire.v as number) < 1 || !isRecord(wire.s)) {
		return bad('The save has an unknown layout.');
	}
	const schema = wire.v as number;
	if (schema > current) return bad('This save was made by a newer version of the game. Update the game first.');

	let body: SaveBody;
	try {
		body = migrateBody(wire.s, schema, current, migrations);
	} catch {
		return bad('This save is too old to be upgraded.');
	}
	const unpacked = unpackBody(body);
	if ('error' in unpacked) return bad(`The save contains impossible data (${unpacked.error}).`);

	const result = sanitizeSave(unpacked.raw);
	if (!result.ok) return bad(`The save contains impossible data (${result.reason}).`);
	return {
		ok: true,
		state: result.state,
		savedAt: typeof wire.t === 'number' && Number.isFinite(wire.t) ? wire.t : null,
		schema,
	};
};
