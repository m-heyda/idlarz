import { MERCHANT_BUYABLE, MERCHANT_RESOURCE_PRICES } from '@/config/merchant';
import type { StoredSave } from '@/lib/cloudSave/pipeline';
import { isRecord } from '@/lib/isRecord';
import { sellContextOf } from '@/lib/offline/inventory';
import { addTotals, type GrantTotals, type Ledger } from '@/lib/offline/ledger';
import { emptyTrade, isEmptyTrade, recordSale, type TradeSince } from '@/lib/offline/stats';
import { buyCost, sellPayout } from '@/utils/game/merchant';

// SERVER ONLY. The merchant's resource trades (IDL-319): the price, the Haggler and Idol bonuses and the buy multiplier are worked out here, from the last accepted save, never from a figure the browser sends. The browser still previews the trade
// at once and the answer settles it (the same optimistic path as every inventory change). The server cannot see the live stock (it lives in the browser's save), so a trade is judged against an **upper bound** of what the player can hold: the last accepted
// save, plus what the rates have made since (the elapsed time is capped), plus what the server itself granted, minus what it already sold since that save, with a generous slack so an honest player is never refused. That stops a stock being sold twice
// or a stock that never existed being sold; it does not try to be exact.

/** The longest stretch of income counted on top of the last accepted save: a save is uploaded far more often than this, so a longer gap only means the player is not saving. */
export const TRADE_MAX_AGE_SEC = 24 * 3600;
/** The bound is this much above the estimate, plus a few units, for the rounding and timing of a browser that is a little ahead of its last save. */
const SLACK = 1.1;
const SLACK_UNITS = 25;
/** No trade moves more than this many units (a sanity bound for the numbers, not a game rule). */
const MAX_QTY = 1e12;

export type TradeResult = { ok: true; ledger: Ledger; gold: number } | { ok: false };

const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0);

/** The most of `resource` the player can plausibly hold now: see the note at the top of this file. */
const stockBound = (ledger: Ledger, stored: StoredSave, nowSec: number, resource: string, soldSince: number, boughtGold = 0): number => {
	const resources = isRecord(stored.core.resources) ? stored.core.resources : {};
	const rates = stored.summary.rates as unknown as Record<string, number>;
	const elapsed = Math.min(TRADE_MAX_AGE_SEC, Math.max(0, nowSec - stored.serverSavedAt / 1000));
	const granted = (ledger.granted as GrantTotals & Record<string, number>)[resource] ?? 0;
	const grantedSeen = (ledger.grantedSeen as GrantTotals & Record<string, number>)[resource] ?? 0;
	const estimate = num(resources[resource]) + num(rates[resource]) * elapsed + Math.max(0, granted - grantedSeen);
	// the slack goes on the estimate first and the trades since the save come off after it, so the slack is not a fresh allowance for every request
	return Math.max(0, estimate * SLACK + SLACK_UNITS - soldSince - boughtGold);
};

/**
 * What the trade record is after a save is accepted. The save is the browser's picture of its stock: a trade is dropped from the record only when that picture accounts for it, that is, the new stock is within what the previous
 * save plus income could explain **after** the trade came off. A save that still holds the pre-sale stock (another browser's older picture) or the gold a purchase should have cost leaves the record alone, so the same stock or gold
 * cannot be traded twice. A new run (rebirth, New Game) or a first save starts the record again.
 */
export const settleTrades = (ledger: Ledger, previous: StoredSave | null, newCore: { resources?: unknown }, nowSec: number, newRun: boolean): TradeSince => {
	const trade = ledger.stats.tradeSince;
	if (newRun || !previous || isEmptyTrade(trade)) return emptyTrade();
	const resources = isRecord(newCore.resources) ? newCore.resources : {};
	const sold: Record<string, number> = {};
	for (const [resource, units] of Object.entries(trade.sold)) {
		const bound = stockBound(ledger, previous, nowSec, resource, units);
		if (num(resources[resource]) > bound) sold[resource] = units;
	}
	const goldBound = stockBound(ledger, previous, nowSec, 'gold', 0, trade.boughtGold);
	return { sold, boughtGold: num(resources.gold) > goldBound ? trade.boughtGold : 0 };
};

/**
 * Sells `qty` units of `resource` to the merchant: the gold is `sellPayout` with the save's Haggler, Idols and prestige, recorded as granted (so the save that holds it passes the checks), the units go into the sold-since-save record and the lifetime
 * `unitsSold` / `goldFromSales` counters (Market Day). Refused for a resource the merchant does not buy (gold and XP), a quantity that is not a positive number, or more than the player can plausibly hold.
 *
 * @category Economy/Merchant
 * @order 10
 */
export const sellResource = (ledger: Ledger, stored: StoredSave, nowSec: number, resource: string, qty: number): TradeResult => {
	if (!Object.prototype.hasOwnProperty.call(MERCHANT_RESOURCE_PRICES, resource)) return { ok: false };
	if (typeof qty !== 'number' || !Number.isFinite(qty) || qty <= 0 || qty > MAX_QTY) return { ok: false };
	const sold = ledger.stats.tradeSince.sold[resource] ?? 0;
	if (qty > stockBound(ledger, stored, nowSec, resource, sold)) return { ok: false };
	const gold = sellPayout(MERCHANT_RESOURCE_PRICES[resource as keyof typeof MERCHANT_RESOURCE_PRICES], qty, sellContextOf(stored.core));
	const stats = recordSale(ledger.stats, Math.floor(qty), gold);
	return {
		ok: true,
		gold,
		ledger: {
			...ledger,
			granted: gold > 0 ? addTotals(ledger.granted, { gold }) : ledger.granted,
			stats: { ...stats, tradeSince: { ...stats.tradeSince, sold: { ...stats.tradeSince.sold, [resource]: sold + qty } } },
		},
	};
};

/**
 * Buys `qty` whole units of a resource the merchant sells (`MERCHANT_BUYABLE`) for `buyCost`, rounded up in the merchant's favour. The units are recorded as granted (so the save that holds them passes the checks) and the cost goes into the
 * spent-since-save record that tightens the gold bound; the cost itself is paid in the browser, as before. Refused for a resource that is not for sale, a quantity that is not a whole number, or a price the player cannot plausibly pay.
 *
 * @category Economy/Merchant
 * @order 11
 */
export const buyResource = (ledger: Ledger, stored: StoredSave, nowSec: number, resource: string, qty: number): TradeResult => {
	if (!(MERCHANT_BUYABLE as readonly string[]).includes(resource)) return { ok: false };
	if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return { ok: false };
	const cost = buyCost(resource as keyof typeof MERCHANT_RESOURCE_PRICES, qty);
	const spent = ledger.stats.tradeSince.boughtGold;
	if (cost > stockBound(ledger, stored, nowSec, 'gold', 0, spent)) return { ok: false };
	return {
		ok: true,
		gold: 0,
		ledger: {
			...ledger,
			granted: addTotals(ledger.granted, { [resource]: qty }),
			stats: { ...ledger.stats, tradeSince: { ...ledger.stats.tradeSince, boughtGold: spent + cost } },
		},
	};
};
