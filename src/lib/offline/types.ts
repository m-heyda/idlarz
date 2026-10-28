import type { OfflineGrant } from '@/lib/offline/grant';

// What goes over the wire between /api/offline and the browser. Kept apart from service.ts (which pulls in node:crypto) so the client can import it.

/** The waiting chests and monsters as the client needs to see them (a chest is just a count: nothing tells chests apart). */
export interface PublicTickets {
	chests: number;
	rats: { n: number; at: number; lucky: boolean }[];
	king: { n: number; at: number } | null;
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

/** A kill (or a dismissal) paid on the server. `level` is the level the reward was rolled at: what the client asked for, but never above what the ticket's age allows. */
export type KillReward =
	| {
			ok: true;
			dismissed: false;
			level: number;
			lucky: boolean;
			gold: number;
			xp: number;
			items: import('@/types/game').Drop[];
			pity: Record<string, number>;
			tickets: PublicTickets;
			serverNowSec: number;
			gemsTotal: number;
	  }
	| { ok: true; dismissed: true; tickets: PublicTickets; serverNowSec: number; gemsTotal: number }
	| { ok: false; reason: 'no_ticket'; tickets: PublicTickets; serverNowSec: number; gemsTotal: number };

/** What /api/spawn answers: the tickets as they stand, and when to ask again. */
export interface SyncResult {
	tickets: PublicTickets;
	serverNowSec: number;
	gemsTotal: number;
	/** Seconds until the next chest or monster is due (null: the map is full) */
	nextInSec: number | null;
}
