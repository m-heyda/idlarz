import { MERCHANT_BUYABLE, MERCHANT_MAX_TRADE_QTY, MERCHANT_RESOURCE_PRICES } from '@/config/merchant';
import type { StoredSave } from '@/lib/cloudSave/pipeline';
import { isRecord } from '@/lib/isRecord';
import { sellContextOf } from '@/lib/offline/inventory';
import { addTotals, type GrantTotals, type Ledger } from '@/lib/offline/ledger';
import { emptyTrade, isEmptyTrade, recordSale, type TradeSince } from '@/lib/offline/stats';
import { buyCost, sellPayout } from '@/utils/game/merchant';

// SERVER ONLY. The merchant's resource trades (IDL-319): the price, the Haggler and Idol bonuses and the buy multiplier are worked out here, from the last accepted save, never from a figure the browser sends. The browser still previews the trade
// at once and the answer settles it (the same optimistic path as every inventory change). The server cannot see the live stock (it lives in the browser's save), so a trade is judged against an **upper bound** of what the player can hold: the last accepted
// save, plus what the rates have made since (the elapsed time is capped), plus what the server itself granted, minus what it already sold since that save, with a generous slack so an honest player is never refused. That stops a stock being sold twice
// or a stock that never existed being sold; it does not try to be exact. It is deliberately loose (2026-11-18, nobody is cheating and income alone cannot explain a stock: players buy resources, click for gold, open chests and trade between
// their own saves), so a refusal only happens for a trade far beyond anything the last save, a week of income and the server's grants could ever explain.

/** The longest stretch of income counted on top of the last accepted save: a save is uploaded far more often than this, so a longer gap only means the player is not saving. */
export const TRADE_MAX_AGE_SEC = 7 * 24 * 3600;
/**
 * How long a trade stays on the record while saves keep arriving that do not show it (a browser that lost the purchase on a reload, an older picture): after this the record is dropped, so an honest player is never refused for ever.
 * A save is uploaded every few minutes, so a correct one releases the record long before this; it only ends a record that nothing can release.
 */
export const TRADE_RECORD_MAX_AGE_SEC = 10 * 60;
/**
 * The bound is this many times the estimate plus a floor of units: income is only part of how a stock grows (buying, clicks, chests, another tab's trades), so the estimate may be well off. The slack must stay above 1 for the
 * record arithmetic of {@link settleTrades}; the floor lets a player with little in the last save still make an ordinary trade.
 */
export const TRADE_SLACK = 2;
export const TRADE_SLACK_UNITS = 100_000;

export type TradeResult = { ok: true; ledger: Ledger; gold: number } | { ok: false };

/** The record of trades since the last save as it stands at `nowSec`: a record nothing released for {@link TRADE_RECORD_MAX_AGE_SEC} is gone, so a new trade starts a fresh one and never rides on the age of an old one (or is checked against its units). */
const liveTrade = (trade: TradeSince, nowSec: number): TradeSince =>
	trade.since !== undefined && nowSec - trade.since > TRADE_RECORD_MAX_AGE_SEC ? emptyTrade() : trade;

const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0);

/** What the last accepted save plus income and the server's own grants can explain for `resource` now (no slack, no trades taken off). */
const stockEstimate = (ledger: Ledger, stored: StoredSave, nowSec: number, resource: string): number => {
	const resources = isRecord(stored.core.resources) ? stored.core.resources : {};
	const rates = stored.summary.rates as unknown as Record<string, number>;
	const elapsed = Math.min(TRADE_MAX_AGE_SEC, Math.max(0, nowSec - stored.serverSavedAt / 1000));
	const granted = (ledger.granted as GrantTotals & Record<string, number>)[resource] ?? 0;
	const grantedSeen = (ledger.grantedSeen as GrantTotals & Record<string, number>)[resource] ?? 0;
	return num(resources[resource]) + num(rates[resource]) * elapsed + Math.max(0, granted - grantedSeen);
};

/** The most of `resource` the player can plausibly hold now: see the note at the top of this file. */
const stockBound = (ledger: Ledger, stored: StoredSave, nowSec: number, resource: string, soldSince: number, boughtGold = 0): number =>
	// the slack goes on the estimate first and the trades since the save come off after it, so the slack is not a fresh allowance for every request
	Math.max(0, stockEstimate(ledger, stored, nowSec, resource) * TRADE_SLACK + TRADE_SLACK_UNITS - soldSince - boughtGold);

/** What a new picture of `have` leaves unexplained of a trade `amount` once the trade is taken off the previous estimate (the slack is allowed): none, some, or all of the trade. */
const unexplained = (estimate: number, amount: number, have: number): number => {
	const after = Math.max(0, estimate - amount);
	return Math.min(amount, Math.max(0, have - after - (after * (TRADE_SLACK - 1) + TRADE_SLACK_UNITS)));
};

/**
 * What the trade record is after a save is accepted. The save is the browser's picture of its stock. A trade leaves the record only as far as that picture accounts for it: what the new stock still holds above what the previous save plus income
 * could explain **after** the trade came off stays as the deduction (all of it for another browser's older picture that still holds the pre-sale stock, none for an honest save). The deduction is measured against the new picture, so when a
 * later, correct save arrives the rest is released and an honest player is never held back for ever. The same goes for the gold a purchase should have cost. A record that no save has released within {@link TRADE_RECORD_MAX_AGE_SEC}
 * (10 minutes since its first trade) is dropped whole: a purchase the browser lost (a reload, a retry that undid it) never shows as a debit in any save, and would otherwise cut the gold bound for ever. A new run (rebirth, New Game) or a first save starts the record again.
 */
export const settleTrades = (ledger: Ledger, previous: StoredSave | null, newCore: { resources?: unknown }, nowSec: number, newRun: boolean): TradeSince => {
	const trade = ledger.stats.tradeSince;
	if (newRun || !previous || isEmptyTrade(trade)) return emptyTrade();
	// a record nothing has released for too long is dropped; one from before the age was kept starts counting now
	const since = trade.since ?? nowSec;
	if (nowSec - since > TRADE_RECORD_MAX_AGE_SEC) return emptyTrade();
	const resources = isRecord(newCore.resources) ? newCore.resources : {};
	const sold: Record<string, number> = {};
	for (const [resource, units] of Object.entries(trade.sold)) {
		const left = unexplained(stockEstimate(ledger, previous, nowSec, resource), units, num(resources[resource]));
		if (left > 0) sold[resource] = left;
	}
	const left: TradeSince = { sold, boughtGold: unexplained(stockEstimate(ledger, previous, nowSec, 'gold'), trade.boughtGold, num(resources.gold)) };
	return isEmptyTrade(left) ? left : { ...left, since };
};

/**
 * What `grantedSeen` becomes when a save is accepted: everything the server granted, except the gold and the merchant stock of a trade the record still holds. A save that was on its way when the merchant paid or sold (its picture is older than the
 * trade) is accepted after it; if it also marked that payout "seen", the server would forget gold or units the player really holds and refuse the next trade. The grant stays unseen as long as the trade stays on the record, and both go together.
 */
export const grantedSeenAfterSave = (ledger: Ledger, trade: TradeSince): GrantTotals => {
	if (isEmptyTrade(trade)) return ledger.granted;
	const seen = { ...ledger.granted } as GrantTotals & Record<string, number>;
	const was = ledger.grantedSeen as GrantTotals & Record<string, number>;
	for (const key of ['gold', ...MERCHANT_BUYABLE]) seen[key] = was[key] ?? 0;
	return seen;
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
	if (typeof qty !== 'number' || !Number.isFinite(qty) || qty <= 0 || qty > MERCHANT_MAX_TRADE_QTY) return { ok: false };
	const record = liveTrade(ledger.stats.tradeSince, nowSec);
	const sold = record.sold[resource] ?? 0;
	if (qty > stockBound(ledger, stored, nowSec, resource, sold)) return { ok: false };
	const gold = sellPayout(MERCHANT_RESOURCE_PRICES[resource as keyof typeof MERCHANT_RESOURCE_PRICES], qty, sellContextOf(stored.core));
	const stats = recordSale({ ...ledger.stats, tradeSince: record }, Math.floor(qty), gold);
	return {
		ok: true,
		gold,
		ledger: {
			...ledger,
			granted: gold > 0 ? addTotals(ledger.granted, { gold }) : ledger.granted,
			stats: {
				...stats,
				tradeSince: { ...record, since: record.since ?? nowSec, sold: { ...record.sold, [resource]: sold + qty } },
			},
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
	if (!Number.isInteger(qty) || qty < 1 || qty > MERCHANT_MAX_TRADE_QTY) return { ok: false };
	const cost = buyCost(resource as keyof typeof MERCHANT_RESOURCE_PRICES, qty);
	const record = liveTrade(ledger.stats.tradeSince, nowSec);
	const spent = record.boughtGold;
	if (cost > stockBound(ledger, stored, nowSec, 'gold', 0, spent)) return { ok: false };
	return {
		ok: true,
		gold: 0,
		ledger: {
			...ledger,
			granted: addTotals(ledger.granted, { [resource]: qty }),
			stats: { ...ledger.stats, tradeSince: { ...record, since: record.since ?? nowSec, boughtGold: spent + cost } },
		},
	};
};
