/**
 * Crafting recipes (docs/plan/crafting-v0.md). Data only: a recipe lists what it eats, what it makes, the crafting level that unlocks it and
 * the crafting XP one craft gives. Four kinds are planned; v0.0 uses `potion` and `component`.
 *   potion     usable items (a bag stack of a consumable)
 *   component  half-products that sit in a ledger counter (craft.stock), never in the bag
 *   good       sellable goods (later)
 *   gear       equipment through the loot pipeline (later, docs/17)
 */
import type { MerchantResourceKey } from './resources';

export type RecipeKind = 'potion' | 'component' | 'good' | 'gear';

export interface ComponentDef {
	id: string;
	name: string;
	description: string;
}

export const COMPONENTS: Record<string, ComponentDef> = {
	glass_vial: { id: 'glass_vial', name: 'Glass Vial', description: 'A small flask of fire-blown glass. Every potion needs one.' },
};

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
	},
];

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
