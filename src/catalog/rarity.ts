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
	/** Gold the merchant pays for an item of this rarity at item level 1 (grows with the item level, see `sellValueOf`) */
	sellValue: number;
	glow: { blur: number; alpha: number; pulse: boolean };
	/** How many affixes an item of this rarity rolls (inclusive range) */
	minAffixes: number;
	maxAffixes: number;
	/** Multiplier on the base stats. 1 everywhere for now: rarity adds affixes, not a second multiplier on top of item level. */
	statMultiplier: number;
	/** A disabled rarity is never rolled and never accepted from a save */
	enabled: boolean;
}

export const RARITIES: Record<EquipmentRarity, RarityDef> = {
	common: { id: 'common', label: 'Common', color: '#c8c8c8', order: 0, sellValue: 8, glow: { blur: 2, alpha: 0.35, pulse: false }, minAffixes: 0, maxAffixes: 0, statMultiplier: 1, enabled: true },
	uncommon: { id: 'uncommon', label: 'Uncommon', color: '#4ade80', order: 1, sellValue: 90, glow: { blur: 3, alpha: 0.55, pulse: false }, minAffixes: 1, maxAffixes: 1, statMultiplier: 1, enabled: true },
	rare: { id: 'rare', label: 'Rare', color: '#60a5fa', order: 2, sellValue: 250, glow: { blur: 4, alpha: 0.7, pulse: false }, minAffixes: 2, maxAffixes: 3, statMultiplier: 1, enabled: true },
	epic: { id: 'epic', label: 'Epic', color: '#c084fc', order: 3, sellValue: 700, glow: { blur: 5, alpha: 0.85, pulse: true }, minAffixes: 3, maxAffixes: 4, statMultiplier: 1, enabled: true },
	legendary: { id: 'legendary', label: 'Legendary', color: '#fb923c', order: 4, sellValue: 2000, glow: { blur: 6, alpha: 0.95, pulse: true }, minAffixes: 4, maxAffixes: 5, statMultiplier: 1, enabled: true },
};

export const RARITY_ORDER = (Object.keys(RARITIES) as EquipmentRarity[]).sort((a, b) => RARITIES[a].order - RARITIES[b].order);

/** Rarity ids that can be rolled, lowest rank first. */
export const enabledRarities = (table: Record<string, RarityDef> = RARITIES): RarityDef[] =>
	Object.values(table)
		.filter((rarity) => rarity.enabled)
		.sort((a, b) => a.order - b.order);
