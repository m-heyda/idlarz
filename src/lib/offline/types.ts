import type { MerchantResourceKey } from '@/catalog/resources';
import type { ActiveBuff } from '@/lib/buffs';
import type { OfflineGrant } from '@/lib/offline/grant';
import type { BagSlot, Equipment, EquipmentSlot, ItemInstance } from '@/types/game';

// What goes over the wire between /api/offline and the browser. Kept apart from service.ts (which pulls in node:crypto) so the client can import it.

/**
 * What the server keeps of a player's things: the bag, the worn gear, the loot pity and the auto-sell filter. The browser shows it and
 * asks for changes (`/api/inventory`); `ver` grows with every change, so the browser can tell a newer picture from an older answer.
 */
export interface Inventory {
	ver: number;
	/** The Pack Rat level the server holds: it sizes the bag, and the browser takes it with the bag (absent in rows from before it was kept) */
	packrat?: number;
	/** The most bag slots a belt has given this player (the `bagSlots` stat of the worn belt, kept like Pack Rat: slots are never taken back, so nothing in the bag is lost and a rebirth keeps them; absent: none) */
	beltSlots?: number;
	bag: BagSlot[];
	equipment: Equipment;
	lootPity: Record<string, number>;
	autoSellUpTo: string | null;
	/** Set by POST /api/rebirth: the server ran the rebirth to this count and computed its Embers. The save that carries the rebirth is capped at exactly this gain, and the bag is not wiped a second time. */
	rebirth?: { to: number; gain: number };
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
	| { action: 'buyOffer'; item: ItemInstance }
	/** Drinks one potion from the bag slot `index` (instant effects fill HP and mana, a buff is recorded with an end time) */
	| { action: 'use'; index: number };

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
	/** Growth levels it may gain, when capped for a weak player (left out: the full growth limit) */
	growCap?: number;
	/** Which monster it is (left out by older servers: tickets then carry the fallback monster or boss) */
	type?: import('@/types/game').MonsterType;
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
	/** The normal monsters standing on the map (golden ones carry `lucky`) */
	monsters: (PublicMonster & { lucky: boolean })[];
	/** The boss standing on the map, if any */
	boss: PublicMonster | null;
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
	/** Why a refused operation was refused, when the player should be told (a `use` that did nothing, a sixth buff) */
	message?: string;
	/** The running buffs after a `use` (only on that operation) */
	buffs?: ActiveBuff[];
}

/**
 * The player's crafting (ledger column `craft`, docs/plan/crafting-v0.md). The crafting level is derived from `xp` and never stored on its own,
 * and survives a rebirth; `stock` (components) is a run's material and is emptied by one. A row without the column reads as `emptyCraft()`.
 */
export interface CraftState {
	/** Lifetime crafting XP */
	xp: number;
	/** Crafts done, lifetime (the seed counter for the random crafts to come: gear) */
	ord: number;
	/** Components held: component id -> count */
	stock: Record<string, number>;
	/** Bad-luck counters per tier (gear, later); empty in v0.0 */
	pity: Record<string, number>;
	/** Gold value of the resources the crafts took, lifetime: the browser pays them, the server only counts them (for the spending audit to come) */
	spent: number;
	/** Epoch ms of the last craft that went through (the 1 request per second limit) */
	last: number;
	/** The timed batches that are running (docs/plan/crafting-v0.md, Timed batch queue); at most `craftQueueSlots` of them. Empty for most players. */
	queue: CraftQueueEntry[];
}

/**
 * One timed batch. Nothing is stored per item: the finished count is derived from the clock (`finishedOf`, lib/crafting.ts). A claim pays the
 * finished ones and shortens the entry (count down, startedAt forward by the time those took), so the same four fields stay true.
 */
export interface CraftQueueEntry {
	recipeId: string;
	/** Crafts still in this batch (finished and waiting ones included) */
	count: number;
	/** Epoch ms the first of the remaining crafts started */
	startedAt: number;
	/** Seconds one craft takes, speed multiplier included, fixed when the batch was queued */
	timeSec: number;
}

/** Why a craft was refused (nothing is charged and nothing is changed) */
export type CraftRefusal =
	| 'bad_request'
	| 'unknown_recipe'
	| 'not_craftable'
	| 'locked'
	| 'too_fast'
	| 'no_components'
	| 'stock_full'
	| 'bag_full'
	| 'queue_full'
	| 'no_batch'
	| 'nothing_ready'
	| 'not_in_stash';

/** What /api/craft answers: whether it was done, why not, how many were made, and the bag and crafting state as they stand now. */
export interface CraftReply {
	ok: boolean;
	reason?: CraftRefusal;
	/** Crafts delivered by this request (instant crafts, or the claimed ones) */
	crafted: number;
	/** Crafts this request put into the queue */
	queued?: number;
	/** Items a stash withdrawal moved into the bag */
	moved?: number;
	/** What a cancel gives back of the browser-held resources (the browser adds it) */
	refund?: { key: MerchantResourceKey; qty: number }[];
	inv: Inventory;
	craft: CraftState;
	serverNowSec: number;
}

/** What /api/rebirth answers: whether the server ran the rebirth, the Embers it pays, and the inventory the new run starts with (the starter kit). */
export interface RebirthReply {
	ok: boolean;
	/** Why not (the stored save does not meet the requirements, or the rebirth would pay nothing) */
	reason?: 'not_ready' | 'no_embers';
	/** The rebirth count this rebirth leads to, and the Embers it pays (0 when refused) */
	to: number;
	gain: number;
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
	/** A click on a monster while a fight was open: it joined the queue, left it, or the queue was full */
	queued?: import('@/lib/offline/fightTypes').QueueResult;
	inv?: Inventory;
}
