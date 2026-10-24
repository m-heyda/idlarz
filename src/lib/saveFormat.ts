import { GRID_HEIGHT, GRID_SIZE } from '@/config/gameConfig';
import { BASE_STAT_KEYS, PERSISTED_KEYS, sanitizeSave, type PersistedGame } from '@/lib/sanitizeSave';
import type { Tile } from '@/types/game';

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
 *   - `land` lists only the OWNED tiles (`{ x, y, biome, level?, building?, chest? }`), not the 50x50 grid;
 *   - level, activeChests, previousLevel, tile upgrade costs and combat stats are left out (rebuilt on load).
 *
 * ADDING THINGS LATER (keep old saves working):
 *   - A new field: add it to PERSISTED_KEYS, make `sanitizeSave` accept it as OPTIONAL with a default, and do
 *     nothing else. Old saves simply lack it. No version bump.
 *   - A renamed, moved or reinterpreted field, or removed content (an item, a building): bump SAVE_SCHEMA and add
 *     MIGRATIONS[oldVersion], which receives the old `s` and returns the new one. Never edit an old migration,
 *     and add a frozen save of the old version to tests/fixtures/saves (the fixture test loads every file there).
 *   - A save written by a NEWER schema than this game is refused with a clear message, never half-loaded.
 */

export const SAVE_SCHEMA = 1;
export const SAVE_PREFIX = 'IDLZ2.';

/** Longer than any real save by far; stops a pasted novel from freezing the page. */
const MAX_SAVE_CHARS = 3_000_000;

/** Values that are recomputed from the rest of the game on load, so they are not written. */
const NOT_WRITTEN = new Set<string>(['tiles', 'level', 'previousLevel', 'activeChests', 'characterStats']);

export type SaveBody = Record<string, unknown>;

/** Upgrades the `s` of schema N to schema N+1. */
export type Migration = (body: SaveBody) => SaveBody;

export const MIGRATIONS: Record<number, Migration> = {};

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

	const land: SaveBody[] = [];
	state.tiles.forEach((row, y) =>
		row.forEach((tile, x) => {
			if (!tile.isOwned) return;
			const entry: SaveBody = { x, y, biome: tile.biome };
			if (tile.level !== undefined) entry.level = tile.level;
			if (tile.building !== undefined) entry.building = tile.building;
			if (tile.hasChest) entry.chest = true;
			land.push(entry);
		})
	);
	body.land = land;
	return body;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Rebuilds the full grid that `sanitizeSave` validates. Returns an error text for a malformed `land` list. */
export const unpackBody = (body: SaveBody): { raw: SaveBody } | { error: string } => {
	if (!Array.isArray(body.land)) return { error: 'the land list is missing' };
	const tiles: Tile[][] = Array.from({ length: GRID_HEIGHT }, () =>
		Array.from({ length: GRID_SIZE }, (): Tile => ({ biome: 'empty', isOwned: false }))
	);
	for (const entry of body.land) {
		if (!isRecord(entry)) return { error: 'a land entry is not an object' };
		const { x, y, biome, level, building, chest } = entry;
		if (!Number.isInteger(x) || !Number.isInteger(y)) return { error: 'a land entry has no position' };
		const tx = x as number;
		const ty = y as number;
		if (tx < 0 || tx >= GRID_SIZE || ty < 0 || ty >= GRID_HEIGHT) return { error: 'a land entry is off the map' };
		if (typeof biome !== 'string') return { error: 'a land entry has no biome' };
		if (tiles[ty][tx].isOwned) return { error: 'two land entries share a tile' };
		const tile: Tile = { biome: biome as Tile['biome'], isOwned: true };
		if (level !== undefined) tile.level = level as number;
		if (building !== undefined) tile.building = building as string;
		if (chest === true) tile.hasChest = true;
		tiles[ty][tx] = tile;
	}
	const { land: _land, ...rest } = body;
	void _land;
	return { raw: { ...rest, tiles } };
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
