// The merchant's upgrades, what selling pays and what buying costs (part of the former utils/gameUtils.ts, split in IDL-15).
import { MERCHANT_BUY_MULTIPLIER, MERCHANT_RESOURCE_PRICES, MERCHANT_UPGRADES, type MerchantUpgradeId } from '@/config/merchant';
import type { PrestigeState } from '@/types/game';
import type { CombatBonus } from '@/lib/combat';

// Merchant upgrades
export type MerchantUpgrades = Partial<Record<string, number>>;

export const merchantLevel = (upgrades: MerchantUpgrades | undefined, id: MerchantUpgradeId): number =>
	Math.max(0, Math.min(MERCHANT_UPGRADES[id].maxLevel, Math.floor(upgrades?.[id] ?? 0)));

export const merchantEffect = (upgrades: MerchantUpgrades | undefined, id: MerchantUpgradeId): number =>
	merchantLevel(upgrades, id) * MERCHANT_UPGRADES[id].effectPerLevel;

/**
 * Gold price of the next level of a merchant upgrade.
 *
 * @category Economy/Merchant
 * @order 7
 * @formula
 * cost of level N+1 = ceil(baseCost x growth^N)
 */
export const merchantUpgradeCost = (id: MerchantUpgradeId, level: number): number =>
	Math.ceil(MERCHANT_UPGRADES[id].baseCost * Math.pow(MERCHANT_UPGRADES[id].costGrowth, level));

/** What can raise what the merchant pays: the merchant bonuses now, rebirth (Embers) effects later. A whole game state fits. */
export interface SellContext {
	merchantUpgrades?: MerchantUpgrades;
	prestige?: PrestigeState;
}

/**
 * The sources of the sell bonus, each an amount added to 1 (0.03 is +3 %). Every payout for what the player sells (resources,
 * bag gear, junk, auto-sold drops, the previews and the net-worth check) goes through `sellMultiplier`, so a new bonus (an Ember
 * effect, a merchant level, an event) is one entry here and applies to all of them alike.
 */
export const SELL_BONUSES: ((ctx: SellContext) => number)[] = [(ctx) => merchantEffect(ctx.merchantUpgrades, 'haggler')];

/** Multiplier on every gold payout from selling to the merchant. */
export const sellMultiplier = (ctx: SellContext | undefined): number => 1 + SELL_BONUSES.reduce((sum, bonus) => sum + (ctx ? bonus(ctx) : 0), 0);

/**
 * Gold for selling `qty` of something worth `unit` each.
 *
 * @category Economy/Merchant
 * @order 4
 * @formula
 * payout = floor(units x unit price x (1 + 0.03 x Haggler level))
 * @see sellMultiplier (src/utils/game/merchant.ts)
 */
export const sellPayout = (unit: number, qty: number, ctx: SellContext | undefined): number => Math.floor(unit * qty * sellMultiplier(ctx));

/**
 * Gold for buying `units` of a resource from the merchant: twice the selling price, rounded up in the merchant's favour (the store and the Resources tab use this).
 *
 * @category Economy/Merchant
 * @order 5
 * @formula
 * cost = ceil(units x sell price x 2)
 */
export const buyCost = (resource: keyof typeof MERCHANT_RESOURCE_PRICES, units: number): number =>
	Math.ceil(units * MERCHANT_RESOURCE_PRICES[resource] * MERCHANT_BUY_MULTIPLIER);

/** Luck from the Lucky Charm, added to the character's Luck for chests and kills. */
export const merchantLuck = (upgrades: MerchantUpgrades | undefined): number => merchantEffect(upgrades, 'charm');

/** The Foreman's multiplier on the income of every resource but XP (1 = none). */
export const merchantIncomeMultiplier = (upgrades: MerchantUpgrades | undefined): number => 1 + merchantEffect(upgrades, 'foreman');

/** What the merchant's combat upgrades add to the fight: one place, read by the readouts (effectiveStats), the server's fights and the regeneration. */
export const merchantCombat = (upgrades: MerchantUpgrades | undefined): CombatBonus => ({
	atkSpeedPct: merchantEffect(upgrades, 'swift'),
	critPct: merchantEffect(upgrades, 'keen'),
	superCritPct: merchantEffect(upgrades, 'deadly'),
	physPct: merchantEffect(upgrades, 'might'),
	magicPct: merchantEffect(upgrades, 'arcana'),
	leechPct: merchantEffect(upgrades, 'fang'),
	regen: merchantEffect(upgrades, 'wind'),
});
