import { MONSTERS } from '@/config/combatConfig';
import type { BiomeType } from '@/types/game';

/**
 * The monster roster: who lives in which biome and where their art is. Names and prompts: docs/plan/monster-art-prompts.md.
 *
 * This is a roster, not a balance sheet. It carries no stats, rewards or loot. A monster spawns when it has an entry in `MONSTERS`
 * (config/combatConfig.ts) under the same id (`enabled` follows that), which is where stats, spawn window and loot go. The rats are gone:
 * the seven home biomes (plains, forest, hills, coast, swamp, lake, tundra) and the jungle have their three monsters and a boss; the rest is art waiting for its turn (docs/plan/20-monster-families-and-rewards.md). On-map size of the art: `config/monsterArtSize.ts` (tuned in /map-lab, used by `MonsterSprite` for real game monsters too).
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
	/**
	 * The stand-in picture (a path under `public/`) shown while `art` is false. Getting the real art in is a file swap: put the picture at `monsterArtUrl(entry)`, set `art` to true and drop this field
	 * (`monsterSpriteUrl` then follows by itself). Nothing else reads it.
	 */
	placeholder?: string;
}

/** `public/pixel/enemies/<biome>/<kebab-id>.png`; bosses are `boss-<name>`. */
export const monsterArtUrl = (entry: Pick<MonsterCatalogEntry, 'id' | 'biomes'>): string => {
	const kebab = entry.id.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
	return `/pixel/enemies/${entry.biomes[0]}/${kebab}.png`;
};

/** The picture the game draws: the real art when it exists, else the stand-in (or the real path, which then shows nothing, for a monster that has neither). */
export const monsterSpriteUrl = (entry: Pick<MonsterCatalogEntry, 'id' | 'biomes' | 'art' | 'placeholder'>): string =>
	entry.art ? monsterArtUrl(entry) : (entry.placeholder ?? monsterArtUrl(entry));

/** Whether the game draws this monster's stand-in silhouette (no real art yet) instead of its own sprite. */
export const usesPlaceholderArt = (entry: Pick<MonsterCatalogEntry, 'art' | 'placeholder'>): boolean => !entry.art && !!entry.placeholder;

/** The one stand-in picture (`public/pixel/enemies/placeholder/silhouette.png`, a small teal slime, drawn by `scripts/pixel/placeholder_monster.py`) shown until a monster's real sprite is made */
const PLACEHOLDER = '/pixel/enemies/placeholder/silhouette.png';

const normal = (id: string, label: string, biome: CatalogBiome, art: boolean, placeholder?: string): MonsterCatalogEntry => ({
	id,
	label,
	grade: 'normal',
	biomes: [biome],
	enabled: id in MONSTERS,
	art,
	...(placeholder ? { placeholder } : {}),
});
const boss = (id: string, label: string, biome: CatalogBiome, art: boolean, placeholder?: string): MonsterCatalogEntry => ({
	id,
	label,
	grade: 'boss',
	biomes: [biome],
	enabled: id in MONSTERS,
	art,
	...(placeholder ? { placeholder } : {}),
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

	normal('graniteRam', 'Granite Ram', 'hills', false, PLACEHOLDER),
	normal('caveGoblinMiner', 'Cave Goblin Miner', 'hills', false, PLACEHOLDER),
	normal('boulderBeetle', 'Boulder Beetle', 'hills', false, PLACEHOLDER),
	boss('bossHillGiant', 'The Hill Giant', 'hills', false, PLACEHOLDER),

	normal('garbageOgre', 'Garbage Ogre', 'swamp', true),
	normal('dumpback', 'Dumpback', 'swamp', true),
	normal('rotHeron', 'Rot Heron', 'swamp', true),
	boss('bossMireMatriarch', 'The Mire Matriarch', 'swamp', true),

	normal('frostHare', 'Frost Hare', 'tundra', true),
	normal('icetuskCalf', 'Icetusk Calf', 'tundra', true),
	normal('rimeWraith', 'Rime Wraith', 'tundra', true),
	boss('bossWinterWyrm', 'The Winter Wyrm', 'tundra', true),

	// Water biomes (IDL-58): monsters stand on coast and lake tiles themselves
	normal('wreckCrab', 'Wreck Crab', 'coast', true),
	normal('netGull', 'Net Gull', 'coast', true),
	normal('drownedSailor', 'Drowned Sailor', 'coast', true),
	boss('bossReefLeviathan', 'The Reef Leviathan', 'coast', true),

	normal('mossSnapper', 'Moss Snapper', 'lake', true),
	normal('reedNymph', 'Reed Nymph', 'lake', true),
	normal('pikeLurker', 'Pike Lurker', 'lake', false, PLACEHOLDER),
	boss('bossLakeHydra', 'The Lake Hydra', 'lake', true),

	// Rebirth biomes (docs/plan/12-rebirth-biomes.md): the jungle roster is live (rebirth 1), the other four wait. The jungle monsters take the names of the supplied sprites (owner decision 2026-11-10)
	normal('skullVine', 'Skull Vine', 'jungle', true),
	normal('eyeHorror', 'Eye Horror', 'jungle', true),
	normal('zombieTriceratops', 'Zombie Triceratops', 'jungle', true),
	boss('bossHardwoodColossus', 'The Hardwood Colossus', 'jungle', false, PLACEHOLDER),

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

/**
 * The monsters the map lab can show (its spawn dropdown and combat preview): roster monsters with finished art that are not enabled yet, and once every monster with art is enabled, all of them.
 * The lab reads `[0]` of this list, so it must never be empty (an empty list crashed the `/map-lab` prerender once every monster with art was enabled).
 */
export const labMonsters = (): MonsterCatalogEntry[] => {
	const notEnabled = MONSTER_CATALOG.filter((m) => m.art && !m.enabled);
	return notEnabled.length > 0 ? notEnabled : MONSTER_CATALOG.filter((m) => m.art);
};
