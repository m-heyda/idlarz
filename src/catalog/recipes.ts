/**
 * Crafting recipes (docs/plan/crafting-v0.md). Data only: a recipe lists what it eats, what it makes, the crafting level that unlocks it and
 * the crafting XP one craft gives. Four kinds: `potion`, `component`, `good` (v0.1) and `gear` (v0.2, IDL-241).
 *   potion     usable items (a bag stack of a consumable)
 *   component  half-products that sit in a ledger counter (craft.stock), never in the bag
 *   good       trade goods: a bag stack with no use, sold to the merchant like any item (v0.1, IDL-227)
 *   gear       equipment: one recipe per grade (G1-G4) and slot, rolled by the server through the loot pipeline's `craft` source when a batch is claimed (docs/plan/17-crafting.md)
 */
import { CRAFT_GEAR } from '@/config/crafting';
import { GRADE_INFO, type Grade } from '@/catalog/items/grades';
import type { ItemDef } from '@/types/game';
import { RESOURCES, type MerchantResourceKey } from './resources';

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
/** What a gear recipe makes: any base of this slot in this grade, picked by the loot pipeline (the player picks the slot and the grade, not the item) */
export interface GearTarget {
	grade: Grade;
	slot: CraftSlot;
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

/** The grades with a gear recipe, lowest first, and the crafting level each unlocks at (owner 2026-11-07: G1 1, G2 8, G3 15, G4 25) */
export const GEAR_UNLOCK = { G1: 1, G2: 8, G3: 15, G4: 25 } as const satisfies Partial<Record<Grade, number>>;
export type CraftGrade = keyof typeof GEAR_UNLOCK;
export const CRAFT_GRADES = Object.keys(GEAR_UNLOCK) as CraftGrade[];

/**
 * What a gear recipe takes. A grade has a **value** (the gold worth, at merchant prices, of a recipe of weight 1) and a number of **parts** (Plank Bundles or Cured Leather; none at G1, where no component is unlocked yet);
 * a slot's weight scales both. The rest of the value is merchant resources by the slot's family: weapons and shields wood and stone (and Plank Bundles), armour hide, coal and food (and Cured Leather), trinkets stone, coal and wood
 * (and a Plank Bundle). The value is **1.25 x the mean sell value of what the grade makes at the top of its item level window** (measured by `npm run craft-sim`, gated there and in tests/crafting/gearRecipes.test.ts), so a craft always costs more than
 * the piece sells for, whatever the crafting level, Luck or Intelligence: crafting is a resource sink and never a gold printer. The XP is sized so a grade takes about 35 pieces to climb to the next grade's unlock.
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
/** Per grade: the gold value of a weight-1 recipe, the components in it, and the crafting XP of a weight-1 craft */
const GEAR_GRADE_COST: Record<CraftGrade, { value: number; parts: number; xp: number }> = {
	G1: { value: 2_400, parts: 0, xp: 60 },
	G2: { value: 21_500, parts: 3, xp: 800 },
	G3: { value: 222_000, parts: 6, xp: 2_500 },
	G4: { value: 1_600_000, parts: 12, xp: 6_000 },
};
/** How the resource part of the value splits over the resources of a family (shares add up to 1) */
const FAMILY_SPLIT: Record<Family, Partial<Record<MerchantResourceKey, number>>> = {
	weapon: { wood: 0.55, stone: 0.45 },
	armour: { hide: 0.45, coal: 0.3, food: 0.25 },
	trinket: { stone: 0.4, coal: 0.3, wood: 0.3 },
};
const FAMILY_PART: Record<Family, string> = { weapon: 'plank_bundle', armour: 'cured_leather', trinket: 'plank_bundle' };

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

const gearInputs = (grade: CraftGrade, slot: CraftSlot): RecipeInput[] => {
	const { value, parts } = GEAR_GRADE_COST[grade];
	const weight = SLOT_WEIGHT[slot];
	const family = FAMILY[slot];
	const count = parts > 0 ? Math.max(1, Math.round(parts * weight)) : 0;
	const raw = Math.max(0, value * weight - count * componentValue(FAMILY_PART[family]));
	const inputs: RecipeInput[] = (Object.entries(FAMILY_SPLIT[family]) as [MerchantResourceKey, number][]).map(([resource, share]) => ({
		resource,
		qty: nice((raw * share) / RESOURCES[resource].merchant.price),
	}));
	if (count > 0) inputs.push({ component: FAMILY_PART[family], qty: count });
	return inputs;
};

/**
 * The gear recipes (IDL-241): one per grade G1-G4 and slot, 13 slots, 52 recipes. The player picks the grade and the slot; the server rolls the base, rarity and affixes at claim time through the `craft` loot source (rarity by Luck and the
 * pity counter, quality by Intelligence, item level by the crafting level inside the grade's window; see {@link CRAFT_GEAR}). Every gear recipe is timed (`CRAFT_GEAR.timeSec`) and runs in the batch queue.
 * Adding a grade is one entry in `GEAR_UNLOCK`, `GEAR_GRADE_COST` and `CRAFT_GEAR.timeSec`; adding a slot is one in the tables above.
 *
 * @category Economy/Crafting
 * @order 2
 * @table craft-gear-recipes
 */
export const GEAR_RECIPES: Recipe[] = CRAFT_GRADES.flatMap((grade) =>
	CRAFT_SLOTS.map(
		(slot): Recipe => ({
			id: `gear_${grade.toLowerCase()}_${slot.toLowerCase()}`,
			kind: 'gear',
			name: `${GRADE_INFO[grade].label} ${CRAFT_SLOT_LABEL[slot]}`,
			inputs: gearInputs(grade, slot),
			output: { gear: { grade, slot }, qty: 1 },
			unlock: GEAR_UNLOCK[grade],
			xp: Math.max(1, Math.round(GEAR_GRADE_COST[grade].xp * SLOT_WEIGHT[slot])),
			timeSec: CRAFT_GEAR.timeSec[grade],
		}),
	),
);
RECIPES.push(...GEAR_RECIPES);

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
