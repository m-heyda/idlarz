import { MONSTER_CATALOG, type MonsterFamily } from './monsters';

// What a monster leaves behind besides gear, gold and the common junk: its **ingredients** (the Bestiary drop table, owner request 2026-11-18). They are junk materials today (the merchant buys them, `catalog/items/junk.ts`) and the sub-ingredients of crafting later
// (IDL-358, IDL-226). Pure data: the roll is `rollIngredientDrops` in `lib/loot/junkDrops.ts`, the table the Bestiary shows is `dropTableOf` in `lib/bestiary/drops.ts`. Numbers are starting points for the balance pass.

/** One ingredient a monster may leave. The amount at level L is `min..max` plus `floor(perLevel x (L - 1))`, so a high level monster drops more of it. */
export interface IngredientDrop {
	/** A junk item id (`junk_bacon`) */
	id: string;
	/** Chance per kill, before Luck (a boss's table is guaranteed: chance 1) */
	chance: number;
	/** The monster level it starts to drop at */
	minLevel: number;
	/** Amount at level 1, both ends included */
	qty: readonly [number, number];
	/** Extra amount per monster level above 1 */
	perLevel: number;
}

const d = (id: string, chance: number, qty: readonly [number, number] = [1, 2], perLevel = 0.1, minLevel = 1): IngredientDrop => ({
	id: `junk_${id}`,
	chance,
	minLevel,
	qty,
	perLevel,
});

/**
 * What each family leaves (two or three ingredients), so a bear and a boar share a theme and the Bestiary can explain it.
 *
 * @category Monsters/Bestiary
 * @order 2
 * @table bestiary-ingredients
 */
export const FAMILY_DROPS: Readonly<Record<MonsterFamily, readonly IngredientDrop[]>> = {
	Beast: [d('bacon', 0.12), d('blood', 0.09), d('horn', 0.04, [1, 1], 0.05, 3)],
	Bird: [d('feather', 0.16, [1, 3]), d('bacon', 0.05)],
	Vermin: [d('claw', 0.07, [1, 1], 0.05), d('tar', 0.06)],
	Aquatic: [d('sand', 0.1, [1, 3]), d('blood', 0.05), d('geode', 0.02, [1, 1], 0.03, 10)],
	Undead: [d('bones', 0.18, [1, 3]), d('dark_potion', 0.03, [1, 1], 0.03, 8), d('moon', 0.01, [1, 1], 0.02, 14)],
	Plant: [d('sticks', 0.16, [1, 3]), d('dried_herbs', 0.14), d('hollow_log', 0.08, [1, 1])],
	Fungus: [d('orange_mushrooms', 0.14, [1, 3]), d('glowberry', 0.06, [1, 2], 0.1, 5), d('dried_herbs', 0.05)],
	Demon: [d('blood', 0.08), d('horn_dark', 0.04, [1, 1], 0.04, 8), d('dark_shard', 0.02, [1, 1], 0.03, 14)],
	Construct: [d('clay', 0.12, [1, 3]), d('scrap', 0.12, [1, 3]), d('copper_ore', 0.06, [1, 2], 0.1, 3), d('geode', 0.02, [1, 1], 0.03, 8)],
	Humanoid: [d('coins', 0.12, [1, 3]), d('jug', 0.08, [1, 1]), d('bacon', 0.06)],
	Elemental: [d('ember_coal', 0.1, [1, 2]), d('obsidian', 0.03, [1, 1], 0.03, 8), d('fire_drop', 0.015, [1, 1], 0.02, 10)],
	Dragon: [d('claw', 0.08, [1, 2]), d('ember_coal', 0.06, [1, 2]), d('fire_drop', 0.02, [1, 1], 0.02, 10)],
};

/** What one monster leaves on top of its family's table: the farm country drops its crops, the hills their ore, the battlefield its coin. */
export const MONSTER_DROPS: Readonly<Record<string, readonly IngredientDrop[]>> = {
	// plains and forest
	thistleBoar: [d('carrot', 0.1), d('bacon', 0.08)],
	burrowBadger: [d('carrot', 0.1), d('clay', 0.1, [1, 3])],
	dustStrider: [d('sticks', 0.08)],
	gravelQuail: [d('carrot', 0.06)],
	stonehornBison: [d('horn', 0.1, [1, 2], 0.05, 1)],
	mossbackWolf: [d('sticks', 0.06)],
	rotcapStag: [d('orange_mushrooms', 0.1, [1, 2]), d('horn', 0.06, [1, 1], 0.05, 2)],
	emberSquirrel: [d('ember_coal', 0.05), d('sticks', 0.08)],
	pineconeWarden: [d('sticks', 0.14, [2, 4])],
	// hills
	magmaKnight: [d('obsidian', 0.05, [1, 1], 0.03, 6), d('copper_ore', 0.08)],
	magmaCrab: [d('ember_coal', 0.1), d('geode', 0.04, [1, 1], 0.03, 6)],
	mawhornBrute: [d('horn_dark', 0.06, [1, 1], 0.04, 6)],
	quarryDrake: [d('copper_ore', 0.08), d('geode', 0.04, [1, 1], 0.03, 8)],
	cairnSentinel: [d('geode', 0.05, [1, 1], 0.03, 6), d('copper_ore', 0.1, [1, 3])],
	// swamp and tundra
	dumpback: [d('jug', 0.08), d('scrap', 0.1, [1, 3])],
	rotHeron: [d('blood', 0.06)],
	toxicZombie: [d('dark_potion', 0.05, [1, 1], 0.03, 6)],
	bogfireWisp: [d('moon', 0.02, [1, 1], 0.02, 10), d('glowberry', 0.08, [1, 2], 0.1, 5)],
	glacierYeti: [d('horn', 0.08, [1, 1], 0.05, 6), d('bacon', 0.1)],
	rimeWraith: [d('moon', 0.03, [1, 1], 0.02, 10)],
	// coast and lake
	wreckCrab: [d('jug', 0.08), d('coins', 0.06)],
	netGull: [d('grapes', 0.05)],
	drownedSailor: [d('coins', 0.14, [1, 4]), d('jug', 0.1)],
	tideglassJelly: [d('glowberry', 0.06, [1, 2], 0.1, 4)],
	barnacleBrute: [d('copper_ore', 0.06), d('clay', 0.08, [1, 2])],
	mossSnapper: [d('hollow_log', 0.08, [1, 1])],
	reedNymph: [d('glowberry', 0.08, [1, 2], 0.1, 4), d('grapes', 0.06)],
	siltEel: [d('geode', 0.03, [1, 1], 0.03, 8)],
	tidepoolGolem: [d('geode', 0.06, [1, 1], 0.03, 8)],
	lilypadWarden: [d('hollow_log', 0.08, [1, 1]), d('beet', 0.08)],
	// jungle
	skullVine: [d('bones', 0.12, [1, 3]), d('hollow_log', 0.08, [1, 1])],
	eyeHorror: [d('emerald_star', 0.02, [1, 1], 0.02, 14)],
	zombieTriceratops: [d('horn', 0.1, [1, 2], 0.05, 6), d('bones', 0.14, [1, 3])],
	vinewhipPanther: [d('emerald_star', 0.015, [1, 1], 0.02, 14)],
	mossbackIdol: [d('emerald_star', 0.02, [1, 1], 0.02, 14), d('geode', 0.05, [1, 1], 0.03, 10)],
	// fields
	barnGargoyle: [d('clay', 0.1, [1, 3]), d('wheat_sheaf', 0.08)],
	bucketKnight: [d('wheat_sheaf', 0.12, [1, 3]), d('beet', 0.1), d('jug', 0.06)],
	hedgeBandit: [d('coins', 0.16, [1, 4]), d('jug', 0.1)],
	crowMarshal: [d('wheat_sheaf', 0.1, [1, 2]), d('feather', 0.12, [1, 3])],
	millstoneGolem: [d('wheat_sheaf', 0.14, [1, 3]), d('clay', 0.12, [1, 3])],
	// orchard
	greenscaleWarden: [d('grapes', 0.12, [1, 3]), d('horn', 0.05, [1, 1], 0.05, 6)],
	blossomRonin: [d('grapes', 0.1, [1, 2])],
	grayGleaner: [d('grapes', 0.14, [1, 3]), d('beet', 0.1), d('carrot', 0.1)],
	mushroomWizard: [d('glowberry', 0.1, [1, 2], 0.1, 4), d('dark_potion', 0.04, [1, 1], 0.03, 10)],
	rootboundGardener: [d('carrot', 0.14, [1, 3]), d('beet', 0.12, [1, 3]), d('grapes', 0.1)],
	// blight
	gasketGoblin: [d('scrap', 0.14, [1, 3]), d('copper_ore', 0.08)],
	blightedHusk: [d('dark_potion', 0.06, [1, 1], 0.03, 10)],
	mothwingHexer: [d('dark_shard', 0.03, [1, 1], 0.03, 14)],
	gloomCerberus: [d('dark_shard', 0.05, [1, 1], 0.03, 14), d('horn_dark', 0.08, [1, 1], 0.04, 10)],
	sporebackOgre: [d('orange_mushrooms', 0.16, [1, 4]), d('dark_shard', 0.04, [1, 1], 0.03, 14)],
	// battlefield
	boneCleaver: [d('bones', 0.2, [1, 4]), d('blood', 0.1)],
	frostguardKnight: [d('copper_ore', 0.1), d('coins', 0.1, [1, 3])],
	gildedChampion: [d('coins', 0.2, [2, 5]), d('heart_gem', 0.004, [1, 1], 0.01, 20)],
	bannerWraith: [d('moon', 0.03, [1, 1], 0.02, 12), d('coins', 0.1, [1, 3])],
	frostFlameKnight: [d('ember_coal', 0.12, [1, 3]), d('obsidian', 0.05, [1, 1], 0.03, 12)],
};

/**
 * What a boss always leaves, on top of the family table and the boss stack of the junk table: each ingredient is guaranteed (chance 1) and grows with the boss's level.
 * A boss not listed here leaves its family's drops only (nothing guaranteed beyond the junk boss stack).
 */
export const BOSS_DROPS: Readonly<Record<string, readonly IngredientDrop[]>> = {
	bossGreatAuroch: [d('horn', 1, [2, 3], 0.1), d('bacon', 1, [3, 5], 0.2)],
	bossElderStag: [d('horn', 1, [2, 3], 0.1), d('glowberry', 1, [2, 4], 0.15)],
	bossIronhorn: [d('copper_ore', 1, [4, 6], 0.2), d('ember_coal', 1, [3, 5], 0.15), d('geode', 1, [1, 2], 0.05)],
	bossMireMatriarch: [d('blood', 1, [3, 5], 0.15), d('dark_potion', 1, [1, 2], 0.05)],
	bossWinterWyrm: [d('horn_dark', 1, [1, 2], 0.08), d('moon', 1, [1, 1], 0.05)],
	bossReefLeviathan: [d('geode', 1, [1, 2], 0.05), d('sand', 1, [6, 10], 0.3)],
	bossLakeHydra: [d('horn', 1, [2, 4], 0.1), d('dark_potion', 1, [1, 2], 0.05)],
	bossBrainstorm: [d('orange_mushrooms', 1, [5, 8], 0.3), d('emerald_star', 1, [1, 1], 0.04)],
	bossHarvestMatron: [d('wheat_sheaf', 1, [5, 8], 0.3), d('feather', 1, [4, 6], 0.2)],
	bossBlossomReaper: [d('grapes', 1, [4, 6], 0.2), d('moon', 1, [1, 2], 0.05)],
	bossEyedMaw: [d('dark_shard', 1, [1, 2], 0.06), d('orange_mushrooms', 1, [4, 6], 0.2)],
	bossCinderWarlord: [d('fire_drop', 1, [1, 2], 0.05), d('heart_gem', 1, [1, 1], 0.015), d('coins', 1, [6, 10], 0.3)],
};

/** The ingredient table of a monster: its family's, its own, and for a boss the guaranteed ones (an ingredient listed twice keeps the most specific row). Empty for a type the catalog does not know. */
export const ingredientsOf = (type: string): readonly IngredientDrop[] => {
	const entry = MONSTER_CATALOG.find((m) => m.id === type);
	if (!entry) return [];
	// one row per ingredient: the monster's own row replaces its family's, a boss's guaranteed row replaces both
	const byId = new Map<string, IngredientDrop>();
	for (const row of [...FAMILY_DROPS[entry.family], ...(MONSTER_DROPS[type] ?? []), ...(BOSS_DROPS[type] ?? [])]) byId.set(row.id, row);
	return [...byId.values()];
};

/** How many of an ingredient one drop gives at this monster level (before the golden-monster multiplier): the range at level 1 plus `perLevel` per level above, rounded down. */
export const ingredientQty = (drop: IngredientDrop, level: number, roll: number): number => {
	const extra = Math.floor(drop.perLevel * Math.max(0, level - 1));
	const [lo, hi] = drop.qty;
	return lo + Math.min(hi - lo, Math.floor(roll * (hi - lo + 1))) + extra;
};
