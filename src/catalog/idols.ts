/** Where the Idol statues live: the 64x64 pictures the owner supplied (public/pixel/new_assets/idols/README.md maps each biome to its primary picture). One `art` field per Idol: real art is a file swap. */
const ART = '/pixel/new_assets/idols/';

/** What an Idol changes. `applied: false` effects are in the catalog and the UI ("coming soon") but not applied by the game yet (the client-only ones: farm output, click gold, merchant sell price). */
export type IdolEffectKey =
	| 'farmOutput'
	| 'xpGain'
	| 'buildTime'
	| 'luck'
	| 'offlineEfficiency'
	| 'chestSpeed'
	| 'merchantSell'
	| 'killRewards'
	| 'clickGold'
	| 'craftXp'
	| 'damage'
	| 'hpArmor';

export interface IdolDef {
	/** Also the building id on the tile (`Tile.building`) */
	id: string;
	label: string;
	biome: string;
	effect: IdolEffectKey;
	/** The text after the number: "+6 % XP gain" reads `${value} ${effectText}` */
	effectText: string;
	/** True when the game applies the effect today; false = shown as "coming soon" */
	applied: boolean;
	art: string;
	blurb: string;
}

/**
 * The twelve Idols, one per biome (docs/plan/18-biome-buildings-and-material-tiers.md section 3): a permanent bonus of +2 % per level (Luck in points), one effect each, so nothing is stacked twice.
 * An Idol's level is kept across rebirths (the building is not): see {@link IDOL_RULES}. The server applies XP gain, kill rewards, offline efficiency, Luck, chest speed, crafting XP, damage and max HP and armor;
 * the build-time effect shortens the castle and building timers in the browser; farm output, click gold and the merchant's sell price are catalog-only for now.
 *
 * @category Economy/Buildings
 * @order 6
 * @table idol-catalog
 */
export const IDOLS: readonly IdolDef[] = [
	{
		id: 'idol_plains',
		label: 'Harvest Scarecrow',
		biome: 'plains',
		effect: 'farmOutput',
		effectText: 'farm animal output',
		applied: false,
		art: `${ART}idol_plains_wind_stones.png`,
		blurb: 'Blesses the farm with a richer yield.',
	},
	{
		id: 'idol_forest',
		label: 'Elder Tree Statue',
		biome: 'forest',
		effect: 'xpGain',
		effectText: 'XP gain',
		applied: true,
		art: `${ART}idol_forest_elder_tree.png`,
		blurb: 'The old tree remembers every lesson.',
	},
	{
		id: 'idol_hills',
		label: 'Dwarf Statue',
		biome: 'hills',
		effect: 'buildTime',
		effectText: 'faster castle and building timers',
		applied: true,
		art: `${ART}idol_hills_ram_statue.png`,
		blurb: 'Dwarven craft shortens every build.',
	},
	{
		id: 'idol_swamp',
		label: 'Bog Witch Totem',
		biome: 'swamp',
		effect: 'luck',
		effectText: 'Luck',
		applied: true,
		art: `${ART}idol_swamp_witch_tree.png`,
		blurb: 'The witch smiles on the lucky.',
	},
	{
		id: 'idol_tundra',
		label: 'Frost Obelisk',
		biome: 'tundra',
		effect: 'offlineEfficiency',
		effectText: 'income while away',
		applied: true,
		art: `${ART}idol_tundra_frost_totem.png`,
		blurb: 'Keeps the realm working while you sleep.',
	},
	{
		id: 'idol_lake',
		label: 'Water Spirit Fountain',
		biome: 'lake',
		effect: 'chestSpeed',
		effectText: 'chest speed',
		applied: true,
		art: `${ART}idol_lake_eye_obelisk.png`,
		blurb: 'The spirit sends treasure to the shore.',
	},
	{
		id: 'idol_coast',
		label: 'Lighthouse',
		biome: 'coast',
		effect: 'merchantSell',
		effectText: 'merchant sell price',
		applied: false,
		art: `${ART}idol_coast_lighthouse.png`,
		blurb: 'Guides richer ships to the merchant.',
	},
	{
		id: 'idol_jungle',
		label: 'Totem of the Wild',
		biome: 'jungle',
		effect: 'killRewards',
		effectText: 'kill rewards',
		applied: true,
		art: `${ART}idol_jungle_totem_of_the_wild.png`,
		blurb: 'The hunt pays more.',
	},
	{
		id: 'idol_fields',
		label: 'Scarecrow King',
		biome: 'fields',
		effect: 'clickGold',
		effectText: 'gold per click',
		applied: false,
		art: `${ART}idol_fields_sun_statue.png`,
		blurb: 'Every tap on the map shines brighter.',
	},
	{
		id: 'idol_orchard',
		label: 'Blossom Shrine',
		biome: 'orchard',
		effect: 'craftXp',
		effectText: 'crafting XP',
		applied: true,
		art: `${ART}idol_orchard_blossom_shrine.png`,
		blurb: 'Skilled hands learn faster here.',
	},
	{
		id: 'idol_blight',
		label: 'Maw Idol',
		biome: 'blight',
		effect: 'damage',
		effectText: 'damage',
		applied: true,
		art: `${ART}idol_blight_maw_crystal.png`,
		blurb: 'The maw hungers through your blade.',
	},
	{
		id: 'idol_battlefield',
		label: 'War Memorial',
		biome: 'battlefield',
		effect: 'hpArmor',
		effectText: 'max HP and armor',
		applied: true,
		art: `${ART}idol_battlefield_war_memorial.png`,
		blurb: 'The fallen stand behind you.',
	},
];

const BY_BIOME = new Map(IDOLS.map((i) => [i.biome, i]));

/** The Idol of a biome, or undefined. */
export const idolOfBiome = (biome: string): IdolDef | undefined => BY_BIOME.get(biome);

/** The Idol with this id (= building id), or undefined. */
export const idolDef = (id: string | undefined): IdolDef | undefined => (id === undefined ? undefined : IDOLS.find((i) => i.id === id));
