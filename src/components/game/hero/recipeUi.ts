import { ITEMS, ITEM_CATALOG } from '@/catalog';
import { gradeOfItem } from '@/catalog/items/grades';
import { COMPONENTS, type Recipe } from '@/catalog/recipes';
import { RESOURCE_PIXEL_ICONS, pixelIconSrc, type PixelIconName } from '@/config/pixelIcons';
import { itemIconName } from '../itemUi';

/** What a recipe is called: its item, its component, or the recipe's own name. */
export const outputName = (recipe: Recipe): string =>
	'item' in recipe.output ? ITEM_CATALOG[recipe.output.item].name : 'component' in recipe.output ? COMPONENTS[recipe.output.component].name : recipe.name;

/** Components have no catalog item, so their sprite is named here. */
export const COMPONENT_ICONS: Record<string, PixelIconName> = { glass_vial: 'comp_glass_vial' };

/** A gear recipe is drawn with the first base of its grade and slot (the result is random, the sprite is the grade's look). */
const gearIcon = (grade: string, slot: string): PixelIconName => {
	const base = ITEMS.find((def) => def.enabled !== false && !def.tags?.includes('named') && gradeOfItem(def) === grade && def.slot === slot);
	return base ? itemIconName(base) : 'food';
};

export const recipeIcon = (recipe: Recipe): PixelIconName =>
	'item' in recipe.output
		? itemIconName(ITEM_CATALOG[recipe.output.item])
		: 'component' in recipe.output
			? (COMPONENT_ICONS[recipe.output.component] ?? 'comp_glass_vial')
			: gearIcon(recipe.output.gear.grade, recipe.output.gear.slot);

/** The picture file of a recipe's result. */
export const recipeIconUrl = (recipe: Recipe): string => pixelIconSrc(recipeIcon(recipe));

/** The picture file of a resource, for a cost line (a resource with no sprite shows the scroll). */
export const resourceIconUrl = (key: string): string => pixelIconSrc((RESOURCE_PIXEL_ICONS[key] ?? 'menu_bag_scroll') as PixelIconName);

/** The picture file of a crafting component. */
export const componentIconUrl = (id: string): string => pixelIconSrc(COMPONENT_ICONS[id] ?? 'comp_glass_vial');
