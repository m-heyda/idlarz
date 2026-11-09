import { castleLevelOf, isInWard } from '@/lib/castleWard';
import { chestSpots, pickChestSpot } from '@/lib/chests';
import { MONSTERS } from '@/config/combatConfig';
import { castleDistance } from '@/lib/distance';
import { canSpawnOn, rollSpawnLevel, spawnTiles } from '@/lib/monsters';
import type { PlayerProfile } from '@/lib/offline/fightTypes';
import { growthCap, pickWeighted, spawnLevelCap, typeWeights } from '@/lib/offline/spawnWeights';
import { monsterTypeOf, type ChestTicket, type MonsterTicket, type TicketBank } from '@/lib/offline/tickets';
import type { Rng } from '@/lib/rng';
import { unpackBody, type SaveBody } from '@/lib/saveFormat';
import type { MonsterType, Tile } from '@/types/game';
import { createWorld, getTile, type Placed, type World } from '@/utils/world';

// Where the server puts its monsters and chests. The server mints a ticket from its clock; this finds the tile, from the land of the last accepted
// save and the spawn rules of the monster (config/combatConfig `MonsterDef.spawn`: biomes, distance from the castle). The browser only
// draws a monster where the ticket says. The map is a large row that is only read when it matters (see `needsLook`).

/** What the rules depend on: a different key means the land (or the castle) changed since the last look. */
export const siteKey = (summary: { tilesOwned: number; buildingsOwned: number; castleLevel: number; rebirths: number }): string =>
	`${summary.tilesOwned}:${summary.buildingsOwned}:${summary.castleLevel}:${summary.rebirths}`;

type LandEntry = { x: number; y: number; biome: Tile['biome']; level?: number; building?: string; chest?: boolean };

/** The owned tiles of a stored map (`land` and `extra` of a save, see saveFormat), or null when it cannot be read. */
export const worldFromPart = (part: { land: unknown; extra: unknown }): World | null => {
	const unpacked = unpackBody({ land: part.land, extra: part.extra } as SaveBody);
	if ('error' in unpacked) return null;
	const placed: Placed[] = (unpacked.raw.land as LandEntry[]).map(({ x, y, biome, level, building, chest }) => ({
		x,
		y,
		tile: {
			biome,
			isOwned: true,
			...(level !== undefined ? { level } : {}),
			...(building !== undefined ? { building } : {}),
			...(chest ? { hasChest: true } : {}),
		},
	}));
	return createWorld(placed);
};

/** The monsters a ticket of this kind can turn into: every `MONSTERS` entry of the matching grade (normal monsters for a rat ticket, bosses for the King's). */
const typesOf = (kind: 'rat' | 'king'): MonsterType[] =>
	(Object.keys(MONSTERS) as MonsterType[]).filter((type) => (MONSTERS[type].grade === 'boss') === (kind === 'king'));

/** A ticket that is on the map (it has a tile and the level it appeared at). */
export const isPlaced = (ticket: MonsterTicket): boolean => ticket.x !== undefined && ticket.y !== undefined && ticket.spawnLevel !== undefined;

/** A chest that is on the map (it has a tile). */
export const isChestPlaced = (ticket: ChestTicket): boolean => ticket.x !== undefined && ticket.y !== undefined;

/** Whether the map has to be looked at: the land changed since the last look, or a monster or chest is waiting for its tile and there may be room. */
export const needsLook = (bank: TicketBank, key: string): boolean => {
	if (bank.sitesKey !== key || !bank.sites) return true;
	const waiting = bank.rats.some((ticket) => !isPlaced(ticket)) || (bank.king !== null && !isPlaced(bank.king));
	if (waiting && bank.sites.rat > 0) return true;
	const monsters = bank.rats.length + (bank.king ? 1 : 0);
	return bank.chests.some((chest) => !isChestPlaced(chest)) && bank.chests.length + monsters < (bank.sites.chest ?? 0);
};

/**
 * Looks at the land: counts the tiles each kind may stand on, takes a monster or chest off a tile that stopped being valid (it is placed
 * again), and gives every waiting monster a tile and the level it appears at and every waiting chest a tile. Tickets with no tile left stay hidden until the land
 * grows. `rollFor('spawnpos', n)` picks the tile of monster ticket `n` and `rollFor('chestpos', n)` the one of chest `n` (the server seals
 * them with a secret; tests pass a seeded one). A chest leans toward the edge of the land and away from other chests (`pickChestSpot`).
 * With the player's profile (`hero`) a new monster's type is weighted by how beatable it is (spawnWeights.ts) and its level and growth are capped
 * near what the player can beat; without it every type is equally likely and nothing is capped. Bosses are never weighted or capped.
 *
 * Bosses are placed with a uniform pick among the boss types that still have a free tile, while normal monsters are weighted by win chance.
 *
 * @category Monsters/Spawning
 * @order 4
 * @knownissue IDL-222 bosses are never weighted by win chance (a uniform pick); needs an owner decision.
 */
export const placeTickets = (
	bank: TicketBank,
	world: World,
	key: string,
	rebirths: number,
	rollFor: (kind: string, n: number) => Rng,
	hero?: PlayerProfile,
): TicketBank => {
	const castleLevel = castleLevelOf(world);
	const noneTaken = new Set<string>();
	// how many tiles some monster of the kind may stand on (a tile several monsters could use counts once)
	const siteCount = (kind: 'rat' | 'king') =>
		new Set(typesOf(kind).flatMap((type) => spawnTiles(type, world, noneTaken, rebirths).map((spot) => `${spot.x},${spot.y}`))).size;
	const sites = {
		rat: siteCount('rat'),
		king: siteCount('king'),
		chest: chestSpots(world, noneTaken, castleLevel).length,
	};

	const taken = new Set<string>();
	// a monster keeps its tile while the tile is still valid for it (and nobody else stands there)
	const settle = (ticket: MonsterTicket, kind: 'rat' | 'king'): MonsterTicket => {
		if (!isPlaced(ticket)) return ticket;
		const spot = `${ticket.x},${ticket.y}`;
		const tile = getTile(world, ticket.x!, ticket.y!);
		if (tile && !taken.has(spot) && canSpawnOn(monsterTypeOf(ticket, kind), ticket.x!, ticket.y!, tile, castleLevel, rebirths)) {
			taken.add(spot);
			return ticket;
		}
		return { n: ticket.n, at: ticket.at, lucky: ticket.lucky };
	};
	// a chest keeps its tile while it can still stand there (a building, the castle's ward or a monster would stop it)
	const settleChest = (ticket: ChestTicket): ChestTicket => {
		if (!isChestPlaced(ticket)) return ticket;
		const spot = `${ticket.x},${ticket.y}`;
		const tile = getTile(world, ticket.x!, ticket.y!);
		if (tile && tile.biome !== 'castle' && !tile.building && !taken.has(spot) && !isInWard(ticket.x!, ticket.y!, castleLevel)) {
			taken.add(spot);
			return ticket;
		}
		return { n: ticket.n, at: ticket.at };
	};
	const place = (ticket: MonsterTicket, kind: 'rat' | 'king'): MonsterTicket => {
		if (isPlaced(ticket)) return ticket;
		// the monster comes with the tile: among the types that still have a free tile (the seal picks when there is a choice)
		const open = typesOf(kind)
			.map((type) => ({ type, free: spawnTiles(type, world, taken, rebirths) }))
			.filter((entry) => entry.free.length > 0);
		if (open.length === 0) return ticket;
		const rat = !!hero && kind === 'rat';
		const weights =
			rat && open.length > 1
				? typeWeights(
						hero,
						open.map((entry) => entry.type),
						castleLevel,
					)
				: null;
		const roll = open.length === 1 ? 0 : rollFor('spawntype', ticket.n)();
		const { type, free } = open[weights ? pickWeighted(weights, roll) : Math.floor(roll * open.length) % open.length];
		const spot = free[Math.floor(rollFor('spawnpos', ticket.n)() * free.length) % free.length];
		taken.add(`${spot.x},${spot.y}`);
		const cap = rat ? spawnLevelCap(hero, type, castleLevel) : Infinity;
		const spawnLevel = rollSpawnLevel(type, castleLevel, ticket.n, castleDistance(spot), Number.isFinite(cap) ? cap : undefined);
		const grow = rat ? growthCap(hero, type, spawnLevel) : undefined;
		return { ...ticket, type, x: spot.x, y: spot.y, spawnLevel, ...(grow !== undefined ? { growCap: grow } : {}) };
	};

	const settledRats = bank.rats.map((ticket) => settle(ticket, 'rat'));
	const settledKing = bank.king ? settle(bank.king, 'king') : null;
	// chests that stand stay where they are before anything new is placed, so a new monster never takes a chest's tile
	const settledChests = bank.chests.map(settleChest);
	// tickets are placed oldest first so the same land always gives the same map
	const order = [...settledRats].sort((a, b) => a.n - b.n);
	const placed = new Map(order.map((ticket) => [ticket.n, place(ticket, 'rat')]));
	const king = settledKing ? place(settledKing, 'king') : null;
	const placedChests = new Map(
		[...settledChests]
			.sort((a, b) => a.n - b.n)
			.map((ticket): [number, ChestTicket] => {
				if (isChestPlaced(ticket)) return [ticket.n, ticket];
				const spot = pickChestSpot(world, taken, castleLevel, rollFor('chestpos', ticket.n));
				if (!spot) return [ticket.n, ticket];
				taken.add(`${spot.x},${spot.y}`);
				return [ticket.n, { ...ticket, x: spot.x, y: spot.y }];
			}),
	);
	return {
		...bank,
		rats: settledRats.map((ticket) => placed.get(ticket.n)!),
		king,
		chests: settledChests.map((ticket) => placedChests.get(ticket.n)!),
		sites,
		sitesKey: key,
	};
};
