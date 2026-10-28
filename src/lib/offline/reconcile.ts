import { castleLevelOf } from '@/lib/castleWard';
import { pickChestSpot } from '@/lib/chests';
import type { LimitContext } from '@/lib/limits';
import { levelAtAge } from '@/lib/monsters';
import type { PublicTickets } from '@/lib/offline/types';
import type { Rng } from '@/lib/rng';
import type { Monster } from '@/types/game';
import { ownedRowMajor, patchTile, type World } from '@/utils/world';

// Makes the map match the server's tickets. The server decides which chests and monsters exist, what is inside them and, for a monster,
// the tile it stands on and the level it appeared at: the browser draws exactly that (and shows the age the server gave). Only a chest's
// tile is still the browser's choice.

export interface ReconcileInput {
	tiles: World;
	monsters: Monster[];
	activeChests: number;
}

export interface ReconcileResult {
	tiles: World;
	monsters: Monster[];
	activeChests: number;
	/** What changed on the map: for the welcome-back window */
	placed: { chests: number; monsters: number; strongestLevel: number };
	removed: { chests: number; monsters: number };
}

/**
 * - every monster the server lists stands where the server says, at the level its age has earned (the monster's id is its ticket number);
 * - a monster the server does not list (killed, dismissed, never real) is removed;
 * - chests: as many as the server counts (extra ones are taken off, missing ones are placed).
 */
export const reconcileTickets = (state: ReconcileInput, tickets: PublicTickets, serverNowSec: number, rng: Rng, limits: LimitContext = {}): ReconcileResult => {
	const standing = new Set(state.monsters.map((mon) => mon.ticket));
	const waiting = [
		...tickets.rats.map((t) => ({ ...t, type: 'rat' as const, lucky: t.lucky })),
		...(tickets.king ? [{ ...tickets.king, type: 'ratKing' as const, lucky: false }] : []),
	].sort((a, b) => a.n - b.n);

	let placedMonsters = 0;
	let strongest = 0;
	const monsters: Monster[] = waiting.map((t) => {
		const ageSec = Math.max(0, serverNowSec - t.at);
		const level = levelAtAge(t.spawnLevel, ageSec, limits);
		if (!standing.has(t.n)) {
			placedMonsters++;
			strongest = Math.max(strongest, level);
		}
		return { id: t.n, type: t.type, level, spawnLevel: t.spawnLevel, x: t.x, y: t.y, ageSec, ticket: t.n, ...(t.lucky ? { lucky: true } : {}) };
	});
	const removedMonsters = state.monsters.filter((mon) => !waiting.some((t) => t.n === mon.ticket)).length;

	// chests
	let tiles = state.tiles;
	let activeChests = state.activeChests;
	let removedChests = 0;
	let placedChests = 0;
	if (activeChests > tickets.chests) {
		const standingChests = ownedRowMajor(tiles).filter(({ tile }) => tile.hasChest);
		while (activeChests > tickets.chests && standingChests.length > 0) {
			const { x, y } = standingChests.pop()!;
			tiles = patchTile(tiles, x, y, { hasChest: false });
			activeChests--;
			removedChests++;
		}
	}
	while (activeChests < tickets.chests) {
		const spot = pickChestSpot(tiles, new Set(monsters.map((m) => `${m.x},${m.y}`)), castleLevelOf(tiles), rng);
		if (!spot) break;
		tiles = patchTile(tiles, spot.x, spot.y, { hasChest: true });
		activeChests++;
		placedChests++;
	}

	return {
		tiles,
		monsters,
		activeChests,
		placed: { chests: placedChests, monsters: placedMonsters, strongestLevel: strongest },
		removed: { chests: removedChests, monsters: removedMonsters },
	};
};
