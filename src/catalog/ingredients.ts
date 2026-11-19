import { JUNK_ITEMS } from '@/catalog/items/junk';
import { FAMILY_DROPS, MONSTER_DROPS } from '@/catalog/monsterDrops';
import { ROCK_DROPS } from '@/config/rocks';

// Crafting ingredients (owner request 2026-11-18, IDL-358): the rarer monster ingredients are no longer junk. They drop straight into the **crafting bag** (`craft.stock`, under the key `ing_<name>`), cannot be sold and
// have **no recipe yet**: they are the base for the chains the crafting brainstorm plans (potions, ingots, planks, jewelry). The cheap, plentiful drops stay junk for the merchant. Pure data.
//
// The old junk ids (`junk_blood` ...) stay in the item catalog for good (ids are append-only): stacks players already hold remain sellable junk, nothing new drops under those ids.

export type IngredientTier = 1 | 2 | 3 | 4;

export interface IngredientDef {
	/** The junk id the Bestiary drop tables and the monster tables name */
	junkId: string;
	/** The crafting bag key (a component id) */
	id: string;
	/** Planned tier (IDL-358): 1 grey, 2 green, 3 blue, 4 purple */
	tier: IngredientTier;
	/** Where it is planned to go, as the tooltip says it ("potions", "ingots, with coal") */
	planned: string;
	/** The crafting recipe that already eats it (its name), when there is one: the tooltip then names it instead of saying no recipe uses it */
	usedBy?: string;
}

const ing = (name: string, tier: IngredientTier, planned: string, usedBy?: string): IngredientDef => ({
	junkId: `junk_${name}`,
	id: `ing_${name}`,
	tier,
	planned,
	...(usedBy ? { usedBy } : {}),
});

/**
 * The ingredients and what is planned for each (none of it is built yet). Append only.
 *
 * @category Economy/Crafting
 * @order 3
 */
export const INGREDIENTS: readonly IngredientDef[] = [
	ing('blood', 1, 'healing and vitality potions (the base)'),
	ing('clay', 1, 'glass vials and pottery'),
	ing('dried_herbs', 1, 'herb extracts for potions', 'Arcane Essence'),
	ing('orange_mushrooms', 1, 'fungal extracts and night potions'),
	ing('grapes', 1, 'wine and elixirs'),
	ing('hollow_log', 1, 'planks'),
	ing('glowberry', 2, 'night-vision and luck potions', 'Arcane Essence'),
	ing('horn_dark', 2, 'dark elixirs and enchanting powder'),
	ing('copper_ore', 2, 'ingots (smelted with coal)'),
	ing('ember_coal', 3, 'smelting fuel and fire potions'),
	ing('obsidian', 2, 'blade edges for the Obsidian grade'),
	ing('geode', 2, 'cut stones for jewelry'),
	ing('dark_shard', 2, 'enchanting'),
	ing('dark_potion', 2, 'cursed brews'),
	ing('moon', 3, 'jewelry and enchanting'),
	ing('fire_drop', 3, 'fire-ward jewelry'),
	ing('emerald_star', 3, 'jewelry gems'),
	ing('heart_gem', 4, 'the finest jewelry'),
	ing('silver_ore', 2, 'silver ingots and fine jewelry'),
	ing('gold_ore', 3, 'gold ingots and jewelry'),
	ing('crystal', 3, 'enchanting and jewelry gems'),
	ing('claw', 1, 'bone tools, charms and arrow tips'),
	ing('amethyst', 1, 'cut stones for jewelry'),
];

export const INGREDIENT_BY_JUNK = new Map(INGREDIENTS.map((i) => [i.junkId, i]));
export const INGREDIENT_BY_ID = new Map(INGREDIENTS.map((i) => [i.id, i]));

/** The crafting bag key a junk id drops into, or undefined when that drop is plain junk. */
export const stashKeyOfJunk = (junkId: string): string | undefined => INGREDIENT_BY_JUNK.get(junkId)?.id;

/** The families (and, for a monster-specific table, the monsters) that can drop an ingredient: where it comes from, for the tooltip. */
export const sourcesOf = (junkId: string): string[] => {
	const families = Object.entries(FAMILY_DROPS)
		.filter(([, drops]) => drops.some((d) => d.id === junkId))
		.map(([family]) => family);
	const monsters = Object.entries(MONSTER_DROPS).filter(([, drops]) => drops.some((d) => d.id === junkId)).length;
	const rocks = Object.values(ROCK_DROPS).some((table) => table.some((drop) => drop.kind === 'ingredient' && INGREDIENT_BY_JUNK.get(junkId)?.id === drop.id));
	const from = monsters > 0 && families.length === 0 ? ['a few monsters'] : families;
	return rocks ? [...from, 'mining rocks'] : from;
};

const TIER_LABEL: Record<IngredientTier, string> = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3', 4: 'Tier 4' };

/** The words of the tooltip: what it is, that it is an ingredient only, what it is planned for and where it drops. */
export const ingredientDescription = (def: IngredientDef): string => {
	const item = JUNK_ITEMS.find((i) => i.id === def.junkId);
	const from = sourcesOf(def.junkId);
	return `${item?.description ?? ''} Ingredient (${TIER_LABEL[def.tier]}): ${def.usedBy ? `used in ${def.usedBy}` : 'no recipe uses it yet'}, planned for ${def.planned}. Cannot be sold.${from.length ? ` Dropped by: ${from.join(', ')}.` : ''}`.trim();
};

/** The ingredients as crafting components (name and tooltip), merged into `COMPONENTS` so the crafting bag shows them. */
export const INGREDIENT_COMPONENTS: Record<string, { id: string; name: string; description: string }> = Object.fromEntries(
	INGREDIENTS.map((def) => [
		def.id,
		{ id: def.id, name: JUNK_ITEMS.find((i) => i.id === def.junkId)?.name ?? def.id, description: ingredientDescription(def) },
	]),
);
