// Test helpers: a store that never touches real storage, plus small builders.
(globalThis as unknown as { localStorage: unknown }).localStorage = {
	getItem: () => null,
	setItem: () => undefined,
	removeItem: () => undefined,
};

import { useGameStore } from '../src/stores/gameStore';
import { INITIAL_RESOURCES, CASTLE_X, CASTLE_Y, LEGACY_GRID_SIZE } from '../src/config/gameConfig';
import { calculateResourceRates } from '../src/utils/gameUtils';
import { RING } from '../src/utils/biomeRules';
import { pickPersisted } from '../src/lib/sanitizeSave';
import { hasOwnedNeighbour, isOwnedAt, ownedBounds, ownedCount, patchTile, setTile, worldToRows, type World } from '../src/utils/world';
import type { Resources, Tile } from '../src/types/game';

export { tileAt, worldFromRows } from '../src/utils/world';

useGameStore.persist.setOptions({
	storage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
});

export const store = useGameStore;

/** Shows a fight as open (the server's picture of one: what the store keeps in `combat.fight`). */
export const openFight = (patch: Partial<NonNullable<ReturnType<typeof useGameStore.getState>['combat']['fight']>> = {}) =>
	useGameStore.setState((s) => ({
		combat: { ...s.combat, fight: { n: 1, type: 'rat', level: 1, lucky: false, monsterHp: 10, monsterMaxHp: 10, stunLeft: 0, timeLeftSec: null, x: 0, y: 0, ...patch } },
	}));
export const closeFight = () => useGameStore.setState((s) => ({ combat: { ...s.combat, fight: null } }));
export const api = () => useGameStore.getState();

/** The 50 x 50 rows the map used to be stored as (a fresh copy): for tests that scan or build the map row by row. */
export const rowsOf = (tiles: World): Tile[][] => worldToRows(tiles, 0, 0, LEGACY_GRID_SIZE, LEGACY_GRID_SIZE);

/** Every tile with its position, in the old row-major order, owned or not. */
export const gridCells = (tiles: World = api().tiles) =>
	rowsOf(tiles).flatMap((row, y) => row.map((t, x) => ({ t, x, y })));

/** Merges `patch` into the tile at (x, y) of the game. */
export const patchTileAt = (x: number, y: number, patch: Partial<Tile>) =>
	useGameStore.setState((s) => ({ tiles: patchTile(s.tiles, x, y, patch) }));

/**
 * The pre-ring start most economy tests were written for: the castle alone, one free tile. (A real new game owns the
 * castle and its 4 neighbours; that is covered in biomeSpawn.test.ts.)
 */
const classicStart = () => {
	const s = api();
	let tiles = s.tiles;
	RING.forEach(([dx, dy]) => {
		tiles = setTile(tiles, CASTLE_X + dx, CASTLE_Y + dy, undefined);
	});
	useGameStore.setState({
		tiles,
		freeTiles: 1,
		resourceRates: calculateResourceRates(tiles, s.characterStats, s.farmLevels, s.prestige),
	});
};

/** Fresh game (castle only, see classicStart), optionally with extra resources. */
export const freshGame = (extra: Partial<Resources> = {}) => {
	api().resetGame();
	classicStart();
	if (Object.keys(extra).length) {
		const r = { ...INITIAL_RESOURCES, ...extra };
		useGameStore.setState({ resources: r });
	}
	return api();
};

export const setResources = (r: Partial<Resources>) =>
	useGameStore.setState((s) => ({ resources: { ...s.resources, ...r } }));

/** The tile that is bought next by growTo: the unexplored neighbour of the land closest to the castle (ties: first row, then column). */
const nextFrontier = (tiles: World): [number, number] | null => {
	const b = ownedBounds(tiles);
	if (!b) return null;
	let target: [number, number] | null = null;
	let best = Infinity;
	for (let y = Math.max(0, b.minY - 1); y <= Math.min(LEGACY_GRID_SIZE - 1, b.maxY + 1); y++) {
		for (let x = Math.max(0, b.minX - 1); x <= Math.min(LEGACY_GRID_SIZE - 1, b.maxX + 1); x++) {
			if (isOwnedAt(tiles, x, y) || !hasOwnedNeighbour(tiles, x, y)) continue;
			const d = Math.abs(x - CASTLE_X) + Math.abs(y - CASTLE_Y);
			if (d < best) {
				best = d;
				target = [x, y];
			}
		}
	}
	return target;
};

/** Buys tiles in a spiral next to the castle until `n` are owned (cheats the gold; resource costs are paid too). */
export const growTo = (n: number) => {
	let guard = 0;
	while (guard++ < 2000) {
		const s = api();
		if (ownedCount(s.tiles) >= n) return;
		setResources({
			gold: 1e12,
			wood: 1e12,
			stone: 1e12,
			coal: 1e12,
			food: 1e12,
			hide: 1e12, // big territories (from 120 tiles) also cost hide
			xp: s.resources.xp,
		});
		const target = nextFrontier(s.tiles);
		if (!target) return;
		api().buyTile(target[0], target[1]);
	}
};

export const owned = () => ownedCount(api().tiles);

/** A plain JSON copy of the persisted game with the map in the 50 x 50 layout of the first save formats: what sanitizeSave reads. */
export const rawSnapshot = (state = api()) =>
	JSON.parse(JSON.stringify({ ...pickPersisted(state), tiles: rowsOf(state.tiles) }));
