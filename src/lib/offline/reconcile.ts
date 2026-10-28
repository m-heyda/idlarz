import { castleLevelOf } from '@/lib/castleWard';
import { pickChestSpot } from '@/lib/chests';
import type { LimitContext } from '@/lib/limits';
import { castleDistance, levelAtAge, pickSpawnTile, rollSpawnLevel } from '@/lib/monsters';
import type { PublicTickets } from '@/lib/offline/types';
import type { Rng } from '@/lib/rng';
import type { Monster } from '@/types/game';
import { ownedRowMajor, patchTile, type World } from '@/utils/world';

// Makes the map match the server's tickets. The server decides which chests and monsters exist (and what is in them); the browser
// only draws them: it finds a spot, and it shows the age the server gave. Positions carry no value, so the client may choose them.

export interface ReconcileInput {
	tiles: World;
	monsters: Monster[];
	activeChests: number;
	nextMonsterId: number;
	/** The monster being fought stays whatever the server says until the fight ends */
	fightingId: number | null;
}

export interface ReconcileResult {
	tiles: World;
	monsters: Monster[];
	activeChests: number;
	nextMonsterId: number;
	/** What changed on the map: for the welcome-back window */
	placed: { chests: number; monsters: number; strongestLevel: number };
	removed: { chests: number; monsters: number };
}

/**
 * - a monster already on the map without a ticket number takes the oldest unclaimed ticket of its kind (a game that predates tickets);
 * - a monster whose ticket the server does not have (spent, or never existed) is removed, unless it is being fought;
 * - a ticket with no monster becomes one on a free tile, aged as the server says, at a level its age has earned;
 * - chests: as many as the server counts (extra ones are taken off, missing ones are placed).
 */
export const reconcileTickets = (state: ReconcileInput, tickets: PublicTickets, serverNowSec: number, rng: Rng, limits: LimitContext = {}): ReconcileResult => {
	const waiting = [...tickets.rats.map((t) => ({ ...t, king: false })), ...(tickets.king ? [{ ...tickets.king, lucky: false, king: true }] : [])];
	const byN = new Map(waiting.map((t) => [t.n, t]));
	const claimed = new Set<number>();
	for (const mon of state.monsters) if (mon.ticket !== undefined && byN.has(mon.ticket)) claimed.add(mon.ticket);

	const monsters: Monster[] = [];
	let removedMonsters = 0;
	const loose = [...state.monsters].sort((a, b) => a.id - b.id);
	const spare = (king: boolean) => waiting.filter((t) => t.king === king && !claimed.has(t.n)).sort((a, b) => a.n - b.n);
	for (const mon of loose) {
		const king = mon.type === 'ratKing';
		if (mon.ticket !== undefined && claimed.has(mon.ticket)) {
			const ticket = byN.get(mon.ticket)!;
			monsters.push(ticket.lucky && !mon.lucky ? { ...mon, lucky: true } : mon);
			continue;
		}
		if (mon.ticket === undefined) {
			const next = spare(king)[0];
			if (next) {
				claimed.add(next.n);
				monsters.push({ ...mon, ticket: next.n, ...(next.lucky ? { lucky: true } : {}) });
				continue;
			}
		}
		if (mon.id === state.fightingId) monsters.push(mon);
		else removedMonsters++;
	}

	let tiles = state.tiles;
	let nextMonsterId = state.nextMonsterId;
	let placedMonsters = 0;
	let strongest = 0;
	for (const ticket of waiting.filter((t) => !claimed.has(t.n)).sort((a, b) => a.n - b.n)) {
		const spot = pickSpawnTile(tiles, monsters, rng);
		if (!spot) break; // no room yet: the ticket keeps waiting
		const type = ticket.king ? 'ratKing' : 'rat';
		const id = nextMonsterId++;
		const spawnLevel = rollSpawnLevel(type, castleLevelOf(tiles), id, castleDistance(spot));
		const ageSec = Math.max(0, serverNowSec - ticket.at);
		const level = levelAtAge(spawnLevel, ageSec, limits);
		monsters.push({ id, type, level, spawnLevel, x: spot.x, y: spot.y, ageSec, ticket: ticket.n, ...(ticket.lucky ? { lucky: true } : {}) });
		placedMonsters++;
		strongest = Math.max(strongest, level);
	}

	// chests
	let activeChests = state.activeChests;
	let removedChests = 0;
	let placedChests = 0;
	if (activeChests > tickets.chests) {
		const standing = ownedRowMajor(tiles).filter(({ tile }) => tile.hasChest);
		while (activeChests > tickets.chests && standing.length > 0) {
			const { x, y } = standing.pop()!;
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
		nextMonsterId,
		placed: { chests: placedChests, monsters: placedMonsters, strongestLevel: strongest },
		removed: { chests: removedChests, monsters: removedMonsters },
	};
};
