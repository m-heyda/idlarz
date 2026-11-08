import { RECIPE_BY_ID } from '@/catalog/recipes';
import { CRAFTING } from '@/config/crafting';
import { addDrop } from '@/lib/inventory';
import { craftLevelOf, recipeResourceGold } from '@/lib/crafting';
import type { CraftRefusal, CraftState, Inventory } from '@/lib/offline/types';

// SERVER ONLY (with the ledger). One craft request: the recipe is checked, the components are taken from the ledger's stock, the output goes
// into the bag (a potion) or the stock (a component), the XP is added. A refusal changes nothing and charges nothing. The resources
// themselves are paid by the browser (they are still client-held); the gold value of them is only counted in `craft.spent`.

export interface CraftResult {
	ok: boolean;
	reason?: CraftRefusal;
	inv: Inventory;
	craft: CraftState;
}

const refuse = (reason: CraftRefusal, inv: Inventory, craft: CraftState): CraftResult => ({ ok: false, reason, inv, craft });

/** Does `count` crafts of `recipeId` at `nowMs`. Neither input is touched; the new ones are returned. */
export const applyCraft = (inv: Inventory, craft: CraftState, recipeId: string, count: number, nowMs: number): CraftResult => {
	const recipe = Object.prototype.hasOwnProperty.call(RECIPE_BY_ID, recipeId) ? RECIPE_BY_ID[recipeId] : undefined;
	if (!Number.isInteger(count) || count < 1 || count > CRAFTING.maxCount) return refuse('bad_request', inv, craft);
	if (!recipe) return refuse('unknown_recipe', inv, craft);
	if (recipe.kind !== 'potion' && recipe.kind !== 'component') return refuse('not_craftable', inv, craft);
	if (craftLevelOf(craft.xp).level < recipe.unlock) return refuse('locked', inv, craft);
	if (nowMs - craft.last < CRAFTING.minGapMs) return refuse('too_fast', inv, craft);

	const stock = { ...craft.stock };
	for (const input of recipe.inputs) {
		if (!('component' in input)) continue;
		stock[input.component] = (stock[input.component] ?? 0) - input.qty * count;
		if (stock[input.component] < 0) return refuse('no_components', inv, craft);
	}

	let bag = inv.bag;
	if ('item' in recipe.output) {
		const added = addDrop(bag, { kind: 'consumable', id: recipe.output.item, qty: recipe.output.qty * count });
		if (added.overflow > 0) return refuse('bag_full', inv, craft);
		bag = added.bag;
	} else {
		const made = (stock[recipe.output.component] ?? 0) + recipe.output.qty * count;
		if (made > CRAFTING.componentCap) return refuse('stock_full', inv, craft);
		stock[recipe.output.component] = made;
	}
	for (const key of Object.keys(stock)) if (stock[key] <= 0) delete stock[key];

	return {
		ok: true,
		inv: 'item' in recipe.output ? { ...inv, bag, ver: inv.ver + 1 } : inv,
		craft: {
			...craft,
			xp: craft.xp + recipe.xp * count,
			ord: craft.ord + count,
			stock,
			spent: craft.spent + recipeResourceGold(recipe) * count,
			last: nowMs,
		},
	};
};

/** Parses the body of /api/craft (null: not one). The numbers are checked again by `applyCraft`. */
export const parseCraft = (raw: Record<string, unknown>): { recipeId: string; count: number } | null =>
	typeof raw.recipeId === 'string' && raw.recipeId.length <= 40 && typeof raw.count === 'number' && Number.isInteger(raw.count) && raw.count >= 0
		? { recipeId: raw.recipeId, count: raw.count }
		: null;
