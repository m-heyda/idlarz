import type { EquipmentRarity } from '@/types/game';

/**
 * Everything the game knows about a rarity, in one place: how it reads (label, colour, glow), how many affixes it rolls,
 * what it is worth and how it ranks. The item UI, the loot generator and the shop all read this, so adding a tier is
 * one row here plus a weight in the loot profiles that should drop it (nothing in the generator names a rarity).
 * `glow` drives the slot icon: blur radius in px, opacity, and whether it slowly pulses (epic and up).
 */
export interface RarityDef {
	id: string;
	label: string;
	color: string;
	/** Rank: ordering of the tiers (higher is rarer). The auto-sell filter and "sell junk" compare ranks. */
	order: number;
	/** Gold the merchant pays for a plain item of this rarity at item level 1; the item level, quality and affixes grow it (see `sellValueOf`, `ITEM_VALUE`) */
	sellValue: number;
	glow: { blur: number; alpha: number; pulse: boolean };
	/** How many affixes an item of this rarity rolls (inclusive range) */
	minAffixes: number;
	maxAffixes: number;
	/** Multiplier on the base stats of a generated piece (damage, armor, health ...): 1 for common and uncommon, more for rare and better (IDL-382). Named items keep their authored numbers. */
	statMultiplier: number;
	/** Multiplier on the value of every affix the piece rolled (IDL-382), on top of the roll: an epic Sharp affix is worth more than a rare one at the same item level and roll. */
	affixMultiplier: number;
	/** A disabled rarity is never rolled and never accepted from a save */
	enabled: boolean;
}

/**
 * Rarities: everything the game knows about one, in one place: label, colour, glow, how many affixes it rolls, what it is worth and how it ranks. Adding a tier is one row here plus a weight in the loot profiles that should drop it.
 *
 * **Rarer is stronger** (IDL-382): `statMultiplier` scales the base stats (damage, armor, health ...) of a generated piece and `affixMultiplier` the value of every affix it rolled: common and uncommon x1, rare x1.1, epic x1.25, legendary x1.5. Named items (the legendary weapons) keep their authored numbers.
 * Affix counts and the multipliers together are what an epic is worth; how often each rarity drops is the profiles' `rarityWeights` (`Loot/Config`) and the grades' `dropRarities` (`Loot/Items`).
 *
 * @category Loot/Items
 * @order 1
 */
export const RARITIES: Record<EquipmentRarity, RarityDef> = {
	common: {
		id: 'common',
		label: 'Common',
		color: '#c8c8c8',
		order: 0,
		sellValue: 300,
		glow: { blur: 2, alpha: 0.35, pulse: false },
		minAffixes: 0,
		maxAffixes: 0,
		statMultiplier: 1,
		affixMultiplier: 1,
		enabled: true,
	},
	uncommon: {
		id: 'uncommon',
		label: 'Uncommon',
		color: '#4ade80',
		order: 1,
		sellValue: 1200,
		glow: { blur: 3, alpha: 0.55, pulse: false },
		minAffixes: 1,
		maxAffixes: 1,
		statMultiplier: 1,
		affixMultiplier: 1,
		enabled: true,
	},
	rare: {
		id: 'rare',
		label: 'Rare',
		color: '#60a5fa',
		order: 2,
		sellValue: 3600,
		glow: { blur: 4, alpha: 0.7, pulse: false },
		minAffixes: 2,
		maxAffixes: 3,
		statMultiplier: 1.1,
		affixMultiplier: 1.1,
		enabled: true,
	},
	epic: {
		id: 'epic',
		label: 'Epic',
		color: '#c084fc',
		order: 3,
		sellValue: 12000,
		glow: { blur: 5, alpha: 0.85, pulse: true },
		minAffixes: 3,
		maxAffixes: 4,
		statMultiplier: 1.25,
		affixMultiplier: 1.25,
		enabled: true,
	},
	legendary: {
		id: 'legendary',
		label: 'Legendary',
		color: '#fb923c',
		order: 4,
		sellValue: 45000,
		glow: { blur: 6, alpha: 0.95, pulse: true },
		minAffixes: 4,
		maxAffixes: 5,
		statMultiplier: 1.5,
		affixMultiplier: 1.5,
		enabled: true,
	},
	/**
	 * The rarest tier, for what is one of a kind (the bosses' tooltips show it). It exists as a look first: red, ranked above legendary, and **disabled**, so nothing rolls it and no save or ledger can hold it
	 * until items of this grade are designed (then: `enabled: true`, affix counts and a weight in the loot profiles that should drop it).
	 */
	unique: {
		id: 'unique',
		label: 'Unique',
		color: '#ef4444',
		order: 5,
		sellValue: 150000,
		glow: { blur: 7, alpha: 1, pulse: true },
		minAffixes: 5,
		maxAffixes: 6,
		statMultiplier: 1.75,
		affixMultiplier: 1.75,
		enabled: false,
	},
};

export const RARITY_ORDER = (Object.keys(RARITIES) as EquipmentRarity[]).sort((a, b) => RARITIES[a].order - RARITIES[b].order);
