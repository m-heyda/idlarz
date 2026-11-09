import { GRADES, GRADE_INFO, gradeOfItem, type Grade } from '@/catalog/items/grades';
import { ITEM_CATALOG } from '@/catalog';
import { MERCHANT_GOODS } from '@/config/merchant';
import { LOOT_SOURCES } from '@/catalog/lootConfig';
import { limitOf, type LimitContext } from '@/lib/limits';
import { generateLoot, resolveSourceLevel } from '@/lib/loot';
import { sellValueOf } from '@/lib/itemInstance';
import { mulberry32, type Rng } from '@/lib/rng';
import type { Equipment, ItemInstance, MerchantRefresh, MerchantStock } from '@/types/game';

// The merchant's shuffling goods: a few pieces of gear rolled by the shared loot pipeline (source `merchant`), refreshed on a
// timer of play time or for gold. Pure; the store applies the results and saves the stock (the price is derived, never stored).

/** What a piece of gear costs at the merchant: far above what he pays for it, so buying and selling can never print gold. */
export const shopPriceOf = (item: ItemInstance): number => Math.ceil(sellValueOf(item) * MERCHANT_GOODS.priceFactor);

/** The gold the next paid refresh costs, when `refreshesBought` have been bought: it doubles each time, up to a cap of 1b. */
export const refreshCost = (refreshesBought: number, ctx: LimitContext = {}): number => {
	const { growth, cap } = MERCHANT_GOODS.refresh;
	const n = Math.max(0, Math.floor(refreshesBought));
	return Math.min(cap, limitOf('merchantRefreshBase', ctx) * growth ** n);
};

/** Free refreshes left in the current window (a window of play time starts at the first refresh after the last one ended). */
export const freeRefreshesLeft = (refresh: MerchantRefresh, playSeconds: number): number => {
	const { freePerWindow, windowSec } = MERCHANT_GOODS.refresh;
	return playSeconds - refresh.windowAt >= windowSec ? freePerWindow : Math.max(0, freePerWindow - refresh.freeUsed);
};

/** Seconds of play until the next refresh (free or paid) is allowed (0 when it is). */
export const refreshCooldown = (refresh: MerchantRefresh, playSeconds: number): number =>
	refresh.lastAt > 0 ? Math.max(0, Math.ceil(MERCHANT_GOODS.refresh.cooldownSec - (playSeconds - refresh.lastAt))) : 0;

/** The refresh record after a refresh made now (`free`: it used one of the window's free refreshes). */
export const afterRefresh = (refresh: MerchantRefresh, playSeconds: number, free: boolean): MerchantRefresh => {
	const fresh = playSeconds - refresh.windowAt >= MERCHANT_GOODS.refresh.windowSec;
	return { windowAt: fresh ? playSeconds : refresh.windowAt, freeUsed: (fresh ? 0 : refresh.freeUsed) + (free ? 1 : 0), lastAt: playSeconds };
};

/**
 * The best ladder grade the player wears (G1 with nothing worn, or only pieces outside the ladder). The shelf never sells above it:
 * the next grade stays a reward for fights and chests until the player has worn the one before it (IDL-48).
 */
export const bestWornGrade = (equipment: Equipment): Grade => {
	let best = 0;
	for (const item of Object.values(equipment)) {
		const grade = item ? gradeOfItem(ITEM_CATALOG[item.base] ?? {}) : undefined;
		if (grade) best = Math.max(best, GRADES.indexOf(grade));
	}
	return GRADES[best];
};

/**
 * The item level the goods are built around and the one they may never pass. The world (castle) level sets how far the shelf can
 * go; the gear the player wears (its average item level) holds it down, so it never sells much better than what is already worn.
 * With a `grade` the shelf is also held inside that grade's item level window (a grade has no items above it).
 */
export const shelfLevels = (castleLevel: number, averageLevel: number, grade?: Grade): { centre: number; max: number } => {
	const worn = Math.max(1, Math.round(averageLevel));
	const world = resolveSourceLevel(LOOT_SOURCES.merchant.level!, castleLevel);
	const top = grade ? GRADE_INFO[grade].levels[1] : Infinity;
	return { centre: Math.min(world, worn + MERCHANT_GOODS.centreAboveAverage, top), max: Math.min(worn + MERCHANT_GOODS.maxAboveAverage, top) };
};

/**
 * A new shelf of goods, rolled at the world (castle) level and the player's gear, and stamped with the play time it was made.
 * `grade` is the best grade the player wears (`bestWornGrade`): nothing above it is on the shelf. Pure, so the server can take it as is.
 */
export const generateMerchantStock = (
	castleLevel: number,
	averageLevel: number,
	rng: Rng,
	playSeconds: number,
	ctx: LimitContext = {},
	grade?: Grade,
): MerchantStock => {
	const { centre, max } = shelfLevels(castleLevel, averageLevel, grade);
	const result = generateLoot({ sourceId: 'merchant', castleLevel, level: centre, maxItemLevel: max, maxGrade: grade }, rng);
	if (result.warnings.length) console.warn('[loot]', ...result.warnings);
	const offers = result.drops.flatMap((drop) => (drop.kind === 'gear' ? [drop.item] : []));
	return { at: playSeconds, offers: offers.slice(0, limitOf('merchantOffers', ctx)) };
};

/**
 * The generator for a shelf the clock reshuffles: seeded by the play time it is made at, so the timed rotation never takes
 * numbers from `Math.random` (the rest of the game's randomness, spawns and chests, is the same with or without a shelf).
 */
export const rotationRng = (playSeconds: number): Rng => mulberry32(Math.floor(playSeconds * 1000) ^ 0x5bd1e995);

/** One place on the shop's shelf: a piece of the rolled gear (by its index in the stock) or a supply that is always in stock (by item id). */
export type ShelfCell = { kind: 'offer'; index: number; key: string } | { kind: 'supply'; id: string; key: string };

/** A small stable hash of a string (the order of the shelf comes from it). */
const hashOf = (text: string): number => {
	let h = 5381;
	for (let i = 0; i < text.length; i++) h = (Math.imul(h, 33) ^ text.charCodeAt(i)) >>> 0;
	return h;
};

/**
 * The shelf as one row of places: the rolled gear and the supplies (potions) mixed in an order that belongs to this stock (seeded by the
 * play time it was made at) and to each thing itself, so it stays the same between renders and when a piece is bought, the others do
 * not jump to new places. A new stock, a rotation or a paid refresh, shuffles it again.
 */
export const shelfCells = (stock: MerchantStock | null, supplyIds: readonly string[]): ShelfCell[] => {
	const seed = Math.floor((stock?.at ?? 0) * 1000) ^ 0x2f1d3a7b;
	const cells: ShelfCell[] = [
		...(stock?.offers ?? []).map((item, index): ShelfCell => ({ kind: 'offer', index, key: `offer:${item.base}:${item.level}:${item.rarity}` })),
		...supplyIds.map((id): ShelfCell => ({ kind: 'supply', id, key: `supply:${id}` })),
	];
	const order = new Map(cells.map((cell, i) => [cell, mulberry32(seed ^ hashOf(cell.key))() + i * 1e-9]));
	return [...cells].sort((a, b) => order.get(a)! - order.get(b)!);
};

/** Seconds of play until the shelf is reshuffled (0 once it is due). */
export const secondsToRotation = (stock: MerchantStock, playSeconds: number, ctx: LimitContext = {}): number =>
	Math.max(0, limitOf('merchantRotateSec', ctx) - (playSeconds - stock.at));

/**
 * The merchant's clocks count play time, which does not run while the player is away. After an absence of `elapsedSec` they catch up: a shelf
 * that would have been reshuffled by then is dropped (a new one is rolled on the next tick), and a free-refresh window that would have ended
 * gives its free refreshes back. (The 30 s cooldown between refreshes is not touched: an absence is much longer.)
 */
export const afterAbsence = (
	stock: MerchantStock | null,
	refresh: MerchantRefresh,
	playSeconds: number,
	elapsedSec: number,
	ctx: LimitContext = {},
): { merchantStock: MerchantStock | null; merchantRefresh: MerchantRefresh } => {
	const elapsed = Math.max(0, elapsedSec);
	const dueAfter = stock ? secondsToRotation(stock, playSeconds, ctx) : 0;
	const windowEnded = playSeconds + elapsed - refresh.windowAt >= MERCHANT_GOODS.refresh.windowSec;
	return {
		merchantStock: stock && dueAfter <= elapsed ? null : stock,
		merchantRefresh: windowEnded ? { ...refresh, windowAt: 0, freeUsed: 0 } : refresh,
	};
};

export const stockDue = (stock: MerchantStock | null, playSeconds: number, ctx: LimitContext = {}): boolean =>
	!stock || secondsToRotation(stock, playSeconds, ctx) <= 0;
