import { IDOLS } from '@/catalog/idols';
import type { Resources } from '@/types/game';

/** Where the first-pass building art lives: the supplied "Tiny Top-Down Village" pack (80x80), named in the asset library as `building_village_<file>`. */
const VILLAGE = '/pixel/assets_to_assess_and_use/more_buildings/';

/** One building type. `art` is a public URL: real art for a building is a file swap of that one path (IDL-99). */
export interface BuildingDef {
	id: string;
	label: string;
	/** What it is: `producer` (the biome's own materials) `extractor` (its T3 material) or `idol` (a permanent bonus, `catalog/idols.ts`). */
	kind: 'producer' | 'extractor' | 'idol';
	/** The one biome whose tiles it can stand on, and whose size it feeds on */
	biome: string;
	/** The resources it makes: for a Producer the keys the biome's tiles make (so it multiplies what the land already gives), for an Extractor its one T3 material, for an Idol nothing */
	produces: (keyof Resources)[];
	/** The picture on the map and in the menu */
	art: string;
	blurb: string;
}

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
	saltworks: 'Shallow pans, a lazy sun and a mill that grinds the crust to white. Nothing makes a kingdom last like salt.',
};

/**
 * The Producer and the Extractor of each of the seven home biomes (docs/plan/18 section 3; the five rebirth biomes and their buildings follow with IDL-99). Each makes the resources listed in `produces` at `BUILDING_RULES.producer.tileEquivalents`
 * tiles' worth, so the land under it decides what it is good at. The sprite is first-pass art from the village pack, one `art` field per building.
 *
 * @category Economy/Buildings
 * @order 3
 * @table building-catalog
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
	// the Idols (catalog/idols.ts): one per biome, they make nothing, their level is a bonus
	...IDOLS.map((i): BuildingDef => ({ id: i.id, label: i.label, kind: 'idol', biome: i.biome, produces: [], art: i.art, blurb: i.blurb })),
];

const BY_ID = new Map(BUILDINGS.map((b) => [b.id, b]));

/** The building type with this id, or undefined. */
export const buildingDef = (id: string | undefined): BuildingDef | undefined => (id === undefined ? undefined : BY_ID.get(id));

/** The buildings a tile of this biome can carry (the build menu of that tile). */
export const buildingsOfBiome = (biome: string): BuildingDef[] => BUILDINGS.filter((b) => b.biome === biome);
