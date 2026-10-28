import type { LimitContext } from '@/lib/limits';
import { levelAtAge } from '@/lib/monsters';
import type { PublicTickets } from '@/lib/offline/types';
import type { Monster } from '@/types/game';
import { getTile, ownedRowMajor, patchTile, type World } from '@/utils/world';

// Makes the map match the server's tickets. The server decides which chests and monsters exist, what is inside them and, for a monster,
// the tile it stands on and the level it appeared at (and for a chest the tile): the browser draws exactly that (and shows the age the server gave).

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
 * - chests: on the tiles the server lists (others are taken off, missing ones are put on unless the answer may be older than a chest the player opened).
 */
export const reconcileTickets = (
	state: ReconcileInput,
	tickets: PublicTickets,
	serverNowSec: number,
	limits: LimitContext = {},
	/** `placeChests: false` still takes extra chests off but puts no missing one back: for an answer that may be older than a chest the player just opened */
	options: { placeChests?: boolean } = {}
): ReconcileResult => {
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

	// chests: exactly the tiles the server lists. One it does not list is taken off; one it lists is put on (unless the answer may be older
	// than a chest the player just opened, see `placeChests`).
	const wanted = new Map(tickets.chests.map((chest) => [`${chest.x},${chest.y}`, chest]));
	let tiles = state.tiles;
	let activeChests = state.activeChests;
	let removedChests = 0;
	let placedChests = 0;
	for (const { x, y, tile } of ownedRowMajor(tiles)) {
		if (tile.hasChest && !wanted.has(`${x},${y}`)) {
			tiles = patchTile(tiles, x, y, { hasChest: false });
			activeChests--;
			removedChests++;
		}
	}
	if (options.placeChests !== false) {
		for (const { x, y } of wanted.values()) {
			const tile = getTile(tiles, x, y);
			if (!tile || !tile.isOwned || tile.hasChest) continue;
			tiles = patchTile(tiles, x, y, { hasChest: true });
			activeChests++;
			placedChests++;
		}
	}

	return {
		tiles,
		monsters,
		activeChests,
		placed: { chests: placedChests, monsters: placedMonsters, strongestLevel: strongest },
		removed: { chests: removedChests, monsters: removedMonsters },
	};
};
