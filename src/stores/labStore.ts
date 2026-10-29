import { create } from 'zustand';
import { BIOMES, CASTLE_UPGRADE, CASTLE_X, CASTLE_Y, INITIAL_CHARACTER_STATS } from '@/config/gameConfig';
import type { MapGameState } from '@/components/game/mapSource';
import type { Cell } from '@/lib/dragPaint';
import { applyStroke, chestTool, eraseTool, extendRing, extendTool, paintTool, unchestTool, type StrokeTool } from '@/lib/mapEdit';
import { castleDistance, monsterAt, pickSpawnTile, rollSpawnLevel } from '@/lib/monsters';
import { castleLevelOf, isInWard } from '@/lib/castleWard';
import { MONSTER_CATALOG } from '@/catalog/monsters';
import type { Monster } from '@/types/game';
import { calculateCombatStats, createInitialWorld, EMPTY_PRESTIGE, STARTER_FREE_TILES, startingResources } from '@/utils/gameUtils';
import { growWorld } from '@/utils/growWorld';
import { createWorld, getTile, ownedEntries, patchTile, setTiles, type World } from '@/utils/world';

/**
 * The map lab's world: simulated, in memory, never saved and never sent anywhere. It has the same shape the map components
 * read from the game store (MapGameState), so they run on it unchanged.
 */

export type LabTool = 'pan' | 'paint' | 'extend' | 'erase' | 'chest' | 'unchest' | 'rat' | 'ratKing' | 'dismiss';

/** The tools that draw while the button is held (the others act on a click). */
export const STROKE_TOOLS: readonly LabTool[] = ['paint', 'extend', 'erase', 'chest', 'unchest'];

export type LabPreset = 'start' | 'rolled60' | 'rolled400' | 'showcase' | 'landmarks';

/** The biomes a tile can be painted with (everything but the empty placeholder and the castle, which is fixed). */
export const PAINT_BIOMES = Object.keys(BIOMES).filter((b) => b !== 'empty' && b !== 'castle');

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

export const presetWorld = (preset: LabPreset, seed: number): World => {
	switch (preset) {
		case 'rolled60':
			return growWorld(60, seed);
		case 'rolled400':
			return growWorld(400, seed);
		case 'showcase':
			return showcaseWorld();
		case 'landmarks':
			return landmarksWorld();
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
	seed: number;
	history: World[];
	nextId: number;

	setTool: (tool: LabTool) => void;
	setBiome: (biome: string) => void;
	setBrush: (brush: number) => void;
	setMonsterLevel: (level: number) => void;
	setLucky: (lucky: boolean) => void;
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
		seed: 1,
		history: [],
		nextId: 1,

		setTool: (tool) => set({ tool }),
		setBiome: (biome) => set({ biome, tool: get().tool === 'pan' ? 'paint' : get().tool }),
		setBrush: (brush) => set({ brush }),
		setMonsterLevel: (monsterLevel) => set({ monsterLevel: Math.max(1, Math.round(monsterLevel) || 1) }),
		setLucky: (lucky) => set({ lucky }),
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
			if (tool !== 'rat' && tool !== 'ratKing') return;
			const without = monsters.filter((m) => !(m.x === x && m.y === y));
			if (monsterAt(monsters, x, y) && monsterAt(monsters, x, y)!.type === tool) {
				set({ monsters: without }); // clicking the same kind again takes it away
				return;
			}
			const monster: Monster = { id: nextId, type: tool, level: monsterLevel, spawnLevel: monsterLevel, x, y, ageSec: 0, lucky: lucky || undefined };
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
				({ x, y, tile }) =>
					tile.biome === entry.biomes[0] && !tile.building && !tile.hasChest && !taken.has(`${x},${y}`) && !isInWard(x, y, castleLevel)
			);
			for (let i = 0; i < count && eligible.length; i++) {
				const { x, y } = eligible.splice(Math.floor(random() * eligible.length), 1)[0];
				monsters = [...monsters, { id: nextId, type: 'rat', level: monsterLevel, spawnLevel: monsterLevel, x, y, ageSec: 0, art: id }];
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
