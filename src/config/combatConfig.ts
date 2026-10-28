import { LIMITS } from '@/config/limits';
import type { BiomeType } from '@/types/game';

// Combat tunables. Every number the fight, the monsters and the loot depend on lives here.
// SERVER-OWNED: the server rolls spawns, places monsters and runs every fight from these numbers; the browser only shows them.

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
	maxItemDamage: 50, // sanity ceiling for one item's damage (tests/items.test.ts); fights are balanced by tests/fightBalance.test.ts, not by a cap
	// Fights run on the server in fixed ticks: the player swings at the weapon's attack speed, a monster at its own. Nobody clicks to hit: a click on a monster only starts the fight.
	tickSec: 0.1, // the server's fight step
	maxCatchUpSec: 120, // one request runs a fight forward by at most this long (a longer silence is simulated by the next request)
	maxFightSec: 180, // a fight that has not been decided by now is called off (the monster stays, no reward)
	poll: {
		fightSec: 2, // the open combat panel asks the server for the fight this often...
		minimizedSec: 8, // ...the minimized icon (or a hidden tab) this often
	},
	// What the server does for a player in a fight, and when it starts one. Fixed on purpose: players only switch auto-battle and auto-use on or off.
	auto: {
		resumeHpPct: 80, // auto-battle only starts a fight with HP at this share of max or more (after a knockout it rests up to it)
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
		firstSec: 120, // first monster this long after the territory reaches minOwnedTiles
		intervalSec: 900, // then one per this long (chests: 600 s)
		bossIntervalSec: 10800, // a boss (one at a time) appears this long after the last one left, or after the start
		dangerStep: 8, // a monster that appears this many tiles (Chebyshev) further from the castle spawns one level higher: the frontier is more dangerous than the home land
	},
	// What drops (how often, which rarity and item level) is loot config: src/catalog/lootConfig.ts
	// A kill pays seconds of income: gold and XP as `rewardSec` x the rate, hide as that x `hideShare` (hide only comes from the farm, so
	// a rat's pelts are a share of it: they help with the hide the big territories cost, see TILE_RESOURCE_COST)
	rewards: { minGold: 10, minXp: 5, hideShare: 0.6 },
};

// How the five attributes feed combat (read through lib/statBonuses.ts). Every attribute starts at `base`; bonuses count the
// points ABOVE it, so a new character plays exactly like one with no stat bonuses and every point spent is a real step up.
export const STAT_RULES = {
	base: 5,
	physicalDamagePerStrength: 2, // % damage with physical weapons per point above base
	magicDamagePerIntelligence: 2.4, // % damage with magic weapons: 1.2x the physical rate, so magic is worth going into
	armorPerDexterity: 0.5, // armor added to the gear's per point above base
	armorPerVitality: 0.5,
	armorPerStrength: 0.25,
	critDamagePerPoint: { strength: 1, dexterity: 0.5, charisma: 0.5 }, // % extra on the x2 crit and x5 super crit multipliers
	atkSpeedPerDexterity: 0.25, // % attack speed (the hook for speed-based combat; clicks ignore it)
	mana: { base: 20, perIntelligence: 4, regenBase: 0.5, regenPerIntelligence: 0.05 }, // max mana and mana per second
	magicWeaponTypes: ['staff', 'wand'] as readonly string[], // these scale with Intelligence, every other weapon with Strength
	lifeLeechCap: 15, // % of click damage returned as HP: the gear's Life Leech never counts above this
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

/** Land a rat or the King may stand on: no water (lake, coast) and never the castle. */
const LAND_BIOMES: readonly BiomeType[] = ['plains', 'forest', 'hills', 'swamp', 'tundra'];

/**
 * A kind of monster. The numbers are for `refLevel`; other levels follow `scaling`: `exp` multiplies by the `*PerLevel` factors for
 * every level away from `refLevel`, `gear` follows the item level curve (`levelScale`), so a boss keeps pace with the gear that drops
 * at his level. Armor is additive per level. `spawnWindow` says at which levels a new one appears: it starts at `base`, rises
 * `perCastleLevel` per castle level above 1 and spans `spread` levels, never above `cap` (a rat's `cap` is the highest level it
 * can spawn at; it then grows up to `limitOf('monsterGrowthLevels')` more).
 */
export interface MonsterDef {
	grade: MonsterGrade;
	label: string;
	hp: number;
	attack: number;
	/** Reduces the damage of every click like a player's armor does (armor / (armor + armorK)) */
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
	/** Gold and XP of a kill are this many seconds of income */
	rewardSec: number;
	refLevel: number;
	scaling: 'exp' | 'gear';
	hpPerLevel: number;
	attackPerLevel: number;
	rewardPerLevel: number;
	armorPerLevel: number;
	spawnWindow: { base: number; perCastleLevel: number; spread: number; cap: number };
	/** Key into LOOT_SOURCES: what it drops */
	lootSourceId: string;
	/** Bosses with a clock: the fight is lost when it runs out */
	timeLimitSec?: number;
	taunts?: readonly string[];
}

export const MONSTERS = {
	rat: {
		grade: 'normal',
		label: 'Rat',
		hp: 100,
		attack: 4,
		armor: 0,
		critChance: 0,
		critMult: 1.5,
		stunResist: 0,
		attackSpeed: 0.5, // one bite every 2 s
		spawn: { biomes: LAND_BIOMES, minCastleDistance: 2, maxCastleDistance: 9 },
		rewardSec: 90,
		refLevel: 1,
		scaling: 'exp',
		hpPerLevel: Math.sqrt(1.5), // the old 1.5 per tier (a tier was two levels), so a level 9 rat is the old tier 5: 506 HP
		attackPerLevel: Math.sqrt(1.25), // the old 1.25 per tier
		rewardPerLevel: 1.17,
		armorPerLevel: 0.5,
		spawnWindow: { base: 1, perCastleLevel: 1, spread: 2, cap: 10 }, // castle 1: level 1-3, castle 8 and up: level 8-10
		lootSourceId: 'rat',
	},
	ratKing: {
		grade: 'boss',
		label: 'Rat King',
		hp: 1000, // behind 15 armor (about a quarter of every hit is lost) and a 75 s clock: the best gear wins comfortably, obsidian with seconds to spare, steel not; see docs/generated/fight-sim.md
		attack: 11,
		armor: 15,
		critChance: 8,
		critMult: 1.5,
		stunResist: 20,
		rewardSec: 3600,
		refLevel: 15,
		scaling: 'gear',
		hpPerLevel: 1,
		attackPerLevel: 1,
		rewardPerLevel: 1.03,
		armorPerLevel: 0.5,
		spawnWindow: { base: 15, perCastleLevel: 0.8, spread: 3, cap: 25 }, // castle 1: level 15-18, castle 10: level 22-25
		lootSourceId: 'ratKing',
		timeLimitSec: 75,
		taunts: [
			"Squeak! Is that all you've got?",
			"Haha, come back when you're stronger!",
			'The King is not impressed.',
			'Run along, little knight!',
		],
		attackSpeed: 1 / 3, // one hit every 3 s; armor decides how many hits you survive, potions fill the gap
		spawn: { biomes: LAND_BIOMES, minCastleDistance: 2, maxCastleDistance: 9 },
	},
} as const satisfies Record<string, MonsterDef>;
