// Test helpers: a store that never touches real storage, plus small builders.
(globalThis as unknown as { localStorage: unknown }).localStorage = {
	getItem: () => null,
	setItem: () => undefined,
	removeItem: () => undefined,
};

import { useGameStore } from '../src/stores/gameStore';
import { INITIAL_RESOURCES, GRID_CENTER_X, GRID_CENTER_Y } from '../src/config/gameConfig';
import { calculateResourceRates } from '../src/utils/gameUtils';
import { RING } from '../src/utils/biomeRules';
import type { Resources } from '../src/types/game';

useGameStore.persist.setOptions({
	storage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
});

export const store = useGameStore;
export const api = () => useGameStore.getState();

/**
 * The pre-ring start most economy tests were written for: the castle alone, one free tile. (A real new game owns the
 * castle and its 8 neighbours; that is covered in biomeSpawn.test.ts.)
 */
export const classicStart = () => {
	const s = api();
	const tiles = s.tiles.map((row) => [...row]);
	RING.forEach(([dx, dy]) => {
		tiles[GRID_CENTER_Y + dy][GRID_CENTER_X + dx] = { biome: 'empty', isOwned: false };
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

/** Buys tiles in a spiral next to the castle until `n` are owned (cheats the gold; resource costs are paid too). */
export const growTo = (n: number) => {
	let guard = 0;
	while (guard++ < 2000) {
		const s = api();
		const owned = s.tiles.flat().filter((t) => t.isOwned).length;
		if (owned >= n) return;
		setResources({
			gold: 1e12,
			wood: 1e12,
			stone: 1e12,
			coal: 1e12,
			food: 1e12,
			xp: s.resources.xp,
		});
		let target: [number, number] | null = null;
		let best = Infinity;
		s.tiles.forEach((row, y) =>
			row.forEach((tile, x) => {
				if (tile.isOwned) return;
				const adj = [
					[x - 1, y],
					[x + 1, y],
					[x, y - 1],
					[x, y + 1],
				].some(([ax, ay]) => s.tiles[ay]?.[ax]?.isOwned);
				if (!adj) return;
				const d = Math.abs(x - GRID_CENTER_X) + Math.abs(y - GRID_CENTER_Y);
				if (d < best) {
					best = d;
					target = [x, y];
				}
			})
		);
		if (!target) return;
		const [tx, ty] = target as [number, number];
		api().buyTile(tx, ty);
		if (api().biomeSelectionActive) api().selectBiome('plains');
	}
};

export const owned = () => api().tiles.flat().filter((t) => t.isOwned).length;
