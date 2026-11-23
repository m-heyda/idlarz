/**
 * Crafting recipes (docs/plan/crafting-v0.md). Data only: a recipe lists what it eats, what it makes, the crafting level that unlocks it and
 * the crafting XP one craft gives. Four kinds: `potion`, `component`, `good` (v0.1) and `gear` (v0.2, IDL-241).
 *   potion     usable items (a bag stack of a consumable)
 *   component  half-products that sit in a ledger counter (craft.stock), never in the bag
 *   good       trade goods: a bag stack with no use, sold to the merchant like any item (v0.1, IDL-227)
 *   gear       equipment: one recipe per grade (G1-G4) and slot, rolled by the server through the loot pipeline's `craft` source when a batch is claimed (docs/plan/17-crafting.md)
 */
import { CRAFT_COST_HEADROOM, CRAFT_GEAR } from '@/config/crafting';
import { GRADE_INFO, type Grade } from '@/catalog/items/grades';
import type { ItemDef } from '@/types/game';
import { INGREDIENT_COMPONENTS } from './ingredients';
import { REFINED_COMPONENTS, REFINED_RECIPES, type ComponentGroup } from './refined';
import { RESOURCES, type MerchantResourceKey } from './resources';

export type RecipeKind = 'potion' | 'component' | 'good' | 'gear' | 'legendary';

export interface ComponentDef {
	id: string;
	name: string;
	description: string;
	/** What kind of half-product it is (ingots, cut gems, tools, extracts ...): the groups of the Components list. Ingredients that drop from monsters and rocks have none. */
	group?: ComponentGroup;
}

const BASE_COMPONENTS: Record<string, ComponentDef> = {
	glass_vial: { id: 'glass_vial', name: 'Glass Vial', group: 'part', description: 'A small flask of fire-blown glass. Every potion needs one.' },
	cured_leather: {
		id: 'cured_leather',
		name: 'Cured Leather',
		group: 'material',
		description: 'Hide cured over coal until it is supple. The base of every leather good.',
	},
	plank_bundle: {
		id: 'plank_bundle',
		name: 'Plank Bundle',
		group: 'material',
		description: 'Sawn, stone-planed boards tied in a bundle. Gear recipes will use them.',
	},
	arcane_essence: {
		id: 'arcane_essence',
		name: 'Arcane Essence',
		group: 'extract',
		description: 'Glowberry and herbs steeped in a glass vial until it glows pink. The base of the magic potions to come; no recipe uses it yet.',
	},
};

/** Every crafting bag stack that is not a potion or a trade good: the half-products recipes make, and the monster ingredients that drop into the bag (`catalog/ingredients.ts`, no recipe uses them yet). */
export const COMPONENTS: Record<string, ComponentDef> = {
	...BASE_COMPONENTS,
	...Object.fromEntries(REFINED_COMPONENTS.map((c) => [c.id, c])),
	...INGREDIENT_COMPONENTS,
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
		stackMax: 100,
		icon: 'food',
		sellValue: 46,
		description: 'Salted meat and dried grain in a waxed cloth. Travellers pay for it.',
	},
	{
		id: 'honey_cake',
		name: 'Honey Cake',
		kind: 'consumable',
		rarity: 'common',
		tier: 0,
		stackMax: 100,
		icon: 'food',
		sellValue: 46,
		description: 'A dense cake of eggs, milk and honey. Keeps for weeks.',
	},
	{
		id: 'leather_satchel',
		name: 'Leather Satchel',
		kind: 'consumable',
		rarity: 'common',
		tier: 0,
		stackMax: 100,
		icon: 'food',
		sellValue: 52,
		description: 'A stitched shoulder bag. Sold, not worn.',
	},
	{
		id: 'carved_trinket',
		name: 'Carved Trinket',
		kind: 'consumable',
		rarity: 'common',
		tier: 0,
		stackMax: 100,
		icon: 'food',
		sellValue: 62,
		description: 'A small wooden charm with a stone eye. Sold, not worn.',
	},
];

export type RecipeInput = { resource: MerchantResourceKey; qty: number } | { component: string; qty: number };
/** What a gear recipe makes: any base of this slot, type and grade, picked by the loot pipeline (the player picks the type and the grade, not the item). `type` is set for weapons and off hands only (`CRAFT_TYPES`). */
export interface GearTarget {
	grade: Grade;
	slot: CraftSlot;
	type?: CraftType;
}
export type RecipeOutput = { item: string; qty: number } | { component: string; qty: number } | { gear: GearTarget; qty: number };

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
	/** An old recipe that stays in the data for good (ids are append-only: a batch queued under it still finishes) but is not listed in the Crafting tab */
	legacy?: true;
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
		id: 'arcane_essence',
		kind: 'component',
		name: 'Arcane Essence',
		inputs: [
			{ component: 'glass_vial', qty: 1 },
			{ component: 'ing_glowberry', qty: 3 },
			{ component: 'ing_dried_herbs', qty: 2 },
		],
		output: { component: 'arcane_essence', qty: 1 },
		unlock: 3,
		xp: 4,
		timeSec: 20,
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
RECIPES.push(...REFINED_RECIPES);

/** The slots a gear recipe can make (a ring recipe makes either ring: the item slot is 'ring'), in display order */
export const CRAFT_SLOTS = ['mainHand', 'offHand', 'head', 'shoulder', 'chest', 'hands', 'legs', 'feet', 'neck', 'ring', 'charm', 'cape', 'belt'] as const;
export type CraftSlot = (typeof CRAFT_SLOTS)[number];

export const CRAFT_SLOT_LABEL: Record<CraftSlot, string> = {
	mainHand: 'Weapon',
	offHand: 'Off hand',
	head: 'Helm',
	shoulder: 'Shoulders',
	chest: 'Chest',
	hands: 'Gloves',
	legs: 'Legs',
	feet: 'Boots',
	neck: 'Amulet',
	ring: 'Ring',
	charm: 'Charm',
	cape: 'Cloak',
	belt: 'Belt',
};

/**
 * The item types of the two slots that have more than one (crafting rework, owner 2026-11-19): a weapon recipe makes a sword, a bow or a wand, and only a piece of that type rolls, so a club never shows a wand's spell power. Every other slot
 * has one type (a helm is a helm), so its recipes carry no type. Order is the order of the list.
 */
export const CRAFT_TYPES = {
	mainHand: ['sword', 'dagger', 'axe', 'mace', 'maul', 'spear', 'bow', 'crossbow', 'staff', 'wand'],
	offHand: ['shield', 'tome'],
} as const;
export type CraftType = (typeof CRAFT_TYPES)[keyof typeof CRAFT_TYPES][number];

/** What a type is called (one piece, and the heading of its recipes) */
export const CRAFT_TYPE_LABEL: Record<CraftType, { one: string; many: string }> = {
	sword: { one: 'Sword', many: 'Swords' },
	dagger: { one: 'Dagger', many: 'Daggers' },
	axe: { one: 'Axe', many: 'Axes' },
	mace: { one: 'Mace', many: 'Maces' },
	maul: { one: 'Maul', many: 'Mauls' },
	spear: { one: 'Spear', many: 'Spears' },
	bow: { one: 'Bow', many: 'Bows' },
	crossbow: { one: 'Crossbow', many: 'Crossbows' },
	staff: { one: 'Staff', many: 'Staves' },
	wand: { one: 'Wand', many: 'Wands' },
	shield: { one: 'Shield', many: 'Shields' },
	tome: { one: 'Tome', many: 'Tomes' },
};

/** The grades with a gear recipe, lowest first, and the crafting level each unlocks at (owner 2026-11-07: G1 1, G2 8, G3 15, G4 25, G5 35, G6 50; G7 65 and G8 80 when those grades go live) */
export const GEAR_UNLOCK = { G1: 1, G2: 8, G3: 15, G4: 25, G5: 35, G6: 50, G7: 65, G8: 80 } as const satisfies Partial<Record<Grade, number>>;
export type CraftGrade = keyof typeof GEAR_UNLOCK;
export const CRAFT_GRADES = Object.keys(GEAR_UNLOCK) as CraftGrade[];

/**
 * What a gear recipe takes. A grade has a **value** (the gold worth, at merchant prices, of a recipe of weight 1) and a number of **parts** (Plank Bundles or Cured Leather; none at G1, where no component is unlocked yet);
 * a slot's weight scales both. The rest of the value is merchant resources by the slot's family: weapons and shields wood and stone (and Plank Bundles), armour hide, coal and food (and Cured Leather), trinkets stone, coal and wood
 * (and a Plank Bundle). On top of that come the **refined components** of the grade (`GEAR_REFINED`): ingots for weapons and armor (copper, iron, steel, silver, gold, the Obsidian Edge), Cloth Bolts for cloaks, cut gems and a precious
 * ingot for jewelry. They only add to the cost. The value is **1.25 x the mean sell value of what the grade makes at the top of its item level window** (measured by `npm run craft-sim`, gated there and in tests/crafting/gearRecipes.test.ts),
 * so a craft always costs more than the piece sells for, whatever the crafting level, Luck or Intelligence: crafting is a resource sink and never a gold printer. The XP is sized so a grade takes about 35 pieces to climb to the next grade's unlock.
 */
type Family = 'weapon' | 'armour' | 'trinket';
const FAMILY: Record<CraftSlot, Family> = {
	mainHand: 'weapon',
	offHand: 'weapon',
	head: 'armour',
	shoulder: 'armour',
	chest: 'armour',
	hands: 'armour',
	legs: 'armour',
	feet: 'armour',
	cape: 'armour',
	belt: 'armour',
	neck: 'trinket',
	ring: 'trinket',
	charm: 'trinket',
};
/** The relative size of a slot's cost (a chest or a weapon is the big piece), never below 1: the cheapest slot must still cost more than it sells for */
const SLOT_WEIGHT: Record<CraftSlot, number> = {
	mainHand: 1.3,
	offHand: 1.15,
	head: 1.05,
	shoulder: 1.05,
	chest: 1.3,
	hands: 1,
	legs: 1.15,
	feet: 1,
	neck: 1,
	ring: 1,
	charm: 1,
	cape: 1,
	belt: 1,
};
/** The two-handed and ranged pieces cost a little more than a one-handed sword: a type's weight multiplies its slot's */
const TYPE_WEIGHT: Partial<Record<CraftType, number>> = { maul: 1.15, crossbow: 1.1, staff: 1.05 };
/** Per grade: the gold value of a weight-1 recipe, the components in it, and the crafting XP of a weight-1 craft */
const GEAR_GRADE_COST: Record<CraftGrade, { value: number; parts: number; xp: number }> = {
	G1: { value: 2_400, parts: 0, xp: 60 },
	G2: { value: 21_500, parts: 3, xp: 800 },
	G3: { value: 222_000, parts: 6, xp: 2_500 },
	G4: { value: 1_700_000, parts: 12, xp: 6_000 },
	G5: { value: 14_500_000, parts: 24, xp: 14_000 },
	G6: { value: 85_000_000, parts: 40, xp: 32_000 },
	G7: { value: 850_000_000, parts: 64, xp: 70_000 },
	G8: { value: 1_200_000_000, parts: 96, xp: 150_000 },
};
/** How the resource part of the value splits over the resources of a family (shares add up to 1) */
const FAMILY_SPLIT: Record<Family, Partial<Record<MerchantResourceKey, number>>> = {
	weapon: { wood: 0.55, stone: 0.45 },
	armour: { hide: 0.45, coal: 0.3, food: 0.25 },
	trinket: { stone: 0.4, coal: 0.3, wood: 0.3 },
};
const FAMILY_PART: Record<Family, string> = { weapon: 'plank_bundle', armour: 'cured_leather', trinket: 'plank_bundle' };

const refined = (component: string, qty: number): RecipeInput => ({ component, qty });

/**
 * The refined components a gear recipe adds to its cost, by grade (crafting rework 2026-11-19). Weapons and armor climb copper, iron, steel, silver and the Obsidian Edge; cloaks take Cloth Bolts; every jewelry slot takes the cut gem of its own
 * stone and a precious ingot. Every component is unlocked at or below the crafting level of the grade that asks for it (tests/crafting/gearRecipes.test.ts), so a recipe never waits on a later level.
 */
const GEAR_REFINED = {
	weapon: {
		G2: [refined('copper_ingot', 1)],
		G3: [refined('iron_ingot', 2)],
		G4: [refined('steel_ingot', 2)],
		G5: [refined('steel_ingot', 3), refined('silver_ingot', 1)],
		G6: [refined('steel_ingot', 2), refined('obsidian_edge', 3)],
		G7: [refined('obsidian_edge', 4), refined('gold_ingot', 1)],
		G8: [refined('obsidian_edge', 6), refined('gold_ingot', 2), refined('silver_ingot', 4)],
	},
	armour: {
		G2: [refined('copper_nails', 12)],
		G3: [refined('iron_ingot', 2), refined('iron_nails', 16)],
		G4: [refined('steel_ingot', 2), refined('steel_rivets', 20)],
		G5: [refined('steel_ingot', 3), refined('silver_rivets', 24)],
		G6: [refined('obsidian_edge', 2), refined('gold_ingot', 1), refined('gold_studs', 30)],
		G7: [refined('obsidian_edge', 3), refined('gold_ingot', 2), refined('gold_studs', 36)],
		G8: [refined('obsidian_edge', 4), refined('gold_ingot', 3), refined('gold_studs', 48)],
	},
	cloak: {
		G2: [refined('cloth_bolt', 2)],
		G3: [refined('cloth_bolt', 3)],
		G4: [refined('cloth_bolt', 4), refined('silver_ingot', 1)],
		G5: [refined('cloth_bolt', 6), refined('silver_ingot', 2)],
		G6: [refined('cloth_bolt', 8), refined('gold_ingot', 2)],
		G7: [refined('cloth_bolt', 10), refined('gold_ingot', 3)],
		G8: [refined('cloth_bolt', 12), refined('gold_ingot', 4)],
	},
	/** The metal of a trinket, by grade (the gem is in `TRINKET_GEM`) */
	trinket: {
		G3: [refined('silver_ingot', 1)],
		G4: [refined('silver_ingot', 2)],
		G5: [refined('gold_ingot', 1)],
		G6: [refined('gold_ingot', 2)],
		G7: [refined('gold_ingot', 3)],
		G8: [refined('gold_ingot', 4)],
	},
} as const satisfies Record<string, Partial<Record<CraftGrade, readonly RecipeInput[]>>>;
/** The cut gem of each jewelry slot by grade: rings take reds and teals, amulets blues and greens, charms the odd stones; the G5 and G6 pieces take two */
const TRINKET_GEM: Record<'ring' | 'neck' | 'charm', Record<Exclude<CraftGrade, 'G1'>, string>> = {
	ring: { G2: 'cut_jasper', G3: 'cut_turquoise', G4: 'cut_garnet', G5: 'cut_crystal', G6: 'cut_ruby', G7: 'cut_ruby', G8: 'cut_heart' },
	neck: { G2: 'cut_jasper', G3: 'cut_malachite', G4: 'cut_lapis', G5: 'cut_emerald', G6: 'cut_sapphire', G7: 'cut_sapphire', G8: 'cut_heart' },
	charm: { G2: 'cut_jasper', G3: 'cut_geode', G4: 'cut_amethyst', G5: 'cut_moon', G6: 'cut_heart', G7: 'cut_heart', G8: 'cut_heart' },
};

/** Two significant digits, so a cost reads as a round number */
const nice = (n: number): number => {
	const scale = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1));
	return Math.max(1, Math.round(n / scale) * scale);
};

/** The gold value of the resources a component's own recipe takes (a component is made once and counted at what it cost) */
const componentValue = (id: string): number => {
	const maker = RECIPES.find((r) => 'component' in r.output && r.output.component === id);
	return (maker?.inputs ?? []).reduce((sum, i) => ('resource' in i ? sum + i.qty * RESOURCES[i.resource].merchant.price : sum), 0);
};

/** The refined components a gear recipe of this grade and slot adds (see {@link GEAR_REFINED}) */
export const gearRefined = (grade: CraftGrade, slot: CraftSlot): RecipeInput[] => {
	if (slot === 'cape') return [...((GEAR_REFINED.cloak as Partial<Record<CraftGrade, readonly RecipeInput[]>>)[grade] ?? [])];
	const family = FAMILY[slot];
	const metals = (GEAR_REFINED[family] as Partial<Record<CraftGrade, readonly RecipeInput[]>>)[grade] ?? [];
	if (family !== 'trinket' || grade === 'G1') return [...metals];
	const gem = TRINKET_GEM[slot as 'ring' | 'neck' | 'charm'][grade as Exclude<CraftGrade, 'G1'>];
	return [...metals, refined(gem, grade === 'G7' || grade === 'G8' ? 3 : grade === 'G5' || grade === 'G6' ? 2 : 1)];
};

const gearInputs = (grade: CraftGrade, slot: CraftSlot, type?: CraftType): RecipeInput[] => {
	const { value, parts } = GEAR_GRADE_COST[grade];
	const weight = SLOT_WEIGHT[slot] * (type ? (TYPE_WEIGHT[type] ?? 1) : 1);
	const family = FAMILY[slot];
	const count = parts > 0 ? Math.max(1, Math.round(parts * weight)) : 0;
	// the headroom keeps a craft above the sell value even with every crafting discount (CRAFT_COST_HEADROOM)
	const raw = Math.max(0, value * weight * CRAFT_COST_HEADROOM - count * componentValue(FAMILY_PART[family]));
	const inputs: RecipeInput[] = (Object.entries(FAMILY_SPLIT[family]) as [MerchantResourceKey, number][]).map(([resource, share]) => ({
		resource,
		qty: nice((raw * share) / RESOURCES[resource].merchant.price),
	}));
	if (count > 0) inputs.push({ component: FAMILY_PART[family], qty: count });
	return [...inputs, ...gearRefined(grade, slot)];
};

const gearRecipe = (grade: CraftGrade, slot: CraftSlot, type?: CraftType): Recipe => {
	const weight = SLOT_WEIGHT[slot] * (type ? (TYPE_WEIGHT[type] ?? 1) : 1);
	return {
		id: `gear_${grade.toLowerCase()}_${slot.toLowerCase()}${type ? `_${type}` : ''}`,
		kind: 'gear',
		name: `${GRADE_INFO[grade].label} ${type ? CRAFT_TYPE_LABEL[type].one : CRAFT_SLOT_LABEL[slot]}`,
		inputs: gearInputs(grade, slot, type),
		output: { gear: { grade, slot, ...(type ? { type } : {}) }, qty: 1 },
		unlock: GEAR_UNLOCK[grade],
		xp: Math.max(1, Math.round(GEAR_GRADE_COST[grade].xp * weight)),
		timeSec: CRAFT_GEAR.timeSec[grade],
	};
};

/** The slots whose recipes are split by item type */
export const TYPED_SLOTS = Object.keys(CRAFT_TYPES) as (keyof typeof CRAFT_TYPES)[];

/**
 * The gear recipes: for every grade G1-G6 one recipe per item type of a weapon or off-hand slot (10 weapon types and shield and tome) and one per grade for each other slot (11 slots), so six tiers of every kind of item: 6 x (12 + 11) = 138 recipes.
 * The player picks the type and the tier; the server rolls the base (of that type), rarity and affixes at claim time through the `craft` loot source (rarity by Luck and the pity counter, quality by Intelligence, item level by the crafting level inside the
 * grade's window; see {@link CRAFT_GEAR}). Every gear recipe is timed (`CRAFT_GEAR.timeSec`) and runs in the batch queue. Adding a grade is one entry in `GEAR_UNLOCK`, `GEAR_GRADE_COST` and `CRAFT_GEAR.timeSec` (and its row in `GEAR_REFINED`);
 * adding a type is one entry in `CRAFT_TYPES` and `CRAFT_TYPE_LABEL`.
 *
 * @category Economy/Crafting
 * @order 2
 */
export const GEAR_RECIPES: Recipe[] = CRAFT_GRADES.flatMap((grade) =>
	CRAFT_SLOTS.flatMap((slot): Recipe[] =>
		slot === 'mainHand' || slot === 'offHand' ? CRAFT_TYPES[slot].map((type) => gearRecipe(grade, slot, type)) : [gearRecipe(grade, slot)],
	),
);

/**
 * The first gear recipes (IDL-241) were one per grade G1-G4 and weapon slot, rolling any base of the slot. Their ids stay valid (a batch queued under one still finishes and claims, ids are append-only) but the Crafting tab does not list them
 * any more: `legacy` hides them, and the typed recipes above replace them.
 */
export const LEGACY_GEAR_RECIPES: Recipe[] = (['G1', 'G2', 'G3', 'G4'] as const).flatMap((grade) =>
	(['mainHand', 'offHand'] as const).map(
		(slot): Recipe => ({
			...gearRecipe(grade, slot),
			legacy: true,
			inputs: gearInputs(grade, slot).filter((i) => 'resource' in i || i.component === FAMILY_PART.weapon),
		}),
	),
);
RECIPES.push(...GEAR_RECIPES, ...LEGACY_GEAR_RECIPES);

/** A crafting level no player reaches (`CRAFTING.maxLevel` is 80): the legendary recipes below are shown but cannot be crafted yet. */
export const LEGENDARY_UNLOCK = 99;

/**
 * TODO (owner, 2026-11-19): the legendaries get special abilities later; for now each is only a strong weapon (Dawnsplitter's numbers are in `SIGNATURE_STATS`, `catalog/items/ladder.ts`).
 *
 * The legendary recipes: Dawnsplitter (axe), Stormstring (bow) and the Starlight Wand (mage), the strongest weapons in the catalog (grade G9, disabled data). They are **display only**: they are not in `RECIPES`, so the server cannot start them
 * (and the level they ask for is above the crafting cap), but the Crafting tab lists them under "Legendary" so the chase is visible. Opening them up later is moving them into `RECIPES` and lowering `LEGENDARY_UNLOCK`.
 */
export const LEGENDARY_RECIPES: Recipe[] = [
	{
		id: 'legendary_dawnsplitter',
		kind: 'legendary',
		name: 'Dawnsplitter',
		inputs: [
			{ resource: 'wood', qty: 2_000_000_000 },
			{ resource: 'stone', qty: 1_500_000_000 },
			{ component: 'plank_bundle', qty: 500 },
		],
		output: { item: 'dawnsplitter', qty: 1 },
		unlock: LEGENDARY_UNLOCK,
		xp: 100_000,
		timeSec: 86_400,
	},
	{
		id: 'legendary_stormstring',
		kind: 'legendary',
		name: 'Stormstring',
		inputs: [
			{ resource: 'wood', qty: 2_000_000_000 },
			{ resource: 'hide', qty: 1_000_000_000 },
			{ component: 'cured_leather', qty: 500 },
		],
		output: { item: 'stormstring', qty: 1 },
		unlock: LEGENDARY_UNLOCK,
		xp: 100_000,
		timeSec: 86_400,
	},
	{
		id: 'legendary_starlight_wand',
		kind: 'legendary',
		name: 'Starlight Wand',
		inputs: [
			{ resource: 'stone', qty: 2_000_000_000 },
			{ resource: 'coal', qty: 1_500_000_000 },
			{ component: 'plank_bundle', qty: 500 },
		],
		output: { item: 'starlight_wand', qty: 1 },
		unlock: LEGENDARY_UNLOCK,
		xp: 100_000,
		timeSec: 86_400,
	},
];

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
