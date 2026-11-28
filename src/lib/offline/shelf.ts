import type { StoredSave } from '@/lib/cloudSave/pipeline';
import { averageItemLevel } from '@/lib/inventory';
import { limitOf, type LimitContext } from '@/lib/limits';
import {
	afterRefresh,
	bestWornGrade,
	freeRefreshesLeft,
	generateMerchantStock,
	paidRefreshesNow,
	refreshCooldown,
	refreshCost,
	shopPriceOf,
} from '@/lib/merchant';
import { receiveOffer } from '@/lib/offline/inventory';
import type { Ledger } from '@/lib/offline/ledger';
import { prestigeOfCore } from '@/lib/offline/prestigeOfCore';
import { sealedRng } from '@/lib/offline/seal';
import { emptyShelf, type ShelfRecord } from '@/lib/offline/stats';
import { spendGold } from '@/lib/offline/trade';
import type { Inventory, ShelfReply } from '@/lib/offline/types';
import type { MerchantUpgrades } from '@/utils/game/merchant';
import type { ItemInstance } from '@/types/game';

// SERVER ONLY. The merchant's goods shelf (IDL-121). The offers are rolled here, with a sealed random source (HMAC of the loot secret, the player and a lifetime roll counter), from what the server itself knows: the castle level
// of the last accepted save and the gear in the ledger's inventory. The browser cannot roll, re-roll or invent a piece: it asks for the shelf, and a piece is bought **by its place on this shelf** at the price worked out here.
// The clocks (rotation, the 12 h free refreshes, the 30 s cooldown, the 24 h price run) are server seconds, so they do not depend on a play time the browser reports. The gold itself is still taken in the browser (it holds the
// balance); the server records the price as spent (`spendGold`) and refuses a price the player cannot plausibly pay.

/** What a shelf roll is built from: the sealing secret and the player, which the pure shelf functions never see. */
export interface ShelfEnv {
	secret: string;
	userId: string;
}

export type ShelfStep = { ok: true; ledger: Ledger; shelf: ShelfReply } | { ok: false; message?: string };

const limitsOf = (stored: StoredSave): LimitContext => ({
	prestige: prestigeOfCore(stored.core),
	merchantUpgrades: stored.core.merchantUpgrades as MerchantUpgrades | undefined,
});

const replyOf = (shelf: ShelfRecord, charged: number): ShelfReply => ({
	offers: shelf.offers,
	at: shelf.at,
	paid: shelf.paid,
	refresh: shelf.refresh,
	charged,
});

/** The shelf as the ledger holds it (a player who has never asked has none yet). */
export const shelfOf = (ledger: Ledger): ShelfRecord => ledger.stats.shelf ?? emptyShelf();

/** A rebirth ends the run of rising prices and the free window (the shelf and the 30 s cooldown carry over, as in the browser): the roll counter is never reset, so no sequence repeats. */
export const shelfAfterRebirth = (shelf: ShelfRecord | null): ShelfRecord | null =>
	shelf ? { ...shelf, paid: 0, refresh: { windowAt: 0, freeUsed: 0, lastAt: shelf.refresh.lastAt, paidAt: 0 } } : null;

/** Rolls one new shelf from the ledger's own gear and the last save's castle level. */
const rolled = (ledger: Ledger, stored: StoredSave, env: ShelfEnv, nowSec: number, shelf: ShelfRecord): ShelfRecord => {
	const equipment = ledger.inv!.equipment;
	const stock = generateMerchantStock(
		stored.summary.castleLevel,
		averageItemLevel(equipment),
		sealedRng(env.secret, env.userId, 0, 'merchant', shelf.rolls + 1),
		nowSec,
		limitsOf(stored),
		bestWornGrade(equipment),
	);
	return { ...shelf, at: nowSec, rolls: shelf.rolls + 1, offers: stock.offers };
};

/**
 * `rotate`: the shelf, rolled again when its time is up (`merchantRotateSec` of server time since the roll) or when there is none yet; a shelf that is not due is only looked at. No gold, no refresh counted.
 * `refresh`: a new shelf now, free while the 12 h window has free refreshes left, otherwise paid at the doubling price; refused during the 30 s cooldown or for a price the player cannot plausibly pay.
 *
 * @category Economy/Merchant
 * @order 13
 * @see generateMerchantStock, refreshCost, spendGold
 */
export const shelfStep = (ledger: Ledger, stored: StoredSave, env: ShelfEnv, nowSec: number, mode: 'rotate' | 'refresh'): ShelfStep => {
	const shelf = shelfOf(ledger);
	const limits = limitsOf(stored);
	if (mode === 'rotate') {
		const due = shelf.at === 0 || nowSec - shelf.at >= limitOf('merchantRotateSec', limits);
		if (!due) return { ok: true, ledger, shelf: replyOf(shelf, 0) };
		const next = rolled(ledger, stored, env, nowSec, shelf);
		return { ok: true, ledger: { ...ledger, stats: { ...ledger.stats, shelf: next } }, shelf: replyOf(next, 0) };
	}
	if (refreshCooldown(shelf.refresh, nowSec) > 0) return { ok: false, message: 'The merchant needs a moment before the next refresh.' };
	const free = freeRefreshesLeft(shelf.refresh, nowSec) > 0;
	const paid = paidRefreshesNow(shelf.paid, shelf.refresh, nowSec);
	const cost = free ? 0 : refreshCost(paid, limits);
	const spent = spendGold(ledger, stored, nowSec, cost);
	if (!spent) return { ok: false, message: 'You cannot pay for that refresh.' };
	const after = afterRefresh(shelf.refresh, nowSec, free, paid);
	const next: ShelfRecord = {
		...rolled(ledger, stored, env, nowSec, shelf),
		paid: paid + (free ? 0 : 1),
		refresh: { windowAt: after.windowAt, freeUsed: after.freeUsed, lastAt: after.lastAt, paidAt: after.paidAt ?? 0 },
	};
	return { ok: true, ledger: { ...spent, stats: { ...spent.stats, shelf: next } }, shelf: replyOf(next, cost) };
};

/** Where on the shelf a piece is: by the place the browser names when that place holds that piece, otherwise by finding the piece itself (an older browser names only the piece). -1: it is not on the shelf. */
const placeOf = (offers: readonly ItemInstance[], index: number | undefined, item: ItemInstance | undefined): number => {
	const same = (a: ItemInstance, b: ItemInstance | undefined) => !!b && JSON.stringify(a) === JSON.stringify(b);
	if (index !== undefined && Number.isInteger(index) && index >= 0 && index < offers.length && (item === undefined || same(offers[index], item))) return index;
	return item ? offers.findIndex((offer) => same(offer, item)) : -1;
};

/**
 * Buys a piece of the shelf the server holds: its price is `shopPriceOf` of the server's own piece (never a figure from the browser), it must fit in the bag, and the piece leaves the shelf. Refused for a piece that is not on the shelf
 * (a forged one), a bag with no room, or a price the player cannot plausibly pay.
 *
 * @category Economy/Merchant
 * @order 14
 * @see shopPriceOf, spendGold
 */
export const buyOffer = (
	ledger: Ledger,
	stored: StoredSave,
	nowSec: number,
	index: number | undefined,
	item: ItemInstance | undefined,
): { ledger: Ledger; inv: Inventory } | null => {
	const shelf = shelfOf(ledger);
	const at = placeOf(shelf.offers, index, item);
	if (at < 0) return null;
	const inv = receiveOffer(ledger.inv!, shelf.offers[at]);
	const spent = inv ? spendGold(ledger, stored, nowSec, shopPriceOf(shelf.offers[at])) : null;
	if (!inv || !spent) return null;
	const next: ShelfRecord = { ...shelf, offers: shelf.offers.filter((_, i) => i !== at) };
	return { ledger: { ...spent, inv, stats: { ...spent.stats, shelf: next } }, inv };
};
