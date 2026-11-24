import { ITEM_CATALOG, RESOURCES } from '@/catalog';
import { GRADE_INFO } from '@/catalog/items/grades';
import { COMPONENTS, CRAFT_SLOT_LABEL, CRAFT_TYPES, CRAFT_TYPE_LABEL, type CraftSlot, type CraftType, type Recipe, type RecipeKind } from '@/catalog/recipes';
import type { ComponentGroup } from '@/catalog/refined';

/**
 * The Crafting tab's navigation as data. A category is a folding group of the recipe list; it may have subcategories (Armor by slot, Jewelry by kind), each shown under its own small heading.
 * A recipe belongs to the first category (or subcategory) whose `has` accepts it. To add a kind of equipment later, add a row to a `children` list (or a new category) here: nothing in the window changes.
 * Weapons and off hands are split by item type (swords, bows, shields ...; `CRAFT_TYPES`), each section listing its tiers lowest level first; components by what they are (metals, cut gems, tools, extracts, materials); potions into healing and elixirs.
 * Trade goods are not shown for now (their recipes stay in the data), and neither are `legacy` recipes (old ids kept for queued batches).
 */
export interface CraftCategory {
	id: string;
	label: string;
	/** Whether a recipe belongs here (for a category with `children`: the union of its children is used instead) */
	has?: (recipe: Recipe) => boolean;
	children?: readonly CraftCategory[];
}

/** The gear slot a recipe makes, or null when it does not make gear */
export const craftSlotOf = (recipe: Recipe): CraftSlot | null => ('gear' in recipe.output ? recipe.output.gear.slot : null);

const slotIs =
	(...slots: readonly CraftSlot[]) =>
	(recipe: Recipe): boolean => {
		const slot = craftSlotOf(recipe);
		return slot !== null && slots.includes(slot);
	};

const typeIs =
	(slot: CraftSlot, type: CraftType) =>
	(recipe: Recipe): boolean =>
		'gear' in recipe.output && recipe.output.gear.slot === slot && recipe.output.gear.type === type;

const groupIs =
	(...groups: readonly ComponentGroup[]) =>
	(recipe: Recipe): boolean => {
		if (recipe.kind !== 'component' || !('component' in recipe.output)) return false;
		const group = COMPONENTS[recipe.output.component]?.group;
		return !!group && groups.includes(group);
	};

/** What a potion does: an elixir carries a timed buff, the others heal or restore mana */
const isElixir = (recipe: Recipe): boolean => {
	const effects = 'item' in recipe.output ? (ITEM_CATALOG[recipe.output.item]?.effects ?? []) : [];
	return effects.some((effect) => effect.kind === 'buff');
};

const kindIs =
	(kind: RecipeKind) =>
	(recipe: Recipe): boolean =>
		recipe.kind === kind;

/** The categories of the recipe list, in display order */
export const CRAFT_CATEGORIES: readonly CraftCategory[] = [
	{
		id: 'components',
		label: 'Components',
		children: [
			{ id: 'metals', label: 'Metals', has: groupIs('metal') },
			{ id: 'fasteners', label: 'Nails and rivets', has: groupIs('fastener') },
			{ id: 'gems', label: 'Cut gems', has: groupIs('gem') },
			{ id: 'tools', label: 'Polishing tools', has: groupIs('tool') },
			{ id: 'extracts', label: 'Extracts', has: groupIs('extract') },
			{
				id: 'materials',
				label: 'Materials',
				has: (recipe) => groupIs('material', 'part')(recipe) || ('component' in recipe.output && recipe.output.component.startsWith('ing_')),
			}, // an ingredient made at the workbench (Ichor, War Medals) sits here too
		],
	},
	{
		id: 'weapons',
		label: 'Weapons',
		children: CRAFT_TYPES.mainHand.map((type) => ({ id: type, label: CRAFT_TYPE_LABEL[type].many, has: typeIs('mainHand', type) })),
	},
	{
		id: 'offhands',
		label: 'Off hands',
		children: CRAFT_TYPES.offHand.map((type) => ({ id: type, label: CRAFT_TYPE_LABEL[type].many, has: typeIs('offHand', type) })),
	},
	{
		id: 'armor',
		label: 'Armor',
		children: [
			{ id: 'helmets', label: 'Helmets', has: slotIs('head') },
			{ id: 'shoulders', label: 'Shoulder pads', has: slotIs('shoulder') },
			{ id: 'chest', label: 'Chest armor', has: slotIs('chest') },
			{ id: 'gloves', label: 'Gloves', has: slotIs('hands') },
			{ id: 'legs', label: 'Leg armor', has: slotIs('legs') },
			{ id: 'boots', label: 'Boots', has: slotIs('feet') },
			{ id: 'cloaks', label: 'Cloaks', has: slotIs('cape') },
			{ id: 'belts', label: 'Belts', has: slotIs('belt') },
		],
	},
	{
		id: 'potions',
		label: 'Potions',
		children: [
			{ id: 'healing', label: 'Healing and mana', has: (recipe) => recipe.kind === 'potion' && !isElixir(recipe) },
			{ id: 'elixirs', label: 'Elixirs (timed buffs)', has: (recipe) => recipe.kind === 'potion' && isElixir(recipe) },
		],
	},
	{
		id: 'jewelry',
		label: 'Jewelry',
		children: [
			{ id: 'rings', label: 'Rings', has: slotIs('ring') },
			{ id: 'necklaces', label: 'Necklaces', has: slotIs('neck') },
			{ id: 'charms', label: 'Charms', has: slotIs('charm') },
		],
	},
	{ id: 'legendary', label: 'Legendary', has: kindIs('legendary') },
];

/** A subcategory (or a category with none) and the recipes in it, lowest crafting level first */
export interface CraftSection {
	id: string;
	label: string;
	recipes: Recipe[];
}

/** A category with its recipes, either as one flat list (`recipes`) or as `sections` (one per non-empty subcategory) */
export interface CraftGroup {
	id: string;
	label: string;
	/** All the recipes of the group, for the count */
	count: number;
	sections: CraftSection[];
	/** True when the sections are subcategories that get their own heading */
	headed: boolean;
}

/** Lowest crafting level first; recipes of the same level keep the catalog's order */
const byLevel = (recipes: readonly Recipe[]): Recipe[] =>
	recipes
		.map((recipe, index) => ({ recipe, index }))
		.sort((a, b) => a.recipe.unlock - b.recipe.unlock || a.index - b.index)
		.map((e) => e.recipe);

/** What a recipe is called: its item, its component, or the recipe's own name */
const nameOf = (recipe: Recipe): string =>
	'item' in recipe.output
		? (ITEM_CATALOG[recipe.output.item]?.name ?? recipe.name)
		: 'component' in recipe.output
			? (COMPONENTS[recipe.output.component]?.name ?? recipe.name)
			: recipe.name;

/** Everything a player can read about a recipe, in one lower-case line: its name, kind, slot, grade, description, inputs and the category it sits in. This is what the search looks through. */
export const recipeSearchText = (recipe: Recipe): string => {
	const parts: string[] = [nameOf(recipe), recipe.name, recipe.kind];
	const out = recipe.output;
	if ('item' in out) {
		const def = ITEM_CATALOG[out.item];
		if (def) parts.push(def.description ?? '', def.kind, def.rarity);
	} else if ('component' in out) {
		parts.push(COMPONENTS[out.component]?.description ?? '');
	} else {
		parts.push(CRAFT_SLOT_LABEL[out.gear.slot], GRADE_INFO[out.gear.grade]?.label ?? '', out.gear.grade);
		if (out.gear.type) parts.push(CRAFT_TYPE_LABEL[out.gear.type].one, CRAFT_TYPE_LABEL[out.gear.type].many);
	}
	for (const input of recipe.inputs)
		parts.push('resource' in input ? (RESOURCES[input.resource]?.label ?? input.resource) : (COMPONENTS[input.component]?.name ?? input.component));
	for (const category of CRAFT_CATEGORIES) {
		for (const section of category.children ?? [category]) if (section.has?.(recipe)) parts.push(category.label, section.label);
	}
	return parts.join(' ').toLowerCase();
};

/** Whether a recipe matches a search phrase: every word of it (any order, any case) must appear somewhere in the recipe's text. An empty phrase matches everything. */
export const recipeMatches = (recipe: Recipe, query: string): boolean => {
	const words = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (words.length === 0) return true;
	const text = recipeSearchText(recipe);
	return words.every((word) => text.includes(word));
};

/**
 * The recipe list as groups: every non-empty category, its recipes split into its subcategories. With a search phrase only the recipes that match stay (and a group with none is left out), so the result is
 * the same shape either way and the window just draws it.
 */
export const craftGroups = (recipes: readonly Recipe[], query = ''): CraftGroup[] => {
	const shown = recipes.filter((recipe) => !recipe.legacy && recipeMatches(recipe, query));
	const groups: CraftGroup[] = [];
	for (const category of CRAFT_CATEGORIES) {
		const sections: CraftSection[] = (category.children ?? [category])
			.map((section) => ({ id: section.id, label: section.label, recipes: byLevel(shown.filter((recipe) => section.has?.(recipe) ?? false)) }))
			.filter((section) => section.recipes.length > 0);
		if (sections.length === 0) continue;
		groups.push({
			id: category.id,
			label: category.label,
			count: sections.reduce((sum, section) => sum + section.recipes.length, 0),
			sections,
			headed: !!category.children,
		});
	}
	return groups;
};
