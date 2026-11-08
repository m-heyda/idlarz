import { MONSTERS } from '@/config/combatConfig';
import type { BiomeType } from '@/types/game';

/**
 * The monster roster: who lives in which biome and where their art is. Names and prompts: docs/plan/monster-art-prompts.md.
 *
 * This is a roster, not a balance sheet. It carries no stats, rewards or loot. A monster spawns when it has an entry in `MONSTERS`
 * (config/combatConfig.ts) under the same id (`enabled` follows that), which is where stats, spawn window and loot go. The rats are gone:
 * plains, forest, swamp and tundra have their three monsters and a boss; the rest is art waiting for its turn (docs/plan/20-monster-families-and-rewards.md). On-map size of the art: `config/monsterArtSize.ts` (tuned in /map-lab, used by `MonsterSprite` for real game monsters too).
 */

/** Biomes planned in docs/plan/12-rebirth-biomes.md that are not in `BIOMES` yet (unlocked by rebirth). */
export type PlannedBiome = 'jungle' | 'fields' | 'orchard' | 'blight' | 'battlefield';
export type CatalogBiome = BiomeType | PlannedBiome;

export interface MonsterCatalogEntry {
	/** Same key as in `MONSTERS` once the monster is enabled (camelCase, like `bossGreatAuroch`) */
	id: string;
	label: string;
	grade: 'normal' | 'boss';
	/** Where it lives; the spawn rule (distance, rebirths) stays in `MONSTERS[id].spawn` */
	biomes: readonly CatalogBiome[];
	/** false = in the roster but never spawns */
	enabled: boolean;
	/** true when the generated picture exists at `monsterArtUrl(entry)` (the first biome in `biomes` is its folder) */
	art: boolean;
}

/** `public/pixel/enemies/<biome>/<kebab-id>.png`; bosses are `boss-<name>`. */
export const monsterArtUrl = (entry: Pick<MonsterCatalogEntry, 'id' | 'biomes'>): string => {
	const kebab = entry.id.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
	return `/pixel/enemies/${entry.biomes[0]}/${kebab}.png`;
};

const normal = (id: string, label: string, biome: CatalogBiome, art: boolean): MonsterCatalogEntry => ({
	id,
	label,
	grade: 'normal',
	biomes: [biome],
	enabled: id in MONSTERS,
	art,
});
const boss = (id: string, label: string, biome: CatalogBiome, art: boolean): MonsterCatalogEntry => ({
	id,
	label,
	grade: 'boss',
	biomes: [biome],
	enabled: id in MONSTERS,
	art,
});

export const MONSTER_CATALOG: readonly MonsterCatalogEntry[] = [
	normal('thistleBoar', 'Thistle Boar', 'plains', true),
	normal('burrowBadger', 'Burrow Badger', 'plains', true),
	normal('dustStrider', 'Dust Strider', 'plains', true),
	boss('bossGreatAuroch', 'The Great Auroch', 'plains', true),

	normal('mossbackWolf', 'Mossback Wolf', 'forest', true),
	normal('brambleImp', 'Bramble Imp', 'forest', true),
	normal('rotcapStag', 'Rotcap Stag', 'forest', true),
	boss('bossElderStag', 'The Elder Stag', 'forest', true),

	normal('graniteRam', 'Granite Ram', 'hills', false),
	normal('caveGoblinMiner', 'Cave Goblin Miner', 'hills', false),
	normal('boulderBeetle', 'Boulder Beetle', 'hills', false),
	boss('bossHillGiant', 'The Hill Giant', 'hills', false),

	normal('garbageOgre', 'Garbage Ogre', 'swamp', true),
	normal('dumpback', 'Dumpback', 'swamp', true),
	normal('rotHeron', 'Rot Heron', 'swamp', true),
	boss('bossMireMatriarch', 'The Mire Matriarch', 'swamp', true),

	normal('frostHare', 'Frost Hare', 'tundra', true),
	normal('icetuskCalf', 'Icetusk Calf', 'tundra', true),
	normal('rimeWraith', 'Rime Wraith', 'tundra', true),
	boss('bossWinterWyrm', 'The Winter Wyrm', 'tundra', true),

	// Water biomes: no monster rule allows them today (`LAND_BIOMES`), so these wait for shoreline spawns
	normal('wreckCrab', 'Wreck Crab', 'coast', true),
	normal('netGull', 'Net Gull', 'coast', true),
	normal('drownedSailor', 'Drowned Sailor', 'coast', true),
	boss('bossReefLeviathan', 'The Reef Leviathan', 'coast', true),

	normal('mossSnapper', 'Moss Snapper', 'lake', true),
	normal('reedNymph', 'Reed Nymph', 'lake', true),
	normal('pikeLurker', 'Pike Lurker', 'lake', false),
	boss('bossLakeHydra', 'The Lake Hydra', 'lake', true),

	// Rebirth biomes (docs/plan/12-rebirth-biomes.md): the biomes themselves are not built yet
	normal('shadowJaguar', 'Shadow Jaguar', 'jungle', false),
	normal('orchidSpider', 'Orchid Spider', 'jungle', false),
	normal('poisonToad', 'Poison Toad', 'jungle', false),
	boss('bossHardwoodColossus', 'The Hardwood Colossus', 'jungle', false),

	normal('murderCrow', 'Murder Crow', 'fields', false),
	normal('livingScarecrow', 'Living Scarecrow', 'fields', false),
	normal('harvestBoar', 'Harvest Boar', 'fields', false),
	boss('bossHarvestKing', 'The Harvest King', 'fields', false),

	normal('giantHornet', 'Giant Hornet', 'orchard', false),
	normal('honeyBear', 'Honey Bear', 'orchard', false),
	normal('thornDryad', 'Thorn Dryad', 'orchard', false),
	boss('bossBlossomTreant', 'The Blossom Treant', 'orchard', false),

	normal('ichorSlime', 'Ichor Slime', 'blight', false),
	normal('tendrilHorror', 'Tendril Horror', 'blight', false),
	normal('blightedHusk', 'Blighted Husk', 'blight', false),
	boss('bossBlightHeart', 'The Blight Heart', 'blight', false),

	normal('skeletonSoldier', 'Skeleton Soldier', 'battlefield', false),
	normal('siegeRemnant', 'Siege Remnant', 'battlefield', false),
	normal('warHound', 'War Hound', 'battlefield', false),
	boss('bossUndeadWarlord', 'The Undead Warlord', 'battlefield', false),
];

/** Roster entries that live in a biome. Spawning code passes `enabledOnly` so unfinished monsters never appear. */
export const monstersInBiome = (biome: CatalogBiome, enabledOnly = true): MonsterCatalogEntry[] =>
	MONSTER_CATALOG.filter((m) => m.biomes.includes(biome) && (!enabledOnly || m.enabled));
