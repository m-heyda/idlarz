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
	ing('blood', 1, 'healing and vitality potions (the base)', 'Vital Extract'),
	ing('clay', 1, 'glass vials and pottery', 'Elixir of Ironskin'),
	ing('dried_herbs', 1, 'herb extracts for potions', 'Arcane Essence, Herb Extract'),
	ing('orange_mushrooms', 1, 'fungal extracts and night potions', 'Fungal Extract'),
	ing('grapes', 1, 'wine and elixirs', 'Elixir of Fortitude'),
	ing('hollow_log', 1, 'planks'),
	ing('glowberry', 2, 'night-vision and luck potions', 'Arcane Essence, Elixir of Haste, Elixir of the Keen Eye'),
	ing('horn_dark', 2, 'dark elixirs and enchanting powder'),
	ing('copper_ore', 2, 'ingots (smelted with coal)', 'Copper Ingot'),
	ing('ember_coal', 3, 'smelting fuel and fire potions', 'Steel Ingot, Gold Ingot'),
	ing('obsidian', 2, 'blade edges for the Obsidian grade', 'Obsidian Edge'),
	ing('geode', 2, 'cut stones for jewelry', 'Cut Geode Stone'),
	ing('dark_shard', 2, 'enchanting'),
	ing('dark_potion', 2, 'cursed brews'),
	ing('moon', 3, 'jewelry and enchanting', 'Cut Moonstone'),
	ing('fire_drop', 3, 'fire-ward jewelry'),
	ing('emerald_star', 3, 'jewelry gems', 'Cut Emerald'),
	ing('heart_gem', 4, 'the finest jewelry', 'Cut Heart Gem'),
	ing('silver_ore', 2, 'silver ingots and fine jewelry', 'Silver Ingot'),
	ing('gold_ore', 3, 'gold ingots and jewelry', 'Gold Ingot'),
	ing('crystal', 3, 'enchanting and jewelry gems', 'Cut Crystal'),
	ing('claw', 1, 'bone tools, charms and arrow tips', 'Elixir of Might'),
	ing('amethyst', 1, 'cut stones for jewelry', 'Cut Amethyst'),
	// ores and rough gems of the refined chains (tier by look: grey 1, green 2, blue 3, purple and red 4)
	ing('flint', 1, 'gem grit for polishing', 'Gem Grit'),
	ing('iron_ore', 1, 'iron ingots (smelted with coal)', 'Iron Ingot'),
	ing('jasper', 2, 'cut stones for rings, necklaces and charms', 'Cut Jasper'),
	ing('malachite', 2, 'cut stones for necklaces', 'Cut Malachite'),
	ing('turquoise', 2, 'cut stones for rings', 'Cut Turquoise'),
	ing('lapis', 3, 'cut stones for necklaces', 'Cut Lapis'),
	ing('garnet', 3, 'cut stones for rings', 'Cut Garnet'),
	ing('ruby', 4, 'the finest cut stones for rings', 'Cut Ruby'),
	ing('sapphire', 4, 'the finest cut stones for necklaces', 'Cut Sapphire'),
	// the reagents of the enchant craft and the legendary craft (IDL-120): made at the workbench from the extracts of the Blight and Battlefield Extractors
	ing('ichor', 3, 'the enchant craft: reroll or add one affix of a piece of gear', 'Distilled Ichor'),
	ing('war_medals', 4, 'the legendary recipes', 'Dawnsplitter, Forged War Medal, Starlight Wand, Stormstring'),
	// no source yet (IDL-355: what drops it is still to be decided): the time-shift potion cannot be finished until it does
	ing('hourglass_sand', 4, 'the time-shift potion', 'Elixir of Time Shift'),
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
