import type { EquipmentRarity } from '@/types/game';

/**
 * Everything the game knows about a rarity, in one place: how it reads (label, colour, glow), what it is worth and how
 * it ranks. The item UI, the drop tables and the shop all read this, so adding a tier is a one-row change.
 * `glow` drives the slot icon: blur radius in px, opacity, and whether it slowly pulses (epic and up).
 */
export interface RarityDef {
	id: EquipmentRarity;
	label: string;
	color: string;
	order: number;
	/** Flat gold the merchant pays for an item of this rarity (see the economy rule in tests/economy.test.ts) */
	sellValue: number;
	glow: { blur: number; alpha: number; pulse: boolean };
}

export const RARITIES: Record<EquipmentRarity, RarityDef> = {
	common: { id: 'common', label: 'Common', color: '#c8c8c8', order: 0, sellValue: 8, glow: { blur: 2, alpha: 0.35, pulse: false } },
	uncommon: { id: 'uncommon', label: 'Uncommon', color: '#4ade80', order: 1, sellValue: 90, glow: { blur: 3, alpha: 0.55, pulse: false } },
	rare: { id: 'rare', label: 'Rare', color: '#60a5fa', order: 2, sellValue: 250, glow: { blur: 4, alpha: 0.7, pulse: false } },
	epic: { id: 'epic', label: 'Epic', color: '#c084fc', order: 3, sellValue: 700, glow: { blur: 5, alpha: 0.85, pulse: true } },
	legendary: { id: 'legendary', label: 'Legendary', color: '#fb923c', order: 4, sellValue: 2000, glow: { blur: 6, alpha: 0.95, pulse: true } },
};

export const RARITY_ORDER = (Object.keys(RARITIES) as EquipmentRarity[]).sort((a, b) => RARITIES[a].order - RARITIES[b].order);
