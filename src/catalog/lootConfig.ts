// Loot configuration: which sources give what. Pure data; the pipeline in src/lib/loot reads it and nothing here is
// code. All numbers are STARTING POINTS to be tuned with `npm run loot-sim` (docs/10-loot-system.md).
//
//   source (rat, ratKing, chest) --lootProfileId--> profile --generalPoolId / bonusTables--> pools --> item definitions
//
// Rarity, item level, drop quantity and eligibility are separate: the profile says how many rolls and which rarity weights,
// the source says what level it is, the pools say which items may appear, and the items say which levels they exist at.

/** A set of items a profile can draw from. Membership: listed ids, the item's own `pools`, or all `requireTags`. */
export interface PoolDef {
	id: string;
	includeIds?: string[];
	/** An item must have ALL of these tags (ItemDef.tags) */
	requireTags?: string[];
	excludeTags?: string[];
	excludeIds?: string[];
	/** Per-item weight in this pool when it should differ from the item's `poolWeight` (potions drop differently per source) */
	weights?: Record<string, number>;
	/** Per-item minimum source item level in this pool (the greater potion only drops from older rats, but freely from chests) */
	minLevels?: Record<string, number>;
	/** Per-item quantity of a consumable drop (default 1) */
	quantities?: Record<string, number>;
	enabled: boolean;
}

/** How many equipment rolls, and whether each succeeds. The first `guaranteed` rolls always succeed. */
export interface RollsDef {
	min: number;
	max: number;
	guaranteed?: number;
	chancePerRoll: number;
	/** Added to `chancePerRoll` per monster tier above 1 */
	chancePerTier?: number;
}

export interface ItemLevelDef {
	/** Added to the source level (a harder profile may offset it; never double-count a tier bonus that the source level already has) */
	offset: number;
	/** The item level is rolled in source level + offset +/- variance */
	variance: number;
	min: number;
	max: number;
}

/**
 * An extra reward channel on top of the general equipment rolls: a targeted pool (named items), potions, a boss's own
 * pool. `placement` says how it combines with the general rolls: `extra` adds to them (default), `fallback` only runs when
 * no equipment has dropped yet, `replace` cancels them when it triggers (a documented replacement, e.g. a chest's legendary).
 */
export interface BonusTable {
	id: string;
	poolId: string;
	/** Chance the table triggers at all (default 1) */
	chance?: number;
	/** Added to `chance` per monster tier above 1 */
	chancePerTier?: number;
	/** How many items it gives once triggered; default one */
	rolls?: RollsDef;
	/** `rolled`: the item's rarity is rolled from the profile's weights (bases). `fixed`: as the item defines it (named items, consumables). */
	mode: 'rolled' | 'fixed';
	/** Take every item in the pool once, with its quantity (the Rat King's potions) */
	takeAll?: boolean;
	/** Prefer pool items the player does not own yet while any remain (the King's set pieces) */
	preferMissing?: boolean;
	/** Own item level window; default: the profile's */
	itemLevel?: Pick<ItemLevelDef, 'offset' | 'variance'>;
	/** Bad-luck protection: each miss adds `perMiss` to the chance (up to `maxBonus`); a drop resets it */
	pity?: { perMiss: number; maxBonus: number };
	placement?: 'extra' | 'fallback' | 'replace';
}

export interface LootProfile {
	id: string;
	rolls: RollsDef;
	itemLevel: ItemLevelDef;
	/** Relative weights, normalised at runtime (they need not sum to 100). A rarity missing here cannot drop from this profile. */
	rarityWeights: Record<string, number>;
	/** A rarity cannot drop below this item level (data, not an item-specific condition) */
	rarityLevelGate?: Record<string, number>;
	/** Pool the general equipment rolls draw from; null = no general rolls */
	generalPoolId: string | null;
	bonusTables: BonusTable[];
	enabled: boolean;
}

/** Where a source's level comes from: the monster's tier and the castle level (the game's world level). Never the player's level. */
export interface SourceLevelDef {
	base: number;
	perTier: number;
	perCastleLevel: number;
}

export interface LootSource {
	id: string;
	lootProfileId: string;
	level: SourceLevelDef;
}

export const LOOT_POOLS: Record<string, PoolDef> = {
	general_equipment: { id: 'general_equipment', requireTags: ['gear'], excludeTags: ['named'], enabled: true },
	rattatui_set: { id: 'rattatui_set', enabled: true }, // members list it in their own `pools`
	legendary_weapons: { id: 'legendary_weapons', enabled: true },
	potions_rat: { id: 'potions_rat', includeIds: ['potion_minor', 'potion_greater'], weights: { potion_minor: 4, potion_greater: 1 }, minLevels: { potion_greater: 7 }, enabled: true },
	potions_king: { id: 'potions_king', includeIds: ['potion_minor', 'potion_greater'], quantities: { potion_minor: 2, potion_greater: 1 }, enabled: true },
	potions_chest: { id: 'potions_chest', includeIds: ['potion_minor', 'potion_greater'], weights: { potion_minor: 60, potion_greater: 25 }, enabled: true },
};

export const LOOT_PROFILES: Record<string, LootProfile> = {
	normal_monster: {
		id: 'normal_monster',
		rolls: { min: 1, max: 1, chancePerRoll: 0.12, chancePerTier: 0.02 },
		itemLevel: { offset: 0, variance: 1, min: 1, max: 100 },
		rarityWeights: { common: 70, uncommon: 22, rare: 7, epic: 1, legendary: 0.2 },
		rarityLevelGate: { rare: 3, epic: 8, legendary: 15 },
		generalPoolId: 'general_equipment',
		bonusTables: [{ id: 'rat_potion', poolId: 'potions_rat', chance: 0.25, chancePerTier: 0.03, mode: 'fixed', itemLevel: { offset: 0, variance: 0 } }],
		enabled: true,
	},
	boss: {
		id: 'boss',
		rolls: { min: 1, max: 1, guaranteed: 1, chancePerRoll: 1 },
		itemLevel: { offset: 0, variance: 0, min: 1, max: 100 },
		rarityWeights: { common: 20, uncommon: 30, rare: 30, epic: 15, legendary: 5 },
		generalPoolId: 'general_equipment',
		bonusTables: [
			// Two rolls: the first always gives a set piece, the second does 40% of the time (as before); missing pieces first
			{ id: 'king_set', poolId: 'rattatui_set', mode: 'fixed', rolls: { min: 2, max: 2, guaranteed: 1, chancePerRoll: 0.4 }, preferMissing: true, itemLevel: { offset: 0, variance: 0 } },
			{ id: 'king_legendary', poolId: 'legendary_weapons', mode: 'fixed', chance: 0.05, pity: { perMiss: 0.01, maxBonus: 0.1 }, itemLevel: { offset: 0, variance: 0 } },
			{ id: 'king_potions', poolId: 'potions_king', mode: 'fixed', takeAll: true },
		],
		enabled: true,
	},
	basic_chest: {
		id: 'basic_chest',
		// The chest's item reward is one item: gear 82% of the time, else a potion (the old pool's gear:potion weight ratio)
		rolls: { min: 1, max: 1, chancePerRoll: 0.82 },
		itemLevel: { offset: 0, variance: 1, min: 1, max: 100 },
		rarityWeights: { common: 62, uncommon: 24, rare: 9, epic: 4, legendary: 1 },
		rarityLevelGate: { rare: 3, epic: 6, legendary: 12 },
		generalPoolId: 'general_equipment',
		bonusTables: [
			{ id: 'chest_legendary', poolId: 'legendary_weapons', mode: 'fixed', chance: 0.019, placement: 'replace' },
			{ id: 'chest_potion', poolId: 'potions_chest', mode: 'fixed', placement: 'fallback' },
		],
		enabled: true,
	},
	// The merchant's shelf: six pieces of gear at the world level, never legendary (those stay a reward for the King and chests)
	merchant_stock: {
		id: 'merchant_stock',
		rolls: { min: 6, max: 6, guaranteed: 6, chancePerRoll: 1 },
		itemLevel: { offset: 0, variance: 2, min: 1, max: 100 },
		rarityWeights: { common: 50, uncommon: 32, rare: 14, epic: 4 },
		rarityLevelGate: { rare: 3, epic: 6 },
		generalPoolId: 'general_equipment',
		bonusTables: [],
		enabled: true,
	},
};

/** Keyed by the `DropSource` (a monster type, `chest` or the merchant's `merchant` shelf). Rat tiers 1-5 are levels 1,3,5,7,9; the Rat King is 12. */
export const LOOT_SOURCES: Record<string, LootSource> = {
	rat: { id: 'rat', lootProfileId: 'normal_monster', level: { base: 1, perTier: 2, perCastleLevel: 3 } },
	ratKing: { id: 'ratKing', lootProfileId: 'boss', level: { base: 12, perTier: 0, perCastleLevel: 3 } },
	chest: { id: 'chest', lootProfileId: 'basic_chest', level: { base: 4, perTier: 0, perCastleLevel: 3 } },
	merchant: { id: 'merchant', lootProfileId: 'merchant_stock', level: { base: 4, perTier: 0, perCastleLevel: 3 } },
};
