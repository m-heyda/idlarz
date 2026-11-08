import { create } from 'zustand';
import { isLiveBiome } from '@/config/biomeStage';
import { BIOMES } from '@/config/biomes';
import { CASTLE_UPGRADE, CASTLE_X, CASTLE_Y } from '@/config/castle';
import { INITIAL_CHARACTER_STATS } from '@/config/character';
import type { MapGameState } from '@/components/game/mapSource';
import type { Cell } from '@/lib/dragPaint';
import { applyStroke, chestTool, eraseTool, extendRing, extendTool, paintTool, unchestTool, type StrokeTool } from '@/lib/mapEdit';
import { castleDistance } from '@/lib/distance';
import { monsterAt, pickSpawnTile, rollSpawnLevel } from '@/lib/monsters';
import { castleLevelOf, isInWard } from '@/lib/castleWard';
import { MONSTER_CATALOG } from '@/catalog/monsters';
import { MONSTERS } from '@/config/combatConfig';
import type { Monster, MonsterType } from '@/types/game';
import { calculateCombatStats } from '@/utils/game/character';
import { createInitialWorld, STARTER_FREE_TILES } from '@/utils/game/tiles';
import { EMPTY_PRESTIGE, startingResources } from '@/utils/game/rebirth';
import { growWorld } from '@/utils/growWorld';
import { createWorld, getTile, ownedEntries, patchTile, setTiles, type World } from '@/utils/world';

/**
 * The map lab's world: simulated, in memory, never saved and never sent anywhere. It has the same shape the map components
 * read from the game store (MapGameState), so they run on it unchanged.
 */

export type LabTool = 'pan' | 'paint' | 'extend' | 'erase' | 'chest' | 'unchest' | 'monster' | 'boss' | 'dismiss';

/** The tools that draw while the button is held (the others act on a click). */
export const STROKE_TOOLS: readonly LabTool[] = ['paint', 'extend', 'erase', 'chest', 'unchest'];

export type LabPreset = 'start' | 'rolled60' | 'rolled400' | 'showcase' | 'landmarks' | 'devBlocks' | 'devMap';

/** The biomes a tile can be painted with (everything but the empty placeholder and the castle, which is fixed): the live ones first, then the dev-only ones (config/biomeStage.ts). */
export const PAINT_BIOMES = Object.keys(BIOMES)
	.filter((b) => b !== 'empty' && b !== 'castle')
	.sort((a, b) => Number(!isLiveBiome(a)) - Number(!isLiveBiome(b)));
/** The dev-only biomes (config/biomeStage.ts), in the order the lab lists them. */
export const DEV_PAINT_BIOMES = PAINT_BIOMES.filter((b) => !isLiveBiome(b));

const HISTORY_LIMIT = 60;

const seededRandom = (seed: number) => {
	let a = seed >>> 0 || 1;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

/** One block of each biome side by side, so every ground style can be compared at once. */
const showcaseWorld = (): World => {
	const base = createInitialWorld(seededRandom(1));
	const size = 4;
	const changes: { x: number; y: number; tile: { biome: string; isOwned: true } }[] = [];
	PAINT_BIOMES.forEach((biome, i) => {
		const x0 = CASTLE_X + 2 + (i % 4) * size;
		const y0 = CASTLE_Y - 1 + Math.floor(i / 4) * size;
		for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) changes.push({ x: x0 + dx, y: y0 + dy, tile: { biome, isOwned: true } });
	});
	return setTiles(base, changes);
};

/** A 6x6 block of each biome with a tile between them: each one is exactly the luck a landmark needs (a 5x5 block would get none). */
const landmarksWorld = (): World => {
	const base = createInitialWorld(seededRandom(1));
	const size = 6;
	const changes: { x: number; y: number; tile: { biome: string; isOwned: true } }[] = [];
	PAINT_BIOMES.forEach((biome, i) => {
		const x0 = CASTLE_X + 2 + (i % 4) * (size + 1);
		const y0 = CASTLE_Y - 1 + Math.floor(i / 4) * (size + 1);
		for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) changes.push({ x: x0 + dx, y: y0 + dy, tile: { biome, isOwned: true } });
	});
	return setTiles(base, changes);
};

/** The dev-only biomes as 9x9 blocks in a row, each with a plains and a forest block under it, to judge the grounds, rims and props one by one. */
const devBlocksWorld = (): World => {
	const base = createInitialWorld(seededRandom(1));
	const size = 9;
	const changes: { x: number; y: number; tile: { biome: string; isOwned: true } }[] = [];
	DEV_PAINT_BIOMES.forEach((biome, i) => {
		const x0 = CASTLE_X + 3 + i * (size + 1);
		for (let dy = 0; dy < size * 2; dy++) {
			const below = dy >= size;
			for (let dx = 0; dx < size; dx++) {
				const b = below ? (i % 2 ? 'forest' : 'plains') : biome;
				changes.push({ x: x0 + dx, y: CASTLE_Y - 4 + dy, tile: { biome: b, isOwned: true } });
			}
		}
	});
	return setTiles(base, changes);
};

/** Seeds of the comparison map: (kind, x, y) in tiles from the castle. Nearest seed (with a little noise) wins; no forbidden pair touches (docs/plan/12-rebirth-biomes.md section 9). */
const DEV_MAP_SEEDS: [string, number, number][] = [
	['tundra', -30, -17],
	['hills', -12, -19],
	['blight', 10, -18],
	['battlefield', 28, -16],
	['plains', 2, -5],
	['plains', -30, -3],
	['forest', -16, -1],
	['fields', 14, 1],
	['orchard', 28, 3],
	['jungle', -16, 16],
	['lake', -31, 16],
	['swamp', 33, 18],
	['hills', 6, 18],
	['plains', 18, 19],
	['forest', -4, 9],
];

/** One island with every biome, the dev-only ones beside the live ones, to compare the art direction. A beach rings the lake. */
const devMapWorld = (): World => {
	const base = createInitialWorld(seededRandom(1));
	const rx = 37;
	const ry = 24;
	const noise = (x: number, y: number, k: number) => (Math.imul((x * 73856093) ^ (y * 19349663) ^ (k * 83492791), 2654435761) >>> 0) / 4294967296;
	const kind = (x: number, y: number): string | null => {
		if ((x / rx) ** 2 + (y / ry) ** 2 + (noise(x, y, 9) - 0.5) * 0.08 > 1) return null;
		let best = '';
		let bestD = Infinity;
		for (const [b, sx, sy] of DEV_MAP_SEEDS) {
			const d = (sx - x) ** 2 + (sy - y) ** 2 + noise(x, y, sx * 31 + sy) * 50;
			if (d < bestD) {
				bestD = d;
				best = b;
			}
		}
		return best;
	};
	const kinds = new Map<string, string>();
	for (let y = -ry; y <= ry; y++)
		for (let x = -rx; x <= rx; x++) {
			const k = kind(x, y);
			if (k) kinds.set(`${x},${y}`, k);
		}
	const changes: { x: number; y: number; tile: { biome: string; isOwned: true } }[] = [];
	for (const [key, k] of kinds) {
		const [x, y] = key.split(',').map(Number);
		if (Math.max(Math.abs(x), Math.abs(y)) <= 1) continue; // the castle and its start ring stay
		let biome = k;
		if (['plains', 'forest'].includes(k))
			for (let dy = -2; dy <= 2 && biome === k; dy++)
				for (let dx = -2; dx <= 2; dx++)
					if (kinds.get(`${x + dx},${y + dy}`) === 'lake') {
						biome = 'coast';
						break;
					}
		changes.push({ x: CASTLE_X + x, y: CASTLE_Y + y, tile: { biome, isOwned: true } });
	}
	return setTiles(base, changes);
};

const presetWorld = (preset: LabPreset, seed: number): World => {
	switch (preset) {
		case 'rolled60':
			return growWorld(60, seed);
		case 'rolled400':
			return growWorld(400, seed);
		case 'showcase':
			return showcaseWorld();
		case 'landmarks':
			return landmarksWorld();
		case 'devBlocks':
			return devBlocksWorld();
		case 'devMap':
			return devMapWorld();
		default:
			return createInitialWorld(seededRandom(seed));
	}
};

interface LabState extends MapGameState {
	tool: LabTool;
	biome: string;
	brush: number;
	monsterLevel: number;
	lucky: boolean;
	/** Roster id shown in the combat preview (the game's combat window with a mock fight), or null when it is closed */
	combatPreview: string | null;
	seed: number;
	history: World[];
	nextId: number;

	setTool: (tool: LabTool) => void;
	setBiome: (biome: string) => void;
	setBrush: (brush: number) => void;
	setMonsterLevel: (level: number) => void;
	setLucky: (lucky: boolean) => void;
	setCombatPreview: (id: string | null) => void;
	setSeed: (seed: number) => void;
	/** Remembers the world so Undo can come back to it (a stroke calls it once, on its first cell). */
	snapshot: () => void;
	undo: () => void;
	/** The cells of a stroke, drawn with the active tool. */
	drawCells: (cells: readonly Cell[]) => void;
	/** A click with a tool that acts on one tile (monsters). */
	clickTile: (x: number, y: number) => void;
	reset: (preset: LabPreset) => void;
	extendRing: () => void;
	setCastleLevel: (level: number) => void;
	spawnChests: (count: number) => void;
	spawnMonsters: (type: Monster['type'], count: number) => void;
	/** Work-in-progress roster monsters (art only, no stats yet) placed on tiles of their own biome, at the placed monster level */
	spawnWip: (id: string, count: number) => void;
	clearMonsters: () => void;
	clearChests: () => void;
	exportJson: () => string;
	importJson: (json: string) => boolean;
}

const strokeTool = (tool: LabTool, biome: string): StrokeTool | null => {
	switch (tool) {
		case 'paint':
			return paintTool(biome);
		case 'extend':
			return extendTool(biome);
		case 'erase':
			return eraseTool;
		case 'chest':
			return chestTool;
		case 'unchest':
			return unchestTool;
		default:
			return null;
	}
};

/** A random free land tile for a lab chest. The lab's own plain pick: the game's weighted chest placement stays on the server. */
const freeSpot = (world: World, taken: ReadonlySet<string>, random: () => number): Cell | null => {
	const free = ownedEntries(world).filter(({ x, y, tile }) => tile.biome !== 'castle' && !tile.hasChest && !tile.building && !taken.has(`${x},${y}`));
	if (!free.length) return null;
	const { x, y } = free[Math.floor(random() * free.length)];
	return { x, y };
};

const takenSpots = (world: World, monsters: readonly Monster[]): Set<string> => {
	const taken = new Set(monsters.map((m) => `${m.x},${m.y}`));
	for (const { x, y, tile } of ownedEntries(world)) if (tile.hasChest) taken.add(`${x},${y}`);
	return taken;
};

const stats = { ...INITIAL_CHARACTER_STATS };
Object.assign(stats, calculateCombatStats(stats));

export const useLabStore = create<LabState>((set, get) => {
	const setWorld = (tiles: World) => set({ tiles });
	return {
		tiles: createInitialWorld(seededRandom(1)),
		monsters: [],
		resources: startingResources(EMPTY_PRESTIGE),
		characterStats: stats,
		prestige: EMPTY_PRESTIGE,
		merchantUpgrades: {},
		freeTiles: STARTER_FREE_TILES,
		castleUpgrade: null,
		// the game's own actions never run in the lab: a click goes to `clickTile`
		buyTile: () => false,
		collectChest: () => false,
		startFight: () => false,

		tool: 'paint',
		biome: 'forest',
		brush: 1,
		monsterLevel: 3,
		lucky: false,
		combatPreview: null,
		seed: 1,
		history: [],
		nextId: 1,

		setTool: (tool) => set({ tool }),
		setBiome: (biome) => set({ biome, tool: get().tool === 'pan' ? 'paint' : get().tool }),
		setBrush: (brush) => set({ brush }),
		setMonsterLevel: (monsterLevel) => set({ monsterLevel: Math.max(1, Math.round(monsterLevel) || 1) }),
		setLucky: (lucky) => set({ lucky }),
		setCombatPreview: (combatPreview) => set({ combatPreview }),
		setSeed: (seed) => set({ seed: Math.round(seed) || 1 }),

		snapshot: () => set((s) => ({ history: [...s.history.slice(-(HISTORY_LIMIT - 1)), s.tiles] })),
		undo: () => {
			const { history } = get();
			if (!history.length) return;
			set({ tiles: history[history.length - 1], history: history.slice(0, -1) });
		},

		drawCells: (cells) => {
			const { tool, biome, tiles, monsters } = get();
			const apply = strokeTool(tool, biome);
			if (!apply) return;
			const next = applyStroke(tiles, cells, apply);
			if (next === tiles) return;
			// a monster never outlives its tile
			const alive = monsters.filter((m) => !!getTile(next, m.x, m.y));
			set({ tiles: next, monsters: alive.length === monsters.length ? monsters : alive });
		},

		clickTile: (x, y) => {
			const { tool, tiles, monsters, monsterLevel, lucky, nextId } = get();
			if (!getTile(tiles, x, y)) return;
			if (tool === 'dismiss') {
				set({ monsters: monsters.filter((m) => !(m.x === x && m.y === y)) });
				return;
			}
			if (tool !== 'monster' && tool !== 'boss') return;
			const type: MonsterType = tool === 'boss' ? 'bossGreatAuroch' : 'thistleBoar';
			const without = monsters.filter((m) => !(m.x === x && m.y === y));
			if (monsterAt(monsters, x, y) && monsterAt(monsters, x, y)!.type === type) {
				set({ monsters: without }); // clicking the same kind again takes it away
				return;
			}
			const monster: Monster = { id: nextId, type, level: monsterLevel, spawnLevel: monsterLevel, x, y, ageSec: 0, lucky: lucky || undefined };
			set({ monsters: [...without, monster], nextId: nextId + 1 });
		},

		reset: (preset) => {
			get().snapshot();
			set({ tiles: presetWorld(preset, get().seed), monsters: [] });
		},
		extendRing: () => {
			get().snapshot();
			setWorld(extendRing(get().tiles, get().biome));
		},
		setCastleLevel: (level) => {
			const max = CASTLE_UPGRADE.maxLevel;
			setWorld(patchTile(get().tiles, CASTLE_X, CASTLE_Y, { level: Math.max(1, Math.min(max, Math.round(level) || 1)) }));
		},

		spawnChests: (count) => {
			get().snapshot();
			let { tiles } = get();
			const random = seededRandom(get().seed + tiles.stats.chests * 7919);
			const taken = takenSpots(tiles, get().monsters);
			for (let i = 0; i < count; i++) {
				const spot = freeSpot(tiles, taken, random);
				if (!spot) break;
				taken.add(`${spot.x},${spot.y}`);
				tiles = patchTile(tiles, spot.x, spot.y, { hasChest: true });
			}
			setWorld(tiles);
		},
		spawnMonsters: (type, count) => {
			const { tiles, seed } = get();
			let monsters = get().monsters;
			let nextId = get().nextId;
			const random = seededRandom(seed + nextId * 104729);
			const taken = takenSpots(tiles, monsters);
			const level = castleLevelOf(tiles);
			for (let i = 0; i < count; i++) {
				const spot = pickSpawnTile(type, tiles, taken, random);
				if (!spot) break;
				taken.add(`${spot.x},${spot.y}`);
				const lvl = rollSpawnLevel(type, level, nextId, castleDistance(spot));
				monsters = [...monsters, { id: nextId, type, level: lvl, spawnLevel: lvl, x: spot.x, y: spot.y, ageSec: 0 }];
				nextId += 1;
			}
			set({ monsters, nextId });
		},
		spawnWip: (id, count) => {
			const entry = MONSTER_CATALOG.find((m) => m.id === id);
			if (!entry) return;
			const { tiles, seed, monsterLevel } = get();
			let monsters = get().monsters;
			let nextId = get().nextId;
			const random = seededRandom(seed + nextId * 104729);
			const taken = takenSpots(tiles, monsters);
			const castleLevel = castleLevelOf(tiles);
			// the monster's own biome (its art folder), clear of the castle ward, buildings, chests and other monsters
			const eligible = ownedEntries(tiles).filter(
				({ x, y, tile }) => tile.biome === entry.biomes[0] && !tile.building && !tile.hasChest && !taken.has(`${x},${y}`) && !isInWard(x, y, castleLevel),
			);
			for (let i = 0; i < count && eligible.length; i++) {
				const { x, y } = eligible.splice(Math.floor(random() * eligible.length), 1)[0];
				monsters = [
					...monsters,
					{ id: nextId, type: (id in MONSTERS ? id : 'thistleBoar') as MonsterType, level: monsterLevel, spawnLevel: monsterLevel, x, y, ageSec: 0, art: id },
				];
				nextId += 1;
			}
			set({ monsters, nextId });
		},
		clearMonsters: () => set({ monsters: [] }),
		clearChests: () => {
			get().snapshot();
			const changes = ownedEntries(get().tiles)
				.filter((e) => e.tile.hasChest)
				.map(({ x, y, tile }) => {
					const rest = { ...tile };
					delete rest.hasChest;
					return { x, y, tile: rest };
				});
			setWorld(setTiles(get().tiles, changes));
		},

		exportJson: () =>
			JSON.stringify({
				kind: 'idlarz-map-lab',
				version: 1,
				tiles: ownedEntries(get().tiles).map(({ x, y, tile }) => ({ x, y, tile })),
				monsters: get().monsters,
			}),
		importJson: (json) => {
			try {
				const data = JSON.parse(json);
				if (data?.kind !== 'idlarz-map-lab' || !Array.isArray(data.tiles)) return false;
				const world = createWorld(data.tiles);
				if (!world.bounds) return false;
				const monsters: Monster[] = Array.isArray(data.monsters) ? data.monsters : [];
				get().snapshot();
				set({ tiles: world, monsters, nextId: monsters.reduce((n, m) => Math.max(n, m.id + 1), 1) });
				return true;
			} catch {
				return false;
			}
		},
	};
});
