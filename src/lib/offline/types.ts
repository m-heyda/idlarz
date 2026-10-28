import type { OfflineGrant } from '@/lib/offline/grant';

// What goes over the wire between /api/offline and the browser. Kept apart from service.ts (which pulls in node:crypto) so the client can import it.

/**
 * The waiting chests and monsters as the client needs to see them. A monster is listed once the server has given it a tile: `x`, `y` and
 * the level it appeared at (`spawnLevel`, which grows with its age) are the server's. A chest is listed the same way, by number and tile;
 * opening it names that tile.
 */
interface PublicMonster {
	n: number;
	at: number;
	x: number;
	y: number;
	spawnLevel: number;
}

export interface PublicChest {
	n: number;
	x: number;
	y: number;
}

export interface PublicTickets {
	chests: PublicChest[];
	/**
	 * How many chests this run has opened, as the server counted when it made this answer. The browser uses it to tell an answer that
	 * was made before one of its own chest opens (it still counts that chest) from one made after it. Left out by older servers.
	 */
	opened?: number;
	rats: (PublicMonster & { lucky: boolean })[];
	king: PublicMonster | null;
}

export interface ClaimResult {
	/** What the absence paid; null when nothing is due (too short, or the account is under review) */
	grant: OfflineGrant | null;
	reason: 'paid' | 'short' | 'flagged';
	tickets: PublicTickets;
	/** The server clock (epoch seconds) the tickets' ages are measured against */
	serverNowSec: number;
	gems: number;
}

/** A chest opened on the server: what was inside (rolled from a secret the browser never sees) and the gem balance afterwards. */
export type ChestReward =
	| { ok: true; loot: import('@/lib/chests').ChestLoot; gems: number; gemsTotal: number; tickets: PublicTickets; serverNowSec: number }
	| { ok: false; reason: 'no_ticket'; tickets: PublicTickets; serverNowSec: number; gemsTotal: number };

/** What /api/spawn answers: the tickets as they stand, and when to ask again. */
export interface SyncResult {
	tickets: PublicTickets;
	serverNowSec: number;
	gemsTotal: number;
	/** Seconds until the next chest or monster is due (null: the map is full) */
	nextInSec: number | null;
	/** The player's combat as of now (a running fight is carried forward by every request) */
	combat: import('@/lib/offline/fightTypes').CombatView;
}

/** What /api/fight answers: the combat picture, plus the tickets and gems (a won fight changes both). */
export interface FightReply {
	combat: import('@/lib/offline/fightTypes').CombatView;
	tickets: PublicTickets;
	serverNowSec: number;
	gemsTotal: number;
	/** False when an asked-for action was refused (cooldown, mana, no potion left, no such monster) */
	accepted: boolean;
}
