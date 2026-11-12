import type { AchievementReport } from '@/lib/offline/achievements';
import type { Attrs } from '@/lib/offline/attrs';

// What goes over the wire for /api/gems and /api/character. Kept apart from the server logic so the browser can import it (no node:crypto, no database).

/** An identity change the server has charged for and still has to write on the profile row (`ledger.gemShop.pending`): it is written right after the charge and cleared, and a request that finds one finishes it first. */
export type PendingIdentity = { kind: 'class'; value: string; price: number } | { kind: 'name'; value: string; price: number };

/** What the gem shop has sold and when (ledger column `gem_shop`; null in the column until something was bought or the daily bonus claimed). */
export interface GemShop {
	/** Purchases by item id */
	bought: Record<string, number>;
	/** Epoch seconds of the last purchase by item id (cooldowns) */
	lastAt: Record<string, number>;
	/** The daily bonus: the server day (UTC, 1-based) of the last claim (0 = never) and the step of the ladder it paid (1-7) */
	daily: { day: number; streak: number };
	/** Gems spent since the last accepted save: a save that still holds the balance from before the spend is not a gem increase (the save check allows this much above the ledger's balance) */
	spentSinceSave: number;
	pending: PendingIdentity | null;
}

export type GemsRequest =
	| { action: 'status' }
	| { action: 'daily' }
	| { action: 'claim'; id: string }
	| { action: 'claimAll' }
	| { action: 'spend'; itemId: string; value?: string };

export interface DailyInfo {
	/** Whether today's bonus can be claimed now */
	available: boolean;
	/** The step of the ladder that the next claim pays (1-7) */
	step: number;
	/** What the next claim pays */
	gems: number;
}

export type GemsRefusal =
	| 'unknown_item'
	| 'short_balance'
	| 'cooldown'
	| 'in_fight'
	| 'same_class'
	| 'bad_value'
	| 'name_taken'
	| 'nothing_to_respec'
	| 'pending'
	| 'already_claimed'
	| 'not_earned'
	| 'no_profile';

/** What /api/gems answers. The balance is always the server's; `attrs` rides along after a respec. */
export interface GemsReply {
	ok: boolean;
	reason?: GemsRefusal;
	/** What a refused request tells the player */
	message?: string;
	gems: number;
	daily: DailyInfo;
	/** Whether the account's one free attribute respec is still there */
	freeRespec: boolean;
	/** Epoch seconds of the last purchase by item id (the ledger's) */
	lastAt: Record<string, number>;
	/** Epoch seconds of the last name change (the profile's), null = never */
	nameChangedAt: number | null;
	/** The profile as it stands after an identity change */
	playerClass?: string;
	characterName?: string;
	/** Gems the request charged (0 for a free respec) or the daily bonus paid */
	paid?: number;
	/** The achievement ids a `claimAll` paid, in the order they were claimed */
	claimedIds?: string[];
	attrs?: Attrs;
	/** The achievements as they stand after a claim (every online answer may carry it: the achievement store takes it) */
	achievements?: AchievementReport;
	serverNowSec: number;
}

/** What /api/character answers: the allocation as it stands (an `add` refused for lack of points says so and carries the true allocation, so the browser puts its preview right). */
export interface CharacterReply {
	ok: boolean;
	reason?: 'no_points' | 'bad_request' | 'in_fight';
	attrs: Attrs;
	/** Points still free at the server's idea of the level */
	available: number;
	serverNowSec: number;
}

export type CharacterRequest = { action: 'allocate'; add: Record<string, number> } | { action: 'sync' };
