import { IDOLS, type IdolEffectKey } from '@/catalog/idols';
import type { Resources } from '@/types/game';

/** Where the first-pass building art lives: the supplied "Tiny Top-Down Village" pack (80x80), named in the asset library as `building_village_<file>`. */
const VILLAGE = '/pixel/assets_to_assess_and_use/more_buildings/';

/** One building type. `art` is a public URL: real art for a building is a file swap of that one path (IDL-99). */
export interface BuildingDef {
	id: string;
	label: string;
	/** What it is: `producer` (the biome's own materials) `extractor` (its T3 material) or `idol` (a permanent bonus, `catalog/idols.ts`). */
	kind: 'producer' | 'extractor' | 'idol' | 'general';
	/** The one biome whose tiles it can stand on, and whose size it feeds on (a `general` building stands on any land biome: `GENERAL_BIOME`) */
	biome: string;
	/** The resources it makes: for a Producer the keys the biome's tiles make (so it multiplies what the land already gives), for an Extractor its one T3 material, for an Idol nothing */
	produces: (keyof Resources)[];
	/** The picture on the map and in the menu */
	art: string;
	blurb: string;
	/** A `general` building: what its levels add to the economy (the same effects the Idols have, `IdolEffectKey`), and how many copies the map may hold */
	effect?: IdolEffectKey;
	effectText?: string;
	copies?: number;
}

/** The `biome` of a general building: it is not tied to one. */
export const GENERAL_BIOME = 'land';

/** The biomes a general building cannot stand on: the water and the castle. */
export const NO_GENERAL_BIOMES: readonly string[] = ['lake', 'castle', 'empty'];

/** True when a building of this def can stand on a tile of `biome`: its own biome, or any land for a general building. */
export const fitsBiome = (def: Pick<BuildingDef, 'kind' | 'biome'>, biome: string): boolean =>
	def.kind === 'general' ? !NO_GENERAL_BIOMES.includes(biome) : def.biome === biome;

/** The label of a building's kind, as the menus and tooltips show it. */
export const buildingKindLabel = (def: Pick<BuildingDef, 'kind'>): string =>
	def.kind === 'extractor' ? 'Extractor' : def.kind === 'idol' ? 'Idol' : def.kind === 'general' ? 'Building' : 'Producer';

/** A few lines of story for the building window, by building id (every building has some, Idols included): purely flavour, no numbers. */
export const BUILDING_LORE: Readonly<Record<string, string>> = {
	granary: 'Every autumn the plains folk fill its bins to the rafters. A full granary has never once been a sad sight in this kingdom.',
	lumberyard: 'The axes ring from dawn. The lumberjacks swear the forest grows back out of spite, and they plan to keep cutting it just the same.',
	quarry: 'Cut into the hillside by dwarven hands long before your banner flew here. The stone is grey, the coal is black, the wages are gold.',
	peatworks: 'Bog fuel burns slow and smells of old rain. The workers wear tall boots and never speak of what the swamp sometimes gives back.',
	coalpit: 'In the frozen north the smiths need coal more than bread. The pit stays warm, and so does everyone who works near it.',
	fishery: 'A crooked pier, a few patched nets and a very proud fisherman. The lake has never run out of fish, only of patience.',
	harbor: 'Ships from far shores unload spice, rumours and customs forms in equal measure. Your coffers like the forms best.',
	herbgarden: 'Rows of sage, thyme and things the herbalist will not name. The brewers pay well and ask no questions.',
	saptapper: 'Tiny taps in the oldest trunks, buckets below. The trees seem to sigh when the carpenter walks by, but they give the sap.',
	deepmine: 'The shaft goes down further than any rope. The miners sing on the way in, and are very quiet on the way out.',
	sporecellar: 'The wizard says the spores are harmless. The wizard has also been a different colour every week since the cellar opened.',
	icecutter: 'A hunter, a saw and a lot of cold. Frost shards chime softly in the crates, as if they were still thinking about snow.',
	pearldiver: 'They hold their breath longer than seems wise and come up grinning. Somewhere below, the lake keeps its best pearls for itself.',
	idol_plains: 'The scarecrow has stood here longer than the farm. Crows bow to it, and the hens lay a little more when it is watching.',
	idol_forest: 'Roots as thick as a house wrap its base. Forest folk say it never forgets a name, a path or a lesson, and neither will you.',
	idol_hills: 'Carved by the same dwarves who dug the quarry, it still keeps their rhythm. Work done in its shadow somehow goes faster.',
	idol_swamp: 'Bones, feathers and a grin of black moss. The witch who made it is long gone, but the luck she left behind is not.',
	idol_tundra: 'A spire of blue ice that hums in the dark. While you sleep it keeps the fires lit and the workers moving.',
	idol_lake: 'The fountain whispers in a voice like rain on glass. Sailors leave a coin; the water sends back something better.',
	idol_coast: 'Its lamp has not gone out in a hundred years. Every ship that sees it steers for your merchant, and pays well for the welcome.',
	idol_jungle: 'Painted faces, red clay and a hundred feathers. The wild bends its head to it, and the hunt always ends in your favour.',
	idol_fields: 'A king of straw and old rope, crowned with a rusty bucket. When you work the land beside him, every click shines a little brighter.',
	idol_orchard: 'Petals drift around it in every season. Hands that work in its scent learn their craft twice as fast.',
	idol_blight: 'A mouth of black stone that never closes. It feeds on your victories and gives back strength from every blade that falls.',
	idol_battlefield: 'Names cut into grey stone, too many to read. The fallen do not rest here: they stand behind you and lend their strength.',
	junglecamp: 'The canopy hides them until the saws start. The loggers say the jungle bites back, and bills the crown for the plasters.',
	venompress: 'A cold cellar, a steady hand and a very long row of jars. Nobody asks what the labels mean.',
	farmstead: 'A mill on every hill of the patchwork and a farmer who knows each furrow by name. The grain never stops coming.',
	dyeworks: 'The river runs a different colour every morning. The dyers swear it is a feature, not a problem.',
	blossomyard: 'Petals on the wind and a ladder in every tree. The pickers hum as they work and eat as they please.',
	apiary: 'The hives hum in tune. The beekeeper says the jelly is for the queen, and the crown gladly pays for what the queen leaves over.',
	rotworks: 'What the Blight kills, the Rot Works burns. The smoke is black and the coin is real.',
	coresiphon: 'A tall pipe, a deep well and a hum you feel in your teeth. The cores come up warm and unwilling.',
	warcamp: 'Banners without an army, tents without a cook. The old lines still hold good stone and better timber.',
	scrapforge: "Hammers all night over the bones of old wars. Every ingot has someone's last stand in it.",
	watchtower: 'From the top you can see the whole kingdom, and the kingdom can see you looking. Both behave a little better for it.',
	marketplace: 'Stalls, awnings and haggling from sunrise on. Whatever you bring, someone will offer a little more for it.',
	trainingyard: 'Wooden dummies, tired recruits and one very loud drill master. Everyone leaves a little better than they came.',
	scriptorium: 'Quills scratch behind the door. The scribes copy every recipe twice, and improve the second copy.',
	guildhall: 'A board of bounties that never runs short. The guildmaster pays for proof and asks for no questions.',
	garrison: 'Hard bunks, harder food and a sergeant who is proud of both. It makes the hero stand a little taller.',
	saltworks: 'Shallow pans, a lazy sun and a mill that grinds the crust to white. Nothing makes a kingdom last like salt.',
};

/**
 * The Producer and the Extractor of each of the seven home biomes (docs/plan/18 section 3; the five rebirth biomes and their buildings follow with IDL-99). Each makes the resources listed in `produces` at `BUILDING_RULES.producer.tileEquivalents`
 * tiles' worth, so the land under it decides what it is good at. The sprite is first-pass art from the village pack, one `art` field per building.
 *
 * @category Economy/Buildings
 * @order 3
 */
export const BUILDINGS: readonly BuildingDef[] = [
	{
		id: 'granary',
		label: 'Granary',
		kind: 'producer',
		biome: 'plains',
		produces: ['food', 'gold'],
		art: `${VILLAGE}Storage%20House.png`,
		blurb: 'Stores and grows the plains harvest.',
	},
	{
		id: 'lumberyard',
		label: 'Lumberyard',
		kind: 'producer',
		biome: 'forest',
		produces: ['wood', 'gold'],
		art: `${VILLAGE}Lumberjack%20House.png`,
		blurb: 'Fells the forest by the cartload.',
	},
	{
		id: 'quarry',
		label: 'Quarry',
		kind: 'producer',
		biome: 'hills',
		produces: ['stone', 'coal', 'gold'],
		art: `${VILLAGE}Mine%20Entrance%20Building.png`,
		blurb: 'Cuts stone and a little coal out of the hills.',
	},
	{
		id: 'peatworks',
		label: 'Peat Works',
		kind: 'producer',
		biome: 'swamp',
		produces: ['wood', 'food'],
		art: `${VILLAGE}Small%20Wooden%20Cottage.png`,
		blurb: 'Drains the bog for fuel and timber.',
	},
	{
		id: 'coalpit',
		label: 'Coal Pit',
		kind: 'producer',
		biome: 'tundra',
		produces: ['coal', 'gold'],
		art: `${VILLAGE}Blacksmith%20House.png`,
		blurb: 'Digs coal out of the frozen ground.',
	},
	{
		id: 'fishery',
		label: 'Fishery',
		kind: 'producer',
		biome: 'lake',
		produces: ['food', 'gold'],
		art: `${VILLAGE}Fishermans%20Hut.png`,
		blurb: 'Nets and a pier over the water.',
	},
	{
		id: 'harbor',
		label: 'Harbor',
		kind: 'producer',
		biome: 'coast',
		produces: ['gold', 'food'],
		art: `${VILLAGE}Merchant%20House.png`,
		blurb: 'Ships, cargo and a customs house.',
	},
	{
		id: 'herbgarden',
		label: 'Herb Garden',
		kind: 'extractor',
		biome: 'plains',
		produces: ['herbs'],
		art: `${VILLAGE}Herbalist%20House.png`,
		blurb: 'Beds of medicinal herbs for the brewers.',
	},
	{
		id: 'saptapper',
		label: 'Sap Tapper',
		kind: 'extractor',
		biome: 'forest',
		produces: ['sap'],
		art: `${VILLAGE}Carpenters%20House.png`,
		blurb: 'Taps the old trees for sap.',
	},
	{
		id: 'deepmine',
		label: 'Deep Mine',
		kind: 'extractor',
		biome: 'hills',
		produces: ['ironOre'],
		art: `${VILLAGE}Workshop%20House.png`,
		blurb: 'Shafts down to the iron seams.',
	},
	{
		id: 'sporecellar',
		label: 'Spore Cellar',
		kind: 'extractor',
		biome: 'swamp',
		produces: ['spores'],
		art: `${VILLAGE}Wizard%20Hut.png`,
		blurb: 'Cultivates spores in the damp dark.',
	},
	{
		id: 'icecutter',
		label: 'Ice Cutter',
		kind: 'extractor',
		biome: 'tundra',
		produces: ['frostshard'],
		art: `${VILLAGE}Hunters%20Cabin.png`,
		blurb: 'Saws shards out of the ice.',
	},
	{
		id: 'pearldiver',
		label: 'Pearl Diver',
		kind: 'extractor',
		biome: 'lake',
		produces: ['pearls'],
		art: `${VILLAGE}Jewelers%20House.png`,
		blurb: 'Divers bring up pearls from the lakebed.',
	},
	{
		id: 'saltworks',
		label: 'Salt Works',
		kind: 'extractor',
		biome: 'coast',
		produces: ['salt'],
		art: `${VILLAGE}Mill%20House.png`,
		blurb: 'Evaporation pans along the shore.',
	},
	{
		id: 'junglecamp',
		label: 'Canopy Camp',
		kind: 'producer',
		biome: 'jungle',
		produces: ['wood', 'gold'],
		art: `${VILLAGE}Small%20Wooden%20Cottage.png`,
		blurb: 'Fells the jungle giants and trades their hardwood.',
	},
	{
		id: 'venompress',
		label: 'Venom Press',
		kind: 'extractor',
		biome: 'jungle',
		produces: ['venom'],
		art: `${VILLAGE}Perfumers%20House.png`,
		blurb: 'Milks vipers and presses their venom.',
	},
	{
		id: 'farmstead',
		label: 'Windmill Farmstead',
		kind: 'producer',
		biome: 'fields',
		produces: ['food', 'gold'],
		art: `${VILLAGE}Farmers%20House.png`,
		blurb: 'Turns the field patchwork into grain and coin.',
	},
	{
		id: 'dyeworks',
		label: 'Dye Works',
		kind: 'extractor',
		biome: 'fields',
		produces: ['dye'],
		art: `${VILLAGE}Painters%20House.png`,
		blurb: 'Vats of flower and root dye.',
	},
	{
		id: 'blossomyard',
		label: 'Blossom Yard',
		kind: 'producer',
		biome: 'orchard',
		produces: ['food', 'wood', 'gold'],
		art: `${VILLAGE}Florists%20House.png`,
		blurb: 'Fruit, blossom wood and a little gold.',
	},
	{
		id: 'apiary',
		label: 'Royal Apiary',
		kind: 'extractor',
		biome: 'orchard',
		produces: ['royalJelly'],
		art: `${VILLAGE}Beekeepers%20Hut.png`,
		blurb: 'Hives that make royal jelly.',
	},
	{
		id: 'rotworks',
		label: 'Rot Works',
		kind: 'producer',
		biome: 'blight',
		produces: ['coal', 'gold'],
		art: `${VILLAGE}Abandoned%20House.png`,
		blurb: 'Burns what the Blight leaves behind.',
	},
	{
		id: 'coresiphon',
		label: 'Core Siphon',
		kind: 'extractor',
		biome: 'blight',
		produces: ['corruptedCore'],
		art: `${VILLAGE}Abandoned%20Tower.png`,
		blurb: 'Draws corrupted cores out of the black ground.',
	},
	{
		id: 'warcamp',
		label: 'War Camp',
		kind: 'producer',
		biome: 'battlefield',
		produces: ['stone', 'wood'],
		art: `${VILLAGE}Guard%20House.png`,
		blurb: 'Salvages stone and timber from the old lines.',
	},
	{
		id: 'scrapforge',
		label: 'Scrap Forge',
		kind: 'extractor',
		biome: 'battlefield',
		produces: ['scrapSteel'],
		art: `${VILLAGE}Blacksmith%20House.png`,
		blurb: 'Melts down the battlefield scrap.',
	},
	// the general buildings: stand on any land biome (not the lake or the castle), make nothing, and each level of each copy adds a small bonus (`GENERAL_RULES`)
	{
		id: 'watchtower',
		label: 'Watchtower',
		kind: 'general',
		biome: GENERAL_BIOME,
		produces: [],
		art: `${VILLAGE}Observatory.png`,
		blurb: 'A lookout that keeps the hero sharp.',
		effect: 'damage',
		effectText: 'damage',
		copies: 3,
	},
	{
		id: 'marketplace',
		label: 'Marketplace',
		kind: 'general',
		biome: GENERAL_BIOME,
		produces: [],
		art: `${VILLAGE}General%20Store.png`,
		blurb: 'Stalls that pay more for what you sell.',
		effect: 'merchantSell',
		effectText: 'gold from selling to the merchant',
		copies: 3,
	},
	{
		id: 'trainingyard',
		label: 'Training Yard',
		kind: 'general',
		biome: GENERAL_BIOME,
		produces: [],
		art: `${VILLAGE}School%20House.png`,
		blurb: 'Drills that teach the hero faster.',
		effect: 'xpGain',
		effectText: 'XP gain',
		copies: 2,
	},
	{
		id: 'scriptorium',
		label: 'Scriptorium',
		kind: 'general',
		biome: GENERAL_BIOME,
		produces: [],
		art: `${VILLAGE}Scribes%20House.png`,
		blurb: 'Recipes copied and improved by the crafters.',
		effect: 'craftXp',
		effectText: 'crafting XP',
		copies: 2,
	},
	{
		id: 'guildhall',
		label: 'Guild Hall',
		kind: 'general',
		biome: GENERAL_BIOME,
		produces: [],
		art: `${VILLAGE}Adventurers%20Guild.png`,
		blurb: 'Bounties on every monster you slay.',
		effect: 'killRewards',
		effectText: 'gold and XP from a kill',
		copies: 2,
	},
	{
		id: 'garrison',
		label: 'Garrison',
		kind: 'general',
		biome: GENERAL_BIOME,
		produces: [],
		art: `${VILLAGE}Stone%20Village%20House.png`,
		blurb: 'Barracks that harden the hero.',
		effect: 'hpArmor',
		effectText: 'max HP and armor',
		copies: 2,
	},
	// the Idols (catalog/idols.ts): one per biome, they make nothing, their level is a bonus
	...IDOLS.map((i): BuildingDef => ({ id: i.id, label: i.label, kind: 'idol', biome: i.biome, produces: [], art: i.art, blurb: i.blurb })),
];

const BY_ID = new Map(BUILDINGS.map((b) => [b.id, b]));

/** The building type with this id, or undefined. */
export const buildingDef = (id: string | undefined): BuildingDef | undefined => (id === undefined ? undefined : BY_ID.get(id));

/** The buildings a tile of this biome can carry (the build menu of that tile). */
const KIND_ORDER: Record<BuildingDef['kind'], number> = { producer: 0, extractor: 1, idol: 2, general: 3 };
export const buildingsOfBiome = (biome: string): BuildingDef[] =>
	BUILDINGS.filter((b) => fitsBiome(b, biome)).sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
