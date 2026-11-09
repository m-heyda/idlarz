import { monsterSourceId } from '@/catalog/lootConfig';
import { LIMITS } from '@/config/limits';
import type { BiomeType } from '@/types/game';

// Combat tunables. Every number the fight, the monsters and the loot depend on lives here.
// SERVER-OWNED: the server rolls spawns, places monsters and runs every fight from these numbers; the browser only shows them.

/**
 * Combat tunables. Fights run on the server; the browser only asks for a fight and draws the answer. Everything a fight needs is frozen into a `PlayerProfile` when the fight starts
 * ({@link playerProfile}, built from the last accepted save and the ledger's gear).
 *
 * Where things live: this config (`COMBAT`, `STAT_RULES`), the pure rules in `src/lib/combat.ts`, the engine in `src/lib/offline/fight*.ts`, the win estimate in `src/lib/offline/winChance.ts`,
 * skills in `src/catalog/skills.ts` and `src/lib/skills.ts`. Monsters and their numbers: {@link MONSTERS}. Drops: {@link generateLoot}.
 *
 * @title Combat overview and tunables
 * @category Combat/Overview
 * @order 1
 * @see maxHp, runCombat, estimateWin, MONSTERS
 */
export const COMBAT = {
	baseHp: 85, // max HP = baseHp + vitality-derived hp + gear maxHp (about 100 at game start)
	regenPerSec: 1, // HP per second while no fight is open
	maxDodge: 40, // % cap on the gear's Dodge, so a monster's hit can never be avoided every time
	knockoutHpFraction: 0.3, // HP restored (as a share of max) after a knockout
	armorK: 40, // raw mitigation = armor / (armor + armorK); armorReduction() in lib/combat.ts then bends it past armorSoftCap
	// Past this share of damage taken away every further armor point is worth only `armorSoftSlope` of what it was, so armor
	// tops out at softCap + (1 - softCap) x softSlope = 75 % and the rest of the survival has to come from HP, regen, dodge and Stun.
	armorSoftCap: 0.5,
	armorSoftSlope: 0.5,
	maxItemDamage: 200, // sanity ceiling for one item's damage (tests/loot/items.test.ts); fights are balanced by tests/combat/fightBalance.test.ts, not by a cap
	// Fights run on the server in fixed ticks: the player swings at the weapon's attack speed, a monster at its own. Nobody clicks to hit: a click on a monster only starts the fight.
	tickSec: 0.1, // the server's fight step
	maxCatchUpSec: 120, // one request runs a fight forward by at most this long (a longer silence is simulated by the next request)
	maxFightSec: 180, // a fight that has not been decided by now is called off (the monster stays, no reward)
	poll: {
		fightSec: 2, // a fight the server could not run to its end (it is `behind`) is asked about this often with the panel open...
		minimizedSec: 8, // ...the minimized icon (or a hidden tab) this often
		afterEndSec: 0.4, // a fight the server ran to its end (`CombatView.plan`) is asked about this long after the end it projected
	},
	// What the server does for a player in a fight, and when it starts one. Fixed on purpose: players only switch auto-battle and auto-use on or off.
	auto: {
		minRebirths: 1, // auto-battle is locked until the player has rebirthed this many times (clicking a monster to fight it never is)
		resumeHpPct: 80, // auto-battle only starts a fight with HP at this share of max or more (after a knockout it rests up to it)
		pauseAfterDefeats: 3, // auto-battle stays on after a defeat and switches itself off after this many defeats in a row (one win resets the count)
		safeWinChance: 0.8, // the Next strip calls a monster Safe from this win chance up, Risky from minWinChance up, Unlikely below it
		minWinChance: 0.5, // ...and only against a monster it expects to beat at least as often as lose to (offline/winChance.ts); a click on a monster fights it anyway
		engageOrder: 'weakest' as 'weakest' | 'oldest', // which waiting monster is next: the lowest level first (an unbeatable one never blocks the easy ones), or the one that came first
		retryCooldownSec: 300, // a monster that beat you (or ran out the clock) is not tried again for this long...
		bossRetryCooldownSec: 600, // ...a boss for this long
		potionBelowHpPct: 40, // auto-use drinks the best-fitting potion below this share of max HP
		healBelowHpPct: 50, // ...and casts Heal below this share
		stunWhenReady: true, // ...and casts Stun whenever it can
	},
	crit: {
		mult: 2, // a crit deals this many times the damage
		superMult: 5, // a super crit (rolled only when a hit already crit)
		superBase: 5, // % chance for a crit to become a super crit, before gear
		maxCritChance: 75, // % caps, so stacked gear cannot make every hit a crit
		maxSuperChance: 50,
	},
	bagSize: LIMITS.bagSize, // base bag slots; read the current size through limitOf('bagSize', ctx) (Pack Rat and later effects add to it)
	potionCooldownSec: 8, // shared cooldown between potions inside a fight
	victoryToastSec: 15, // how long the result of a fight (the dead monster and its loot) stays in the combat window (hover pauses it)
	spawn: {
		firstSec: 120, // first monster this long after the game starts (lib/offline/tickets.ts counts it on the server)
		intervalSec: 900, // then one per this long (chests: 600 s)
		bossIntervalSec: 10800, // a boss (one at a time) appears this long after the last one left, or after the start
		dangerStep: 8, // a monster that appears this many tiles (Chebyshev) further from the castle spawns one level higher: the frontier is more dangerous than the home land
	},
	// What drops (how often, which rarity and item level) is loot config: src/catalog/lootConfig.ts
	// A kill pays seconds of income: gold and XP as `rewardSec` x the rate, hide as that x `hideShare` (hide only comes from the farm, so
	// a rat's pelts are a share of it: they help with the hide the big territories cost, see TILE_RESOURCE_COST)
	rewards: { minGold: 10, minXp: 5, hideShare: 0.6 },
};

/**
 * How the five attributes feed combat (read through lib/statBonuses.ts). Every attribute starts at `base`; bonuses count the
 * points ABOVE it, so a new character plays exactly like one with no stat bonuses and every point spent is a real step up.
 */
export const STAT_RULES = {
	base: 5,
	physicalDamagePerStrength: 2, // % damage with physical weapons per point above base
	magicDamagePerIntelligence: 2.4, // % damage with magic weapons: 1.2x the physical rate, so magic is worth going into
	armorPerDexterity: 0.5, // armor added to the gear's per point above base
	armorPerVitality: 0.5,
	armorPerStrength: 0.25,
	critDamagePerPoint: { strength: 1, dexterity: 0.5, charisma: 0.5 }, // % extra on the x2 crit and x5 super crit multipliers
	atkSpeedPerDexterity: 0.25, // % attack speed (fights run on it)
	mana: { base: 20, perIntelligence: 4, regenBase: 0.5, regenPerIntelligence: 0.05 }, // max mana and mana per second
	magicWeaponTypes: ['staff', 'wand'] as readonly string[], // these scale with Intelligence, every other weapon with Strength
	lifeLeechCap: 15, // % of the damage dealt returned as HP: the gear's Life Leech never counts above this
};

/** `boss` monsters get their own spawn timer, a banner in the fight and boss-only drops (the loot source `lootSourceId` names the profile). */
export type MonsterGrade = 'normal' | 'boss';

/** The tiles a monster may stand on. A tile qualifies when its biome is listed and its castle distance lies within the range. */
export interface MonsterSpawnRule {
	/** Allowlist of biomes: a biome that is not listed (water, the castle, anything added later) never gets this monster */
	biomes: readonly BiomeType[];
	minCastleDistance: number;
	maxCastleDistance: number;
	/** For monsters that only come after this many rebirths (biomes and monsters unlocked by rebirth are planned) */
	minRebirths?: number;
}

/**
 * The biomes that have a monster roster today (art in public/pixel/enemies, see catalog/monsters.ts). Hills has no art yet, water has no
 * shoreline spawns: nothing stands there until they do.
 */
type MonsterBiome = 'plains' | 'forest' | 'swamp' | 'tundra';

export interface RewardPart {
	rewardSec: number;
	cap: number;
}
export interface MonsterReward {
	gold: RewardPart;
	xp: RewardPart;
	/** Per monster level above `refLevel` */
	levelMult: number;
}

/**
 * A kind of monster. The numbers are for `refLevel`; other levels follow `scaling`: `exp` multiplies by the `*PerLevel` factors for
 * every level away from `refLevel`, `gear` follows the item level curve (`levelScale`), so a boss keeps pace with the gear that drops
 * at his level. Armor is additive per level. `spawnWindow` says at which levels a new one appears: it starts at `base`, rises
 * `perCastleLevel` per castle level above 1 and spans `spread` levels, never above `cap` (a monster's `cap` is the highest level it
 * can spawn at; it then grows up to `limitOf('monsterGrowthLevels')` more).
 */
export interface MonsterDef {
	grade: MonsterGrade;
	label: string;
	hp: number;
	attack: number;
	/** Reduces the damage of every hit like a player's armor does (armor / (armor + armorK)) */
	armor: number;
	/** % chance that one of its hits is a crit, and the multiplier of that crit */
	critChance: number;
	critMult: number;
	/** % chance that Stun does not work on it (the mana and the cooldown are still spent) */
	stunResist: number;
	/** Attacks per second (the same unit as a weapon's `attackSpeed`) */
	attackSpeed: number;
	/** Where it may appear. Distances are in tiles (Chebyshev) from the castle: a minimum of 2 keeps it off the castle's neighbours. */
	spawn: MonsterSpawnRule;
	/**
	 * What a kill pays (docs/plan/20-monster-families-and-rewards.md section 3): gold and XP are `min(rewardSec x income per second, cap) x levelMult^(level - refLevel)`, then the
	 * player's Luck, Gold Find and Kill Rewards % on top (lib/loot/kill.ts). Early the income is small, so `rewardSec` decides; later the
	 * absolute `cap` does, so a weak monster stops mattering. `cap` is in gold / XP at `refLevel`.
	 */
	reward: MonsterReward;
	refLevel: number;
	scaling: 'exp' | 'gear';
	hpPerLevel: number;
	attackPerLevel: number;
	armorPerLevel: number;
	spawnWindow: { base: number; perCastleLevel: number; spread: number; cap: number };
	/** Key into LOOT_SOURCES: what it drops */
	lootSourceId: string;
	/** Bosses with a clock: the fight is lost when it runs out */
	timeLimitSec?: number;
	taunts?: readonly string[];
}

/**
 * The roster. Three normal monsters and one boss per biome, each biome a step up from the one before (docs/plan/ROADMAP.md, enemy rework):
 * the stats below come from `BIOME_TIER` and a per-monster `build` (tanky, quick, hard-hitting), so the whole ladder is retuned in one place.
 * The first plains monster and the plains boss carry the numbers of the retired rat and Rat King (a level 1 rat's stats, a 1000 HP boss), so fights.md and the sims keep their meaning.
 */
type Tier = {
	hp: number;
	attack: number;
	armor: number;
	rewardSec: number;
	/** Absolute cap of the gold and XP a kill pays at its refLevel (see `MonsterDef.reward`) */
	cap: { gold: number; xp: number };
	/** The levels a new monster appears at (see `MonsterDef.spawnWindow`): a later biome starts higher and ends higher */
	window: MonsterDef['spawnWindow'];
	/** Bosses: the level the numbers are for, the time limit, the HP and the level window */
	boss: {
		hp: number;
		attack: number;
		armor: number;
		refLevel: number;
		cap: { gold: number; xp: number };
		timeLimitSec: number;
		window: MonsterDef['spawnWindow'];
		crit: number;
		stunResist: number;
	};
};

const BIOME_TIER = {
	plains: {
		hp: 100,
		attack: 4,
		armor: 0,
		rewardSec: 90,
		cap: { gold: 300, xp: 42 },
		window: { base: 1, perCastleLevel: 1, spread: 2, cap: 10 }, // castle 1: level 1-3, castle 8 and up: level 8-10
		boss: {
			hp: 1000,
			attack: 11,
			armor: 15,
			refLevel: 15,
			cap: { gold: 600_000, xp: 45_000 },
			timeLimitSec: 75,
			window: { base: 15, perCastleLevel: 0.8, spread: 3, cap: 25 },
			crit: 8,
			stunResist: 20,
		},
	},
	forest: {
		hp: 160,
		attack: 6,
		armor: 1,
		rewardSec: 110,
		cap: { gold: 600, xp: 85 },
		window: { base: 4, perCastleLevel: 1, spread: 2, cap: 14 },
		boss: {
			hp: 1900,
			attack: 16,
			armor: 24,
			refLevel: 20,
			cap: { gold: 600_000, xp: 45_000 },
			timeLimitSec: 80,
			window: { base: 20, perCastleLevel: 0.8, spread: 3, cap: 30 },
			crit: 9,
			stunResist: 25,
		},
	},
	swamp: {
		hp: 220,
		attack: 7,
		armor: 2,
		rewardSec: 135,
		cap: { gold: 1200, xp: 171 },
		window: { base: 8, perCastleLevel: 1, spread: 2, cap: 18 },
		boss: {
			hp: 2800,
			attack: 21,
			armor: 32,
			refLevel: 25,
			cap: { gold: 600_000, xp: 45_000 },
			timeLimitSec: 85,
			window: { base: 25, perCastleLevel: 0.8, spread: 3, cap: 35 },
			crit: 10,
			stunResist: 30,
		},
	},
	// the hardest land: its monsters start where the swamp's end, and its boss is out of reach of the best gear there is today
	tundra: {
		hp: 300,
		attack: 8,
		armor: 3,
		rewardSec: 190,
		cap: { gold: 2400, xp: 342 },
		window: { base: 12, perCastleLevel: 0.5, spread: 2, cap: 20 },
		boss: {
			hp: 7000,
			attack: 36,
			armor: 58,
			refLevel: 30,
			cap: { gold: 600_000, xp: 45_000 },
			timeLimitSec: 90,
			window: { base: 30, perCastleLevel: 0.8, spread: 3, cap: 40 },
			crit: 13,
			stunResist: 45,
		},
	},
} as const satisfies Record<MonsterBiome, Tier>;

/** How a normal monster fights, relative to its biome's tier */
const BUILD = {
	even: { hp: 1, attack: 1, speed: 0.5 }, // a bite every 2 s
	tough: { hp: 1.3, attack: 0.8, speed: 0.4 },
	fierce: { hp: 0.8, attack: 1.25, speed: 0.6 },
	// a real challenge: it needs gear collected first (more of it is coming); armor 8 (the biome's own armor comes on top)
	elite: { hp: 2, attack: 1.5, speed: 0.45, armor: 8 },
} as const;

const normal = (biome: keyof typeof BIOME_TIER, label: string, build: keyof typeof BUILD): MonsterDef => {
	const tier = BIOME_TIER[biome];
	const b = BUILD[build];
	return {
		grade: 'normal',
		label,
		hp: Math.round(tier.hp * b.hp),
		attack: Math.round(tier.attack * b.attack * 10) / 10,
		armor: tier.armor + ('armor' in b ? b.armor : 0),
		critChance: 0,
		critMult: 1.5,
		stunResist: 0,
		attackSpeed: b.speed,
		spawn: { biomes: [biome], minCastleDistance: 2, maxCastleDistance: 9 },
		reward: { gold: { rewardSec: tier.rewardSec, cap: tier.cap.gold }, xp: { rewardSec: tier.rewardSec, cap: tier.cap.xp }, levelMult: 1.08 },
		refLevel: 1,
		scaling: 'exp',
		hpPerLevel: Math.sqrt(1.5), // the old 1.5 per tier (a tier was two levels), so a level 9 plains monster has 506 HP
		attackPerLevel: Math.sqrt(1.25), // the old 1.25 per tier
		armorPerLevel: 0.5,
		spawnWindow: tier.window,
		lootSourceId: monsterSourceId(biome),
	};
};

/**
 * The boss band (IDL-222, owner decision 2026-11-09): a boss only stands 8 or more tiles from the castle (the owner first picked 10, then lowered it to 8 after testing), just past the outskirts' start (7), and the band is open-ended (`BOSS_MAX_DISTANCE` is only a number larger than any map). Normal monsters keep 2 to 9, so at distances 8 and 9 a normal monster and a boss may both stand (never on the same tile: one monster per tile).
 *
 * @category Monsters/Spawning
 * @order 7
 * @formula
 * boss tile: BOSS_MIN_DISTANCE (8) <= castle distance <= BOSS_MAX_DISTANCE; normal monster tile: 2 <= castle distance <= 9
 */
export const BOSS_MIN_DISTANCE = 8;
export const BOSS_MAX_DISTANCE = 999;

/** A boss always has a clock and taunts (the type says so, so a caller need not check) */
const boss = (biome: keyof typeof BIOME_TIER, label: string, taunts: readonly string[]): MonsterDef & { timeLimitSec: number; taunts: readonly string[] } => {
	const b = BIOME_TIER[biome].boss;
	return {
		grade: 'boss',
		label,
		hp: b.hp, // behind armor (about a quarter of every hit is lost) and a clock: see docs/generated/fight-sim.md
		attack: b.attack,
		armor: b.armor,
		critChance: b.crit,
		critMult: 1.5,
		stunResist: b.stunResist,
		attackSpeed: 1 / 3, // one hit every 3 s; armor decides how many hits you survive, potions fill the gap
		spawn: { biomes: [biome], minCastleDistance: BOSS_MIN_DISTANCE, maxCastleDistance: BOSS_MAX_DISTANCE },
		reward: { gold: { rewardSec: 3600, cap: b.cap.gold }, xp: { rewardSec: 3600, cap: b.cap.xp }, levelMult: 1.03 },
		refLevel: b.refLevel,
		scaling: 'gear',
		hpPerLevel: 1,
		attackPerLevel: 1,
		armorPerLevel: 0.5,
		spawnWindow: b.window,
		lootSourceId: 'boss',
		timeLimitSec: b.timeLimitSec,
		taunts,
	};
};

/** What a ticket or a monster without a (valid) type becomes: tickets written before monster types existed carry no type. */
export const FALLBACK_MONSTER = 'thistleBoar' as const;
export const FALLBACK_BOSS = 'bossGreatAuroch' as const;

/**
 * The roster: 16 monsters in four biomes, three normal ones and a boss each. Plains, forest, swamp and tundra only; hills, coast and lake have none (a monster may only stand on a biome in its `spawn.biomes`).
 * Stats are at level 1 (bosses at their `refLevel`), straight from {@link monsterStats}; speed is attacks per second; the spawn window shows castle level 1 to castle level 10.
 *
 * - Builds (`BUILD`): even x1 HP x1 attack, speed 0.5; tough x1.3 HP x0.8 attack, 0.4; fierce x0.8 HP x1.25 attack, 0.6; elite x2 HP x1.5 attack, 0.45, +8 armor.
 * - Normal monsters never crit (`critChance` 0, `critMult` 1.5, no Stun resistance). Bosses: crit 8 / 9 / 10 / 13 %, Stun resistance 20 / 25 / 30 / 45 %, time limit 75 / 80 / 85 / 90 s, one hit every 3 s (`BIOME_TIER`).
 * - Tier numbers per biome (`BIOME_TIER`): plains HP 100 attack 4; forest 160 / 6; swamp 220 / 7; tundra 300 / 8.
 * - The ladder against gear: `docs/generated/monster-ladder.md`.
 *
 * @category Monsters/Roster
 * @order 1
 * @table monster-roster
 */
export const MONSTERS = {
	// plains
	thistleBoar: normal('plains', 'Thistle Boar', 'even'),
	burrowBadger: normal('plains', 'Burrow Badger', 'tough'),
	dustStrider: normal('plains', 'Dust Strider', 'fierce'),
	bossGreatAuroch: boss('plains', 'The Great Auroch', ['The Auroch stamps the ground.', 'Come back when you are stronger!', 'The herd is not impressed.']),
	// forest
	mossbackWolf: normal('forest', 'Mossback Wolf', 'fierce'),
	brambleImp: normal('forest', 'Bramble Imp', 'even'),
	rotcapStag: normal('forest', 'Rotcap Stag', 'tough'),
	bossElderStag: boss('forest', 'The Elder Stag', ['The Elder Stag lowers its antlers.', 'The forest remembers every trespasser.']),
	// swamp
	garbageOgre: normal('swamp', 'Garbage Ogre', 'tough'),
	dumpback: normal('swamp', 'Dumpback', 'even'),
	rotHeron: normal('swamp', 'Rot Heron', 'fierce'),
	bossMireMatriarch: boss('swamp', 'The Mire Matriarch', ['The Matriarch gurgles with laughter.', 'The mire swallows the proud.']),
	// tundra
	frostHare: normal('tundra', 'Frost Hare', 'fierce'),
	icetuskCalf: normal('tundra', 'Icetusk Calf', 'tough'),
	rimeWraith: normal('tundra', 'Rime Wraith', 'elite'),
	bossWinterWyrm: boss('tundra', 'The Winter Wyrm', ['The Wyrm exhales a cold breath.', 'Winter outlasts everyone.']),
} as const satisfies Record<string, MonsterDef>;
