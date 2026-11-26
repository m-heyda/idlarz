import { ITEMS, ITEM_CATALOG } from '@/catalog';
import { gradeOfItem } from '@/catalog/items/grades';
import { INGREDIENT_BY_ID } from '@/catalog/ingredients';
import { COMPONENTS, type Recipe } from '@/catalog/recipes';
import { RESOURCE_PIXEL_ICONS, pixelIconSrc, type PixelIconName } from '@/config/pixelIcons';
import { itemIconName } from '../itemUi';

/** What a recipe is called: its item, its component, or the recipe's own name. */
export const outputName = (recipe: Recipe): string =>
	'item' in recipe.output ? ITEM_CATALOG[recipe.output.item].name : 'component' in recipe.output ? COMPONENTS[recipe.output.component].name : recipe.name;

/** Components have no catalog item, so their sprite is named here. */
export const COMPONENT_ICONS: Record<string, PixelIconName> = {
	glass_vial: 'comp_glass_vial',
	cured_leather: 'comp_cured_leather',
	plank_bundle: 'comp_plank_bundle',
	plank_crate: 'comp_plank_bundle',
	plank_pallet: 'comp_plank_bundle',
	leather_stack: 'comp_cured_leather',
	leather_bale: 'comp_cured_leather',
	dark_powder: 'comp_gem_grit',
	arcane_essence: 'comp_arcane_essence',
	copper_ingot: 'comp_copper_ingot',
	copper_nails: 'comp_copper_nails',
	iron_nails: 'comp_iron_nails',
	steel_rivets: 'comp_steel_rivets',
	silver_rivets: 'comp_silver_rivets',
	gold_studs: 'comp_gold_studs',
	iron_ingot: 'comp_iron_ingot',
	steel_ingot: 'comp_steel_ingot',
	silver_ingot: 'comp_silver_ingot',
	gold_ingot: 'comp_gold_ingot',
	obsidian_edge: 'comp_obsidian_edge',
	gem_grit: 'comp_gem_grit',
	polish_cloth: 'comp_polish_cloth',
	stone_block: 'comp_stone_block',
	cloth_bolt: 'comp_cloth_bolt',
	herb_extract: 'comp_herb_extract',
	fungal_extract: 'comp_fungal_extract',
	vital_extract: 'comp_vital_extract',
	cut_amethyst: 'comp_cut_amethyst',
	cut_geode: 'comp_cut_geode',
	cut_crystal: 'comp_cut_crystal',
	cut_emerald: 'comp_cut_emerald',
	cut_moon: 'comp_cut_moon',
	cut_heart: 'comp_cut_heart',
	cut_jasper: 'comp_cut_jasper',
	cut_malachite: 'comp_cut_malachite',
	cut_turquoise: 'comp_cut_turquoise',
	cut_lapis: 'comp_cut_lapis',
	cut_garnet: 'comp_cut_garnet',
	cut_ruby: 'comp_cut_ruby',
	cut_sapphire: 'comp_cut_sapphire',
};

/** A gear recipe is drawn with the first base of its grade, slot and type (the result is random inside the type, the sprite is the grade's look). */
const gearIcon = (grade: string, slot: string, type?: string): PixelIconName => {
	const base = ITEMS.find(
		(def) => def.enabled !== false && !def.tags?.includes('named') && gradeOfItem(def) === grade && def.slot === slot && (!type || def.weaponType === type),
	);
	return base ? itemIconName(base) : 'food';
};

export const recipeIcon = (recipe: Recipe): PixelIconName =>
	'item' in recipe.output
		? itemIconName(ITEM_CATALOG[recipe.output.item])
		: 'component' in recipe.output
			? (COMPONENT_ICONS[recipe.output.component] ?? 'comp_glass_vial')
			: gearIcon(recipe.output.gear.grade, recipe.output.gear.slot, recipe.output.gear.type);

/** The picture file of a recipe's result. */
export const recipeIconUrl = (recipe: Recipe): string => pixelIconSrc(recipeIcon(recipe));

/** The picture file of a resource, for a cost line (a resource with no sprite shows the scroll). */
export const resourceIconUrl = (key: string): string => pixelIconSrc((RESOURCE_PIXEL_ICONS[key] ?? 'menu_bag_scroll') as PixelIconName);

/** The picture file of a crafting component. */
export const componentIconUrl = (id: string): string =>
	// an ingredient wears the picture of the junk it came from (`ing_blood` -> `art_junk_blood`)
	pixelIconSrc(COMPONENT_ICONS[id] ?? (INGREDIENT_BY_ID.has(id) ? (`art_${INGREDIENT_BY_ID.get(id)!.junkId}` as PixelIconName) : 'comp_glass_vial'));
