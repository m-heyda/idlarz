import { LIMITS } from '@/config/limits';

// Combat tunables. Every number the fight, the monsters and the loot depend on lives here.

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
	fightStepClampSec: 1, // a fight step never advances more than this (throttled tabs freeze fights instead of fast-forwarding them)
	maxItemDamage: 50, // sanity ceiling for one item's damage (tests/items.test.ts); fights are balanced by tests/fightBalance.test.ts, not by a cap
	// Clicks are not rate limited in fights: speed is skill. What stops a click from being too strong is damage and crit.
	crit: {
		mult: 2, // a crit deals this many times the damage
		superMult: 5, // a super crit (rolled only when a click already crit)
		superBase: 5, // % chance for a crit to become a super crit, before gear
		maxCritChance: 75, // % caps, so stacked gear cannot make every click a crit
		maxSuperChance: 50,
	},
	bagSize: LIMITS.bagSize, // base bag slots; read the current size through limitOf('bagSize', ctx) (Pack Rat and later effects add to it)
	potionCooldownSec: 8, // shared cooldown between potions inside a fight
	victoryToastSec: 12, // how long the loot notice after a won fight stays up (hover pauses it)
	spawn: {
		firstSec: 120, // first monster this long after the territory reaches minOwnedTiles
		intervalSec: 900, // then one per this long (chests: 600 s)
		bossIntervalSec: 10800, // a boss (one at a time) appears this long after the last one left, or after the start
		minOwnedTiles: 5,
	},
	// What drops (how often, which rarity and item level) is loot config: src/catalog/lootConfig.ts
	rewards: { minGold: 10, minXp: 5 },
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
	attackIntervalSec: number;
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
		attackIntervalSec: 2,
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
		hp: 9600, // behind 15 armor (a bit over a quarter of every click is lost): about 13200 effective HP at level 15; see docs/generated/fight-sim.md
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
		attackIntervalSec: 3, // armor decides how many hits you survive; potions fill the gap
	},
} as const satisfies Record<string, MonsterDef>;
