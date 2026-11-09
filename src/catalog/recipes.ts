/**
 * Crafting recipes (docs/plan/crafting-v0.md). Data only: a recipe lists what it eats, what it makes, the crafting level that unlocks it and
 * the crafting XP one craft gives. Four kinds are planned; v0.1 uses `potion`, `component` and `good`.
 *   potion     usable items (a bag stack of a consumable)
 *   component  half-products that sit in a ledger counter (craft.stock), never in the bag
 *   good       trade goods: a bag stack with no use, sold to the merchant like any item (v0.1, IDL-227)
 *   gear       equipment through the loot pipeline (later, docs/plan/17-crafting.md)
 */
import type { ItemDef } from '@/types/game';
import type { MerchantResourceKey } from './resources';

export type RecipeKind = 'potion' | 'component' | 'good' | 'gear';

export interface ComponentDef {
	id: string;
	name: string;
	description: string;
}

export const COMPONENTS: Record<string, ComponentDef> = {
	glass_vial: { id: 'glass_vial', name: 'Glass Vial', description: 'A small flask of fire-blown glass. Every potion needs one.' },
	cured_leather: { id: 'cured_leather', name: 'Cured Leather', description: 'Hide cured over coal until it is supple. The base of every leather good.' },
	plank_bundle: { id: 'plank_bundle', name: 'Plank Bundle', description: 'Sawn, stone-planed boards tied in a bundle. Gear recipes will use them.' },
};

/**
 * The trade goods crafting makes (IDL-227): plain bag stacks (`kind: 'consumable'` with no effect) that exist to be sold. They join `ITEM_CATALOG` but not the loot
 * pools, so nothing drops them. The value is set against the input value at merchant prices (`recipeCostGold`): at most 1.4x, so crafting a good pays a little
 * better than selling its raw inputs and never turns into the main income (tests/crafting/recipes.test.ts, `npm run craft-sim`).
 *
 * @category Economy/Crafting
 * @order 1
 */
export const TRADE_GOODS: ItemDef[] = [
	{
		id: 'preserved_rations',
		name: 'Preserved Rations',
		kind: 'consumable',
		rarity: 'common',
		tier: 0,
		stackMax: 50,
		sellValue: 46,
		description: 'Salted meat and dried grain in a waxed cloth. Travellers pay for it.',
	},
	{
		id: 'honey_cake',
		name: 'Honey Cake',
		kind: 'consumable',
		rarity: 'common',
		tier: 0,
		stackMax: 50,
		sellValue: 46,
		description: 'A dense cake of eggs, milk and honey. Keeps for weeks.',
	},
	{
		id: 'leather_satchel',
		name: 'Leather Satchel',
		kind: 'consumable',
		rarity: 'common',
		tier: 0,
		stackMax: 50,
		sellValue: 52,
		description: 'A stitched shoulder bag. Sold, not worn.',
	},
	{
		id: 'carved_trinket',
		name: 'Carved Trinket',
		kind: 'consumable',
		rarity: 'common',
		tier: 0,
		stackMax: 50,
		sellValue: 62,
		description: 'A small wooden charm with a stone eye. Sold, not worn.',
	},
];

export type RecipeInput = { resource: MerchantResourceKey; qty: number } | { component: string; qty: number };
export type RecipeOutput = { item: string; qty: number } | { component: string; qty: number };

export interface Recipe {
	id: string;
	kind: RecipeKind;
	name: string;
	inputs: RecipeInput[];
	output: RecipeOutput;
	/** Crafting level needed */
	unlock: number;
	/** Crafting XP per craft */
	xp: number;
	/** Seconds one craft takes (the timed batch queue, docs/plan/crafting-v0.md); left out = instant, as every v0.0 recipe */
	timeSec?: number;
}

export const RECIPES: Recipe[] = [
	{
		id: 'glass_vial',
		kind: 'component',
		name: 'Glass Vial',
		inputs: [
			{ resource: 'stone', qty: 10 },
			{ resource: 'coal', qty: 5 },
		],
		output: { component: 'glass_vial', qty: 1 },
		unlock: 1,
		xp: 2,
		timeSec: 10,
	},
	{
		id: 'potion_minor',
		kind: 'potion',
		name: 'Minor Healing Potion',
		inputs: [
			{ resource: 'food', qty: 40 },
			{ component: 'glass_vial', qty: 1 },
		],
		output: { item: 'potion_minor', qty: 1 },
		unlock: 1,
		xp: 6,
		timeSec: 14,
	},
	{
		id: 'potion_greater',
		kind: 'potion',
		name: 'Greater Healing Potion',
		inputs: [
			{ resource: 'food', qty: 150 },
			{ resource: 'coal', qty: 60 },
			{ component: 'glass_vial', qty: 1 },
		],
		output: { item: 'potion_greater', qty: 1 },
		unlock: 5,
		xp: 25,
		timeSec: 30,
	},
	{
		id: 'cured_leather',
		kind: 'component',
		name: 'Cured Leather',
		inputs: [
			{ resource: 'hide', qty: 5 },
			{ resource: 'coal', qty: 3 },
		],
		output: { component: 'cured_leather', qty: 1 },
		unlock: 3,
		xp: 3,
		timeSec: 12,
	},
	{
		id: 'plank_bundle',
		kind: 'component',
		name: 'Plank Bundle',
		inputs: [
			{ resource: 'wood', qty: 12 },
			{ resource: 'stone', qty: 6 },
		],
		output: { component: 'plank_bundle', qty: 1 },
		unlock: 4,
		xp: 3,
		timeSec: 12,
	},
	{
		id: 'preserved_rations',
		kind: 'good',
		name: 'Preserved Rations',
		inputs: [
			{ resource: 'meat', qty: 20 },
			{ resource: 'food', qty: 40 },
		],
		output: { item: 'preserved_rations', qty: 1 },
		unlock: 2,
		xp: 5,
		timeSec: 15,
	},
	{
		id: 'honey_cake',
		kind: 'good',
		name: 'Honey Cake',
		inputs: [
			{ resource: 'eggs', qty: 6 },
			{ resource: 'milk', qty: 4 },
			{ resource: 'food', qty: 30 },
		],
		output: { item: 'honey_cake', qty: 1 },
		unlock: 4,
		xp: 7,
		timeSec: 20,
	},
	{
		id: 'leather_satchel',
		kind: 'good',
		name: 'Leather Satchel',
		inputs: [{ component: 'cured_leather', qty: 3 }],
		output: { item: 'leather_satchel', qty: 1 },
		unlock: 6,
		xp: 12,
		timeSec: 30,
	},
	{
		id: 'carved_trinket',
		kind: 'good',
		name: 'Carved Trinket',
		inputs: [
			{ resource: 'wood', qty: 40 },
			{ resource: 'stone', qty: 20 },
		],
		output: { item: 'carved_trinket', qty: 1 },
		unlock: 8,
		xp: 18,
		timeSec: 30,
	},
];

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
