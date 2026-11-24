/**
 * The refined crafting chains (crafting rework, owner 2026-11-19, IDL-358): raw ores, rough gems and monster ingredients are smelted, cut, ground and brewed into **components** (ingots, cut gems, tools, extracts, boards and cloth) that the gear and
 * potion recipes then eat. Pure data: one entry per component and one per recipe, built by the small helpers below, so adding an ore, a gem or an elixir is one line. Component ids are append-only (they name keys of the ledger's stock).
 *
 * - **Metals**: Copper Ingot (copper ore + coal), Iron Ingot (iron nodules + coal), Steel Ingot (2 iron ingots + Ember Coal + coal), Silver Ingot, Gold Ingot (with Ember Coal) and the Obsidian Edge (obsidian chips + a steel ingot). Weapons and armor from the Hide grade up eat them.
 * - **Fasteners**: an ingot is hammered into Copper Nails, Iron Nails, Steel Rivets, Silver Rivets or Gold Studs, and every armor recipe from the Hide tier up is fastened with the ones of its metal.
 * - **Gems**: every rough gem has **its own polishing recipe**. Polishing needs tools that are crafted too: **Gem Grit** (flint and stone) for every gem, a **Polishing Cloth** (cured leather and grit) from the blue gems on, and a Glass Vial of polishing paste for the top tier. A cut gem sits in jewelry from the Hide grade up.
 * - **Extracts and parts**: Herb, Fungal and Vital Extract (the base of the elixirs), Stone Blocks and Cloth Bolts (cloaks, later buildings).
 *
 * The tier of an ingredient follows its look (`catalog/ingredients.ts`: grey 1, green 2, blue 3, purple and red 4); the higher the tier the rarer it drops (`config/rocks.ts`), so the recipes ask for fewer of the rare ones and more tools.
 *
 * @category Economy/Crafting
 * @order 4
 */
import type { Recipe, RecipeInput } from './recipes';

export type ComponentGroup = 'metal' | 'fastener' | 'gem' | 'tool' | 'extract' | 'material' | 'part';

export interface RefinedComponent {
	id: string;
	name: string;
	description: string;
	group: ComponentGroup;
}

const comp = (id: string, name: string, group: ComponentGroup, description: string): RefinedComponent => ({ id, name, description, group });

const ing = (id: string, qty: number): RecipeInput => ({ component: `ing_${id}`, qty });
const part = (id: string, qty: number): RecipeInput => ({ component: id, qty });
const res = (
	resource:
		| 'stone'
		| 'coal'
		| 'food'
		| 'wool'
		| 'wood'
		| 'hide'
		| 'herbs'
		| 'sap'
		| 'ironOre'
		| 'spores'
		| 'frostshard'
		| 'pearls'
		| 'salt'
		| 'venom'
		| 'dye'
		| 'royalJelly'
		| 'corruptedCore'
		| 'scrapSteel',
	qty: number,
): RecipeInput => ({ resource, qty });

const recipe = (id: string, name: string, inputs: RecipeInput[], component: string, unlock: number, xp: number, timeSec: number, qty = 1): Recipe => ({
	id,
	kind: 'component',
	name,
	inputs,
	output: { component, qty },
	unlock,
	xp,
	timeSec,
});

/** The raw gems that can be polished: rough ingredient, name, tier (by look), crafting level that unlocks the cut, and the shape that wears the icon */
const GEMS: { id: string; name: string; tier: 1 | 2 | 3 | 4; unlock: number; raw: string; story: string }[] = [
	{ id: 'jasper', name: 'Jasper', tier: 2, unlock: 8, raw: 'jasper', story: 'A polished brown-red stone with teal bands.' },
	{ id: 'malachite', name: 'Malachite', tier: 2, unlock: 9, raw: 'malachite', story: 'A deep green stone with ringed veins.' },
	{ id: 'turquoise', name: 'Turquoise', tier: 2, unlock: 10, raw: 'turquoise', story: 'A bright sky-blue stone, brown-veined.' },
	{ id: 'geode', name: 'Geode Stone', tier: 2, unlock: 10, raw: 'geode', story: 'The glittering heart of a split geode, cut flat.' },
	{ id: 'amethyst', name: 'Amethyst', tier: 1, unlock: 12, raw: 'amethyst', story: 'A cold purple stone that hums when it is near magic.' },
	{ id: 'lapis', name: 'Lapis', tier: 3, unlock: 22, raw: 'lapis', story: 'A deep blue stone flecked with gold.' },
	{ id: 'garnet', name: 'Garnet', tier: 3, unlock: 24, raw: 'garnet', story: 'A serious dark red stone.' },
	{ id: 'moon', name: 'Moonstone', tier: 3, unlock: 26, raw: 'moon', story: 'A pale stone that keeps a little of the night in it.' },
	{ id: 'crystal', name: 'Crystal', tier: 3, unlock: 28, raw: 'crystal', story: 'A clear, perfectly cut gem that rings like a bell.' },
	{ id: 'emerald', name: 'Emerald', tier: 3, unlock: 30, raw: 'emerald_star', story: 'A vivid green gem with a star inside.' },
	{ id: 'ruby', name: 'Ruby', tier: 4, unlock: 42, raw: 'ruby', story: 'A blood-red gem worth a small kingdom.' },
	{ id: 'sapphire', name: 'Sapphire', tier: 4, unlock: 44, raw: 'sapphire', story: 'A flawless blue gem, the colour of deep water.' },
	{ id: 'heart', name: 'Heart Gem', tier: 4, unlock: 48, raw: 'heart_gem', story: 'A faceted blue heart that still keeps its pulse.' },
];

/** What polishing a gem of this tier takes besides the rough stone: the tools are crafted too (Gem Grit, then a Polishing Cloth, then a vial of paste) */
const polishInputs = (tier: 1 | 2 | 3 | 4, raw: string): RecipeInput[] => {
	if (tier <= 2) return [ing(raw, 2), part('gem_grit', 1)];
	// the blue gems are polished with pearl dust (Pearls from the lake Extractor), the top gems with pearls and frostshard
	if (tier === 3) return [ing(raw, 2), part('gem_grit', 2), part('polish_cloth', 1), res('pearls', 100)];
	return [ing(raw, 1), part('gem_grit', 3), part('polish_cloth', 2), part('glass_vial', 1), res('pearls', 300), res('frostshard', 300)];
};

export const cutGemId = (gem: string): string => `cut_${gem}`;
/** The cut gems, by id (the polished stones jewelry eats) */
export const CUT_GEMS: readonly string[] = GEMS.map((g) => cutGemId(g.id));

const GEM_COMPONENTS = GEMS.map((g) =>
	comp(cutGemId(g.id), `Cut ${g.name}`, 'gem', `${g.story} Polished from the rough stone with Gem Grit; it sits in jewelry.`),
);
const GEM_RECIPES = GEMS.map((g) =>
	recipe(cutGemId(g.id), `Cut ${g.name}`, polishInputs(g.tier, g.raw), cutGemId(g.id), g.unlock, 6 + g.tier * 6, 20 + g.tier * 10),
);

const METAL_COMPONENTS = [
	comp('copper_ingot', 'Copper Ingot', 'metal', 'Copper ore smelted with coal into a soft red bar. Rivets, buckles and the first plates.'),
	comp('iron_ingot', 'Iron Ingot', 'metal', 'Iron nodules smelted with coal into a dull grey bar. The honest metal of the Iron grade.'),
	comp('steel_ingot', 'Steel Ingot', 'metal', 'Two iron ingots and a pinch of Ember Coal, folded until blue. The metal of the Steel grade.'),
	comp('silver_ingot', 'Silver Ingot', 'metal', 'Silver ore smelted pale and bright. Clasps, settings and fine edges.'),
	comp('gold_ingot', 'Gold Ingot', 'metal', 'Gold ore smelted with Ember Coal into a heavy bar. Settings for the best stones.'),
	comp('obsidian_edge', 'Obsidian Edge', 'metal', 'Obsidian chips set in a steel bar and ground to a edge that never dulls. The blades of the Obsidian grade.'),
];
const METAL_RECIPES = [
	recipe('copper_ingot', 'Copper Ingot', [ing('copper_ore', 2), res('coal', 20)], 'copper_ingot', 4, 5, 15),
	recipe('iron_ingot', 'Iron Ingot', [ing('iron_ore', 2), res('ironOre', 50), res('coal', 40)], 'iron_ingot', 8, 8, 20),
	recipe('steel_ingot', 'Steel Ingot', [part('iron_ingot', 2), ing('ember_coal', 1), res('ironOre', 200), res('coal', 80)], 'steel_ingot', 14, 14, 30),
	recipe('silver_ingot', 'Silver Ingot', [ing('silver_ore', 2), res('salt', 100), res('coal', 60)], 'silver_ingot', 14, 14, 30),
	recipe('gold_ingot', 'Gold Ingot', [ing('gold_ore', 2), ing('ember_coal', 1), res('salt', 300), res('coal', 120)], 'gold_ingot', 30, 30, 45),
	recipe('obsidian_edge', 'Obsidian Edge', [ing('obsidian', 2), part('steel_ingot', 1), res('coal', 150)], 'obsidian_edge', 45, 60, 60),
];

/** Nails and rivets, hammered from ingots (crafting rework, 2026-11-19): the small parts armor is fastened with. One ingot makes a handful, and every tier of armor from Hide up asks for the fasteners of its metal. */
const FASTENER_COMPONENTS = [
	comp('copper_nails', 'Copper Nails', 'fastener', 'Soft copper nails, hammered from a copper ingot. They hold the first leather and cloth armor together.'),
	comp('iron_nails', 'Iron Nails', 'fastener', 'Plain iron nails. The studs and seams of the Iron grade.'),
	comp('steel_rivets', 'Steel Rivets', 'fastener', 'Blued steel rivets, set hot and left to cool. They keep the plates of the Steel grade from rattling.'),
	comp('silver_rivets', 'Silver Rivets', 'fastener', 'Bright silver rivets for the Knight grade. They shine, and they do not rust.'),
	comp('gold_studs', 'Gold Studs', 'fastener', 'Heavy gold studs for the Obsidian grade. Armor this fine is meant to be seen.'),
];
const FASTENER_RECIPES = [
	recipe('copper_nails', 'Copper Nails', [part('copper_ingot', 1), res('coal', 10)], 'copper_nails', 6, 4, 12, 12),
	recipe('iron_nails', 'Iron Nails', [part('iron_ingot', 1), res('coal', 20)], 'iron_nails', 12, 7, 15, 16),
	recipe('steel_rivets', 'Steel Rivets', [part('steel_ingot', 1), res('coal', 40)], 'steel_rivets', 20, 12, 20, 16),
	recipe('silver_rivets', 'Silver Rivets', [part('silver_ingot', 1), res('coal', 30)], 'silver_rivets', 30, 20, 25, 16),
	recipe('gold_studs', 'Gold Studs', [part('gold_ingot', 1), res('coal', 60)], 'gold_studs', 40, 35, 30, 12),
];

const PART_COMPONENTS = [
	comp('gem_grit', 'Gem Grit', 'tool', 'Flint ground to a gritty powder. Every cut gem is polished with it, and the better the stone the more it takes.'),
	comp('polish_cloth', 'Polishing Cloth', 'tool', 'Cured leather charged with grit. It gives a gem its final shine, so the blue and finer stones need one.'),
	comp('stone_block', 'Stone Block', 'part', 'A stone cut square. Builders will ask for them, and so will the heavier crafts to come.'),
	comp('cloth_bolt', 'Cloth Bolt', 'material', 'Wool woven into a bolt of cloth. Every cloak and wrap starts here.'),
	comp(
		'herb_extract',
		'Herb Extract',
		'extract',
		'Dried herbs boiled down in a vial until the colour is gone green. The base of the strength and sight elixirs.',
	),
	comp('fungal_extract', 'Fungal Extract', 'extract', 'Mushroom caps pressed into a glowing orange syrup. The base of the speed and night elixirs.'),
	comp('vital_extract', 'Vital Extract', 'extract', 'Blood and a little food, strained red. The base of the tonics that heal and harden.'),
];
const PART_RECIPES = [
	recipe('gem_grit', 'Gem Grit', [ing('flint', 2), res('stone', 30)], 'gem_grit', 5, 4, 12, 3),
	recipe('polish_cloth', 'Polishing Cloth', [part('cured_leather', 1), part('gem_grit', 1)], 'polish_cloth', 12, 8, 20),
	recipe('stone_block', 'Stone Block', [res('stone', 100), res('coal', 10)], 'stone_block', 6, 4, 15),
	recipe('cloth_bolt', 'Cloth Bolt', [res('wool', 60)], 'cloth_bolt', 7, 5, 15),
	recipe('herb_extract', 'Herb Extract', [ing('dried_herbs', 3), part('glass_vial', 1), res('herbs', 60), res('coal', 10)], 'herb_extract', 4, 6, 18),
	recipe('fungal_extract', 'Fungal Extract', [ing('orange_mushrooms', 3), part('glass_vial', 1), res('spores', 60)], 'fungal_extract', 8, 8, 20),
	recipe('vital_extract', 'Vital Extract', [ing('blood', 2), part('glass_vial', 1), res('herbs', 30), res('food', 20)], 'vital_extract', 6, 7, 18),
	// the two reagents of the late crafts come from the Blight and Battlefield Extractors (IDL-120): their extracts are distilled and forged into them
	recipe('ichor', 'Distilled Ichor', [part('glass_vial', 1), res('corruptedCore', 1000)], 'ing_ichor', 60, 40, 60),
	recipe('war_medals', 'Forged War Medal', [part('gold_ingot', 1), res('scrapSteel', 1500)], 'ing_war_medals', 70, 50, 90),
];

/** The refined components (ingots, cut gems, tools, extracts), merged into `COMPONENTS` */
export const REFINED_COMPONENTS: readonly RefinedComponent[] = [...METAL_COMPONENTS, ...FASTENER_COMPONENTS, ...PART_COMPONENTS, ...GEM_COMPONENTS];

/** The potion recipes made of them: healing and mana, the Vitality Tonic and seven elixirs (one per buff family, `catalog/buffs.ts`). The items are in `catalog/items/consumables.ts`. */
const POTION_RECIPES: Recipe[] = [
	{
		id: 'potion_mana',
		kind: 'potion',
		name: 'Mana Potion',
		inputs: [part('glass_vial', 1), part('arcane_essence', 1), res('food', 60)],
		output: { item: 'potion_mana', qty: 1 },
		unlock: 6,
		xp: 20,
		timeSec: 25,
	},
	{
		id: 'potion_regen',
		kind: 'potion',
		name: 'Vitality Tonic',
		inputs: [part('vital_extract', 1), res('herbs', 100), res('food', 120), res('coal', 40)],
		output: { item: 'potion_regen', qty: 1 },
		unlock: 10,
		xp: 30,
		timeSec: 30,
	},
	{
		id: 'elixir_might',
		kind: 'potion',
		name: 'Elixir of Might',
		inputs: [part('herb_extract', 2), ing('claw', 3), part('glass_vial', 1), res('herbs', 100)],
		output: { item: 'elixir_might', qty: 1 },
		unlock: 16,
		xp: 60,
		timeSec: 45,
	},
	{
		id: 'elixir_haste',
		kind: 'potion',
		name: 'Elixir of Haste',
		inputs: [part('fungal_extract', 1), ing('glowberry', 3), part('glass_vial', 1), res('spores', 100)],
		output: { item: 'elixir_haste', qty: 1 },
		unlock: 18,
		xp: 70,
		timeSec: 45,
	},
	{
		id: 'elixir_ironskin',
		kind: 'potion',
		name: 'Elixir of Ironskin',
		inputs: [part('herb_extract', 1), part('iron_ingot', 1), ing('clay', 3), part('glass_vial', 1), res('ironOre', 100)],
		output: { item: 'elixir_ironskin', qty: 1 },
		unlock: 20,
		xp: 80,
		timeSec: 50,
	},
	{
		id: 'elixir_fortitude',
		kind: 'potion',
		name: 'Elixir of Fortitude',
		inputs: [part('vital_extract', 2), ing('grapes', 4), part('glass_vial', 1), res('herbs', 100)],
		output: { item: 'elixir_fortitude', qty: 1 },
		unlock: 22,
		xp: 90,
		timeSec: 50,
	},
	{
		id: 'elixir_keen_eye',
		kind: 'potion',
		name: 'Elixir of the Keen Eye',
		inputs: [part('fungal_extract', 1), part('cut_jasper', 1), ing('glowberry', 2), part('glass_vial', 1), res('sap', 100)],
		output: { item: 'elixir_keen_eye', qty: 1 },
		unlock: 24,
		xp: 100,
		timeSec: 55,
	},
	{
		id: 'elixir_arcana',
		kind: 'potion',
		name: 'Elixir of Arcana',
		inputs: [part('arcane_essence', 2), ing('glowberry', 3), part('glass_vial', 1), res('herbs', 100)],
		output: { item: 'elixir_arcana', qty: 1 },
		unlock: 26,
		xp: 110,
		timeSec: 55,
	},
	{
		id: 'elixir_time_shift',
		kind: 'potion',
		name: 'Elixir of Time Shift',
		// the most expensive brew of the game: the resources alone are worth more than the hour it pays (tests/crafting/timeShift.test.ts), and the Hourglass Sand is a rare drop of the Banner Wraith and the Cinder Warlord (IDL-381)
		inputs: [
			ing('hourglass_sand', 5),
			part('gold_ingot', 5),
			part('cut_crystal', 3),
			part('glass_vial', 1),
			res('wood', 8_000_000),
			res('stone', 6_000_000),
			res('coal', 6_000_000),
			res('food', 10_000_000),
		],
		output: { item: 'elixir_time_shift', qty: 1 },
		unlock: 70,
		xp: 500,
		timeSec: 600,
	},
	{
		id: 'elixir_warding',
		kind: 'potion',
		name: 'Elixir of Warding',
		inputs: [part('arcane_essence', 1), part('cut_moon', 1), part('vital_extract', 1), part('glass_vial', 1), res('frostshard', 100)],
		output: { item: 'elixir_warding', qty: 1 },
		unlock: 30,
		xp: 140,
		timeSec: 60,
	},
];

/** Every refined recipe in the order the crafting list shows them (metals, parts and extracts, gems, potions) */
export const REFINED_RECIPES: readonly Recipe[] = [...METAL_RECIPES, ...FASTENER_RECIPES, ...PART_RECIPES, ...GEM_RECIPES, ...POTION_RECIPES];
