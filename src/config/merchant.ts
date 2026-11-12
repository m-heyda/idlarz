// The merchant: resource prices, upgrades, shop goods.
// Part of the former gameConfig.ts (split in IDL-15); the values are unchanged.
import { RESOURCES, type MerchantResourceKey } from '@/catalog/resources';
import { shopItems } from '@/catalog/loot';
import { HARD_LIMITS, LIMITS } from '@/config/limits';
import { resourceKeys, fromResources } from './resources';

// Merchant
// Resource pricing constants (gold per unit)
/**
 * The merchant buys resources at these gold prices per unit. Payout is `floor(units x price x (1 + 0.03 x Haggler))` ({@link sellPayout}).
 * Wood, stone, coal, food and meat can be bought at 2x the sell price, rounded up ({@link MERCHANT_BUY_MULTIPLIER}, {@link buyCost}); farm products are never sold to the player.
 *
 * @category Economy/Merchant
 * @order 1
 * @table merchant-prices
 */
export const MERCHANT_RESOURCE_PRICES = fromResources(
	resourceKeys.filter((key) => 'merchant' in RESOURCES[key]),
	(key) => (RESOURCES[key] as { merchant: { price: number } }).merchant.price,
) as { [K in MerchantResourceKey]: number };

/**
 * Merchant upgrades: permanent bonuses bought with gold. Level N+1 costs ceil(baseCost x costGrowth^N). Everything except Pack Rat
 * starts again on a rebirth (like click power); Pack Rat's bigger bag stays, because the bag survives a rebirth.
 * They are the game's late gold sink: the first levels are cheap, the last ones are far out of reach before the first rebirth (all the
 * ladders together cost over a billion; tests/economy/merchantUpgrades.test.ts keeps it that way) and are bought over several runs.
 * `group` only decides the heading of the card in the Upgrades tab.
 */
export const MERCHANT_UPGRADE_GROUPS = {
	economy: 'Economy',
	combat: 'Combat',
	rebirth: 'Rebirth',
} as const;

/**
 * Merchant upgrades are bought with gold; the cost of level N+1 is `ceil(baseCost x growth^N)` ({@link merchantUpgradeCost}). All but Pack Rat start again on a rebirth.
 *
 * @category Economy/Merchant
 * @order 3
 * @table merchant-upgrades
 */
export const MERCHANT_UPGRADES = {
	haggler: {
		label: 'Haggler',
		group: 'economy',
		description: (n: number) => `+${Math.round(n * 3)}% gold from everything you sell`,
		maxLevel: 10,
		effectPerLevel: 0.03, // gold from selling resources and items
		baseCost: 100000,
		costGrowth: 1.9,
	},
	bulk: {
		label: 'Bulk Discount',
		group: 'economy',
		description: (n: number) => `-${n}% tile cost`,
		maxLevel: 8,
		effectPerLevel: 1, // percentage points, added to Charisma and Thrift (REBIRTH.discountCapPercent still caps the sum)
		baseCost: 250000,
		costGrowth: 2.1,
	},
	charm: {
		label: 'Lucky Charm',
		group: 'economy',
		description: (n: number) => `+${n * 2} Luck for chests and kills`,
		maxLevel: 10,
		effectPerLevel: 2, // Luck
		baseCost: 150000,
		costGrowth: 1.9,
	},
	packrat: {
		label: 'Pack Rat',
		group: 'economy',
		description: (n: number) => `+${n * 8} bag slots`,
		maxLevel: 6,
		effectPerLevel: 8, // bag slots
		baseCost: 500000,
		costGrowth: 3,
	},
	foreman: {
		label: 'Foreman',
		group: 'economy',
		description: (n: number) => `+${n}% income from every resource, gold included`,
		maxLevel: 10,
		effectPerLevel: 0.01, // multiplies the income of every resource but XP (utils/game/merchant.ts, merchantIncomeMultiplier)
		baseCost: 400000,
		costGrowth: 1.9,
	},
	skinner: {
		label: 'Skinner',
		group: 'economy',
		description: (n: number) => `+${n * 5}% meat and hide from your animals`,
		maxLevel: 8,
		effectPerLevel: 0.05, // on top of the farm upgrades
		baseCost: 300000,
		costGrowth: 1.9,
	},
	swift: {
		label: 'Quick Hands',
		group: 'combat',
		description: (n: number) => `+${n * 2}% attack speed`,
		maxLevel: 8,
		effectPerLevel: 2, // % attacks per second
		baseCost: 250000,
		costGrowth: 1.9,
	},
	keen: {
		label: 'Keen Eye',
		group: 'combat',
		description: (n: number) => `+${n}% crit chance`,
		maxLevel: 8,
		effectPerLevel: 1, // percentage points (COMBAT.crit.maxCritChance still caps the total)
		baseCost: 250000,
		costGrowth: 1.9,
	},
	deadly: {
		label: 'Deadly Aim',
		group: 'combat',
		description: (n: number) => `+${n}% chance that a crit is a super crit`,
		maxLevel: 8,
		effectPerLevel: 1, // percentage points (COMBAT.crit.maxSuperChance still caps the total)
		baseCost: 250000,
		costGrowth: 1.9,
	},
	might: {
		label: 'Might',
		group: 'combat',
		description: (n: number) => `+${n * 2}% damage with physical weapons`,
		maxLevel: 8,
		effectPerLevel: 2, // %
		baseCost: 250000,
		costGrowth: 1.9,
	},
	arcana: {
		label: 'Arcana',
		group: 'combat',
		description: (n: number) => `+${n * 2}% damage with staves and wands`,
		maxLevel: 8,
		effectPerLevel: 2, // %
		baseCost: 250000,
		costGrowth: 2,
	},
	fang: {
		label: 'Vampiric Fang',
		group: 'combat',
		description: (n: number) => `+${n * 0.5}% life leech: HP back from the damage you deal`,
		maxLevel: 6,
		effectPerLevel: 0.5, // % of the damage dealt (STAT_RULES.lifeLeechCap still caps the total)
		baseCost: 300000,
		costGrowth: 2,
	},
	wind: {
		label: 'Second Wind',
		group: 'combat',
		description: (n: number) => `+${n * 0.25} HP regenerated per second`,
		maxLevel: 6,
		effectPerLevel: 0.25, // HP/s, in and out of fights
		baseCost: 300000,
		costGrowth: 2,
	},
	tithe: {
		label: 'Ancestral Tithe',
		group: 'rebirth',
		description: (n: number) => `+${n * 5}% Embers from your next rebirth`,
		maxLevel: 10,
		effectPerLevel: 0.05, // multiplies the Embers of a rebirth (emberGain); starts again with the rebirth like the rest
		baseCost: 600000,
		costGrowth: 1.9,
	},
} as const;

export type MerchantUpgradeId = keyof typeof MERCHANT_UPGRADES;

/**
 * Supplies (potions) the merchant always sells, each at its own `shop` price in the catalog. Every price is at least 3x the item's
 * sell value (x1.3 for a maxed Haggler), so buying and selling can never print gold: tests/economy/merchantShop.test.ts checks every entry.
 */
export const MERCHANT_SHOP_ITEMS: { id: string; price: number }[] = shopItems();

// The merchant's shuffling goods (Goods tab): pieces of gear rolled by the loot pipeline (source `merchant`, see lootConfig).
/**
 * The goods shelf and its refresh rules ({@link generateMerchantStock}). Potions are always in stock at their catalog `shop` price (`MERCHANT_SHOP_ITEMS`).
 *
 * - **Shelf**: 6 pieces of gear (`LIMITS.merchantOffers`) from the loot source `merchant` (common 60 / uncommon 40, see {@link generateLoot}), item level centred at most 3 above the average worn item
 *   level and never more than 5 above it, otherwise built from the castle level (4 + 3 per castle level above 1). Price is `ceil(sell value x 5)` ({@link shopPriceOf}). Reshuffled every 1,800 s of play time.
 * - **Refresh**: 3 free per 12 h of play time (`windowSec` 43,200), 30 s between any two, then the paid price `10,000 x 2^(paid refreshes)` capped at 1e9 ({@link refreshCost}).
 *   The count is never reset, not even by a rebirth.
 * - **Item sale value**: see {@link sellValueOf}.
 *
 * @category Economy/Merchant
 * @order 2
 */
export const MERCHANT_GOODS = {
	offers: LIMITS.merchantOffers, // pieces on the shelf (base value: read it through limitOf('merchantOffers', ctx))
	rotateSec: LIMITS.merchantRotateSec, // the shelf is reshuffled after this much play time (limitOf('merchantRotateSec', ctx))
	maxOffers: HARD_LIMITS.merchantOffers, // what a save may hold
	priceFactor: 5, // gold per gold of sell value: above the 3.9x a max Haggler could resell at, so buying and selling never gains
	// A paid refresh costs `refreshBase` x growth^(refreshes bought so far), capped (10k, 20k, 40k ... 10m at the 11th, 1b from the 18th).
	// Counted for good (a rebirth does not start it again). `freePerWindow` refreshes are free every `windowSec` of play time, and
	// any refresh, free or paid, needs `cooldownSec` since the last one.
	refreshBase: LIMITS.merchantRefreshBase, // limitOf('merchantRefreshBase', ctx)
	refresh: { growth: 2, cap: 1_000_000_000, freePerWindow: 3, windowSec: 43_200, cooldownSec: 30 },
	// What the shelf may hold: never above uncommon (the rarer pieces stay a reward for fights and chests), and never more than
	// `maxAboveAverage` item levels above the average level of the gear the player wears. The shelf is built around the world (castle)
	// level, held down to `centreAboveAverage` above that average.
	maxAboveAverage: 5,
	centreAboveAverage: 3,
} as const;

/** The most units one merchant trade may move (a sanity bound the server and the browser share: the browser cuts a Max over it down to this). */
export const MERCHANT_MAX_TRADE_QTY = 1e12;

// What can be bought back (as resource packs): the basics and the four farm products (eggs, milk, hide and wool, since IDL-312). A farm still earns them; the merchant sells them at the same multiple as the rest.
export const MERCHANT_BUYABLE = ['wood', 'stone', 'coal', 'food', 'meat', 'eggs', 'milk', 'hide', 'wool'] as const;

// Buying resources from the merchant costs this many times the sell price
/**
 * The merchant sells wood, stone, coal, food and meat at this multiple of the price it pays (so buying and selling can never print gold).
 *
 *
 * @category Economy/Merchant
 * @order 6
 */
export const MERCHANT_BUY_MULTIPLIER = 2;

// Resource display information
export const MERCHANT_RESOURCE_INFO = fromResources(
	resourceKeys.filter((key) => 'merchant' in RESOURCES[key]),
	(key) => {
		const { label, merchant } = RESOURCES[key] as { label: string; merchant: { description: string; pitch: string } };
		return { label, description: merchant.description, priceDescription: merchant.pitch };
	},
) as { [K in MerchantResourceKey]: { label: string; description: string; priceDescription: string } };
