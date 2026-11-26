import { MONSTERS, RETIRED_MONSTERS } from '@/config/combatConfig';
import { META, MORE_LORE } from './monsterMeta';
import type { BiomeType } from '@/types/game';

/**
 * The monster roster: who lives in which biome and where their art is. Names and prompts: docs/plan/monster-art-prompts.md.
 *
 * This is a roster, not a balance sheet. It carries no stats, rewards or loot. A monster spawns when it has an entry in `MONSTERS`
 * (config/combatConfig.ts) under the same id (`enabled` follows that), which is where stats, spawn window and loot go. The rats are gone:
 * the seven home biomes (plains, forest, hills, coast, swamp, lake, tundra) and the five rebirth biomes have three monsters and a boss each (the home swamp and tundra got a fourth, the blight has a fourth elite one) (docs/plan/20-monster-families-and-rewards.md). On-map size of the art: `config/monsterArtSize.ts` (tuned in /map-lab, used by `MonsterSprite` for real game monsters too).
 */

/** Biomes planned in docs/plan/12-rebirth-biomes.md that are not in `BIOMES` yet (unlocked by rebirth). */
export type PlannedBiome = 'jungle' | 'fields' | 'orchard' | 'blight' | 'battlefield';
export type CatalogBiome = BiomeType | PlannedBiome;

/** What a monster is, for the Bestiary filters and the "+x% against beasts" mastery bonuses (IDL-336). One family per monster. */
export const MONSTER_FAMILIES = [
	'Beast',
	'Bird',
	'Vermin',
	'Aquatic',
	'Undead',
	'Plant',
	'Fungus',
	'Demon',
	'Construct',
	'Humanoid',
	'Elemental',
	'Dragon',
] as const;
export type MonsterFamily = (typeof MONSTER_FAMILIES)[number];

/** Short traits shown as chips on a Bestiary entry (flavour and filters; no rule hangs on them yet) */
export type MonsterTag = 'Pack' | 'Poison' | 'Magic' | 'Armored' | 'Fast' | 'Night' | 'Fire' | 'Frost' | 'Water' | 'Elite' | 'Boss' | 'Passive';

export interface MonsterCatalogEntry {
	/** Same key as in `MONSTERS` once the monster is enabled (camelCase, like `bossGreatAuroch`) */
	id: string;
	label: string;
	grade: 'normal' | 'boss';
	/** Where it lives; the spawn rule (distance, rebirths) stays in `MONSTERS[id].spawn` */
	biomes: readonly CatalogBiome[];
	/** What kind of monster it is (Beast, Undead ...): the Bestiary's filter and the family bonuses of mastery, see {@link META} */
	family: MonsterFamily;
	/** Up to three traits, shown as chips in the Bestiary */
	tags: readonly MonsterTag[];
	/** One or two lines of lore for the Bestiary entry, see {@link LORE} (every enabled monster has one) */
	lore?: string;
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

/** The one stand-in picture (`public/pixel/enemies/placeholder/silhouette.png`, a black blob silhouette with a red eye) shown until a monster's real sprite is made */
const PLACEHOLDER = '/pixel/enemies/placeholder/silhouette.png';

type RosterRow = Omit<MonsterCatalogEntry, 'family' | 'tags' | 'lore'>;

const normal = (id: string, label: string, biome: CatalogBiome, art: boolean, placeholder?: string): RosterRow => ({
	id,
	label,
	grade: 'normal',
	biomes: [biome],
	enabled: id in MONSTERS && !RETIRED_MONSTERS.has(id),
	art,
	...(placeholder ? { placeholder } : {}),
});
const boss = (id: string, label: string, biome: CatalogBiome, art: boolean, placeholder?: string): RosterRow => ({
	id,
	label,
	grade: 'boss',
	biomes: [biome],
	enabled: id in MONSTERS && !RETIRED_MONSTERS.has(id),
	art,
	...(placeholder ? { placeholder } : {}),
});

const ROSTER: readonly RosterRow[] = [
	normal('thistleBoar', 'Thistle Boar', 'plains', true),
	normal('burrowBadger', 'Burrow Badger', 'plains', true),
	normal('dustStrider', 'Dust Strider', 'plains', true),
	normal('gravelQuail', 'Gravel Quail', 'plains', false, PLACEHOLDER),
	normal('stonehornBison', 'Stonehorn Bison', 'plains', false, PLACEHOLDER),
	boss('bossGreatAuroch', 'The Great Auroch', 'plains', true),

	normal('mossbackWolf', 'Mossback Wolf', 'forest', true),
	normal('brambleImp', 'Bramble Imp', 'forest', true),
	normal('rotcapStag', 'Rotcap Stag', 'forest', true),
	normal('emberSquirrel', 'Ember Squirrel', 'forest', false, PLACEHOLDER),
	normal('pineconeWarden', 'Pinecone Warden', 'forest', true),
	boss('bossElderStag', 'The Elder Stag', 'forest', true),

	// the first four were stand-ins (retired, see `RETIRED_MONSTERS`); the roster below has the real art
	normal('graniteRam', 'Granite Ram', 'hills', false, PLACEHOLDER),
	normal('caveGoblinMiner', 'Cave Goblin Miner', 'hills', false, PLACEHOLDER),
	normal('boulderBeetle', 'Boulder Beetle', 'hills', false, PLACEHOLDER),
	boss('bossHillGiant', 'The Hill Giant', 'hills', false, PLACEHOLDER),
	// retired (2026-11-18): the knight's picture was the Cinder Warlord's; both stay in the code for old saves
	normal('magmaKnight', 'Magma Knight', 'hills', false, PLACEHOLDER),
	normal('magmaCrab', 'Magma Crab', 'hills', false, PLACEHOLDER),
	normal('mawhornBrute', 'Mawhorn Brute', 'hills', true),
	normal('quarryDrake', 'Quarry Drake', 'hills', false, PLACEHOLDER),
	normal('cairnSentinel', 'Cairn Sentinel', 'hills', true),
	normal('quarryRatKnight', 'Quarry Rat Knight', 'hills', true),
	normal('highlandGnoll', 'Highland Gnoll', 'hills', false, PLACEHOLDER),
	boss('bossIronhorn', 'The Ironhorn', 'hills', true),

	// a duplicate of the Mawhorn Brute's look: retired, the Toxic Zombie takes its place
	normal('garbageOgre', 'Garbage Ogre', 'swamp', false, PLACEHOLDER),
	normal('toxicZombie', 'Toxic Zombie', 'swamp', true),
	normal('dumpback', 'Dumpback', 'swamp', true),
	normal('rotHeron', 'Rot Heron', 'swamp', true),
	normal('scrapGolem', 'Scrap Golem', 'swamp', true),
	// the id stays (ids are append-only); the picture is a sludge cyclops, so it is named for what it looks like
	normal('bogfireWisp', 'Sludge Cyclops', 'swamp', true),
	boss('bossMireMatriarch', 'The Mire Matriarch', 'swamp', true),

	normal('frostHare', 'Frost Hare', 'tundra', true),
	normal('icetuskCalf', 'Icetusk Calf', 'tundra', true),
	normal('rimeWraith', 'Rime Wraith', 'tundra', true),
	normal('frostMoth', 'Frost Moth', 'tundra', true),
	normal('glacierYeti', 'Glacier Yeti', 'tundra', false, PLACEHOLDER),
	boss('bossWinterWyrm', 'The Winter Wyrm', 'tundra', true),

	// Water biomes (IDL-58): monsters stand on coast and lake tiles themselves
	normal('wreckCrab', 'Wreck Crab', 'coast', true),
	normal('netGull', 'Net Gull', 'coast', true),
	normal('drownedSailor', 'Drowned Sailor', 'coast', true),
	normal('tideglassJelly', 'Tideglass Jelly', 'coast', false, PLACEHOLDER),
	normal('barnacleBrute', 'Barnacle Brute', 'coast', false, PLACEHOLDER),
	boss('bossReefLeviathan', 'The Reef Leviathan', 'coast', true),

	normal('mossSnapper', 'Moss Snapper', 'lake', true),
	normal('reedNymph', 'Reed Nymph', 'lake', true),
	normal('pikeLurker', 'Pike Lurker', 'lake', false, PLACEHOLDER),
	normal('tidepoolGolem', 'Tidepool Golem', 'lake', true),
	normal('siltEel', 'Silt Eel', 'lake', false, PLACEHOLDER),
	normal('lilypadWarden', 'Lilypad Warden', 'lake', false, PLACEHOLDER),
	boss('bossLakeHydra', 'The Lake Hydra', 'lake', true),

	// Rebirth biomes (`BIOME_RULES.unlockAfterRebirths`): all five rosters are live. The jungle monsters take the names of the supplied sprites (owner decision 2026-11-10)
	normal('skullVine', 'Skull Vine', 'jungle', true),
	normal('eyeHorror', 'Eye Horror', 'jungle', true),
	normal('zombieTriceratops', 'Zombie Triceratops', 'jungle', true),
	normal('vinewhipPanther', 'Vinewhip Panther', 'jungle', false, PLACEHOLDER),
	normal('mossbackIdol', 'Mossback Idol', 'jungle', false, PLACEHOLDER),
	boss('bossHardwoodColossus', 'The Hardwood Colossus', 'jungle', false, PLACEHOLDER),
	boss('bossBrainstorm', 'The Brainstorm', 'jungle', true),

	// the rebirth biomes: fields 2, orchard 3, blight 4, battlefield 5; each roster takes the names of the supplied sprites (owner decision 2026-11-16) and is a step harder than the biome before (BIOME_TIER)
	normal('barnGargoyle', 'Barn Gargoyle', 'fields', true),
	normal('bucketKnight', 'Bucket Knight', 'fields', true),
	normal('hedgeBandit', 'Hedge Bandit', 'fields', true),
	normal('crowMarshal', 'Crow Marshal', 'fields', false, PLACEHOLDER),
	normal('millstoneGolem', 'Millstone Golem', 'fields', true),
	boss('bossHarvestMatron', 'The Harvest Matron', 'fields', true),

	normal('greenscaleWarden', 'Greenscale Warden', 'orchard', true),
	normal('blossomRonin', 'Blossom Ronin', 'orchard', true),
	normal('grayGleaner', 'Gray Gleaner', 'orchard', true),
	normal('mushroomWizard', 'Mushroom Wizard', 'orchard', true),
	normal('rootboundGardener', 'Rootbound Gardener', 'orchard', false, PLACEHOLDER),
	boss('bossBlossomReaper', 'The Blossom Reaper', 'orchard', true),

	normal('gasketGoblin', 'Gasket Goblin', 'blight', true),
	// retired: its picture was the Toxic Zombie's
	normal('blightedHusk', 'Blighted Husk', 'blight', false, PLACEHOLDER),
	normal('mothwingHexer', 'Mothwing Hexer', 'blight', true),
	normal('gloomCerberus', 'Gloom Cerberus', 'blight', true),
	normal('sporebackOgre', 'Sporeback Ogre', 'blight', true),
	normal('sporeHound', 'Spore Hound', 'blight', false, PLACEHOLDER),
	boss('bossEyedMaw', 'The Eyed Maw', 'blight', true),

	normal('boneCleaver', 'Bone Cleaver', 'battlefield', true),
	normal('frostguardKnight', 'Frostguard Knight', 'battlefield', true),
	normal('gildedChampion', 'Gilded Champion', 'battlefield', true),
	normal('bannerWraith', 'Banner Wraith', 'battlefield', false, PLACEHOLDER),
	normal('frostFlameKnight', 'Frost-Flame Knight', 'battlefield', true),
	boss('bossCinderWarlord', 'The Cinder Warlord', 'battlefield', true),
];

/**
 * The lore of the monsters added with the rebirth biomes (and two more for the swamp and tundra), one or two lines each. Names follow the pictures; the Bestiary will read these.
 * The story the rebirth biomes tell: every rebirth the realm grows a new land beyond the old border, and each land holds what the old world left unfinished.
 */
export const LORE: Readonly<Record<string, string>> = {
	// hills (2026-11-18): the high country above the farms, where the road climbs into the rock and the old quarries still smoke
	magmaKnight:
		'A dwarven forge-guard who walked into the quarry fire and kept walking. The armour glows where the sword touches it, and he still salutes the road.',
	magmaCrab: 'The deep quarry runs hot enough to cook stone, and something with a shell learned to live in it. It surfaces after rain, still steaming.',
	mawhornBrute:
		'Something deep in the quarry went wrong a long time ago and came up with three eyes, two horns and a hunger that drips. The miners seal the shaft every spring and every spring it is open again.',
	bossIronhorn:
		'The dwarves built it to hold the mountain pass and then left in a hurry. It is still holding it, and steam still leaks from the joints they never finished.',
	toxicZombie: 'The swamp took the clean-up crews first. The orange suits are still sealed; whoever is inside still thinks the shift is not over.',
	// lake
	tidepoolGolem:
		'The reeds hold more than water. Years of silt and lamp-lit eyes gathered into something that walks, and it still glows where the algae grows through it.',
	// jungle
	bossBrainstorm:
		'A mushroom that grew a brain, or a brain that grew a mushroom: the jungle will not say which. Its spores carry thoughts from cap to cap, and what it knows, the whole jungle knows.',
	scrapGolem:
		'The swamp swallows what the realm throws away. Enough of it, rusted together, learned to walk, and it still carries one green eye from the lamp it used to be.',
	frostMoth: 'It drifts over the snow in silence, drawn to the warmth of anything alive. Where it lands, frost follows.',
	barnGargoyle: 'Carved to sit on a granary roof and frighten crows, it woke in the first harvest after the rebirth. It still guards the wheat, from everyone.',
	bucketKnight: 'The old scarecrow militia never stood down. Their helmets are buckets, their spears are hay forks, and they have not lost a field yet.',
	hedgeBandit: 'A cutpurse who learned that the tall wheat hides a knife better than any alley. He takes the harvest first and asks nothing after.',
	bossHarvestMatron:
		'The hen that laid the first egg of the new land grew with the wheat. She wears a scarf knitted by a farmer long gone, and counts every egg in the valley as hers.',
	greenscaleWarden:
		'The orchard dragonkin keep the bees and the fruit, and they are not sharing. A warden walks the rows with an axe for thieves and a shield for the rest.',
	blossomRonin: 'He wandered in from some other realm with a straw hat and two swords, and stayed because the petals fall exactly the way he likes to cut.',
	grayGleaner:
		'Gleaners took what the harvest left behind. This one took the pickers too, and now it walks the rows between the trees with an empty basket and a long, curved blade.',
	bossBlossomReaper: 'Everything that blooms must fall. The Reaper keeps the count in blue fire and has never once been early or late.',
	gasketGoblin: 'A tinkerer who fixed one leaking pipe too many. The Blight got into his goggles and he sees nothing now but things to take apart.',
	blightedHusk: 'The hazard suit was supposed to keep the Blight out. It kept it in, and whoever was inside is still walking around in it.',
	mothwingHexer: 'Moths love a lamp, and the Blight is the brightest thing in the dark. The hexer wears their wings and speaks in their dust.',
	gloomCerberus: 'Three heads, one hunger, and each head thinks the other two are the prey. Nothing the Blight made is harder to calm down.',
	bossEyedMaw: 'The Blight has a centre, and the centre has eyes. It does not hate the realm; it only wants to know it, one eye at a time.',
	boneCleaver: "A soldier with a butcher's blade and no flesh left to tire him. Nobody told him the war ended, and the bones are not listening.",
	frostguardKnight: 'The northern guard marched south to the last battle and froze where they stood. The ice melted from the armour; the oath did not.',
	gildedChampion: 'He won the great tournament before the war and was buried in his prizes. The gold kept shining, and so did the sword.',
	bossCinderWarlord: 'The warlord burned every banner on the field, then his own. What stands in the ash now is armour with a cleaver and a very long memory.',
};

export const MONSTER_CATALOG: readonly MonsterCatalogEntry[] = ROSTER.map((m) => {
	const meta = META[m.id] ?? { family: 'Beast' as const, tags: [] };
	const lore = LORE[m.id] ?? MORE_LORE[m.id];
	return { ...m, family: meta.family, tags: meta.tags, ...(lore ? { lore } : {}) };
});

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
