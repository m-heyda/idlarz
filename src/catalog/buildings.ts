import type { Resources } from '@/types/game';

/** Where the first-pass building art lives: the supplied "Tiny Top-Down Village" pack (80x80), named in the asset library as `building_village_<file>`. */
const VILLAGE = '/pixel/assets_to_assess_and_use/more_buildings/';

/** One building type. `art` is a public URL: real art for a building is a file swap of that one path (IDL-99). */
export interface BuildingDef {
	id: string;
	label: string;
	/** What it is: `producer` (the biome's own materials) or `extractor` (its T3 material); Idols follow (IDL-96). */
	kind: 'producer' | 'extractor';
	/** The one biome whose tiles it can stand on, and whose size it feeds on */
	biome: string;
	/** The resources it makes: for a Producer the keys the biome's tiles make (so it multiplies what the land already gives), for an Extractor its one T3 material */
	produces: (keyof Resources)[];
	/** The picture on the map and in the menu */
	art: string;
	blurb: string;
}

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
];

const BY_ID = new Map(BUILDINGS.map((b) => [b.id, b]));

/** The building type with this id, or undefined. */
export const buildingDef = (id: string | undefined): BuildingDef | undefined => (id === undefined ? undefined : BY_ID.get(id));

/** The buildings a tile of this biome can carry (the build menu of that tile). */
export const buildingsOfBiome = (biome: string): BuildingDef[] => BUILDINGS.filter((b) => b.biome === biome);
