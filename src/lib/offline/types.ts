import type { OfflineGrant } from '@/lib/offline/grant';
import type { BagSlot, Equipment, EquipmentSlot, ItemInstance } from '@/types/game';

// What goes over the wire between /api/offline and the browser. Kept apart from service.ts (which pulls in node:crypto) so the client can import it.

/**
 * What the server keeps of a player's things: the bag, the worn gear, the loot pity and the auto-sell filter. The browser shows it and
 * asks for changes (`/api/inventory`); `ver` grows with every change, so the browser can tell a newer picture from an older answer.
 */
export interface Inventory {
	ver: number;
	bag: BagSlot[];
	equipment: Equipment;
	lootPity: Record<string, number>;
	autoSellUpTo: string | null;
}

/** One of the player's own changes to what they carry: what the browser previews at once and asks the server (`/api/inventory`) to do. */
export type InventoryOp =
	| { action: 'equip'; index: number }
	| { action: 'unequip'; slot: EquipmentSlot }
	| { action: 'move'; from: number; to: number }
	| { action: 'organize' }
	| { action: 'discard'; index: number; qty?: number }
	| { action: 'sell'; index: number; qty?: number }
	| { action: 'sellJunk'; maxRarity: string }
	| { action: 'autoSell'; rarity: string | null }
	| { action: 'buyShop'; id: string; qty: number }
	| { action: 'buyOffer'; item: ItemInstance };

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

/**
 * A chest opened on the server: what was inside (rolled from a secret the browser never sees) and the gem balance afterwards. An item has
 * already been put where it goes (`received`: the part that went into the bag, the gold for what did not fit, what the auto-sell filter sold).
 * Every answer of the server's online routes may carry `inv`: the player's things, whenever the browser's `invVer` is not the current one.
 */
export type ChestReward =
	| {
			ok: true;
			loot: import('@/lib/chests').ChestLoot;
			gems: number;
			gemsTotal: number;
			tickets: PublicTickets;
			serverNowSec: number;
			received?: { convertedGold: number; autoSold: { count: number; gold: number } };
			inv?: Inventory;
	  }
	| { ok: false; reason: 'no_ticket'; tickets: PublicTickets; serverNowSec: number; gemsTotal: number; inv?: Inventory };

/** What /api/inventory answers: whether the operation was done, the gold a sale paid, how many pieces were sold, and the player's things after it. */
export interface InventoryReply {
	ok: boolean;
	gold: number;
	count: number;
	/** The player's things as they stand now (always sent: the answer to an operation is the new truth) */
	inv: Inventory;
	serverNowSec: number;
}

/** What /api/spawn answers: the tickets as they stand, and when to ask again. */
export interface SyncResult {
	tickets: PublicTickets;
	serverNowSec: number;
	gemsTotal: number;
	/** Seconds until the next chest or monster is due (null: the map is full) */
	nextInSec: number | null;
	/** The player's combat as of now (a running fight is carried forward by every request) */
	combat: import('@/lib/offline/fightTypes').CombatView;
	inv?: Inventory;
}

/** What /api/fight answers: the combat picture, plus the tickets and gems (a won fight changes both). */
export interface FightReply {
	combat: import('@/lib/offline/fightTypes').CombatView;
	tickets: PublicTickets;
	serverNowSec: number;
	gemsTotal: number;
	/** False when an asked-for action was refused (cooldown, mana, no potion left, no such monster) */
	accepted: boolean;
	inv?: Inventory;
}
