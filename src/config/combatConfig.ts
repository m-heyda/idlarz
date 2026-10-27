// Combat tunables. Every number the fight, the monsters and the loot depend on lives here.

export const COMBAT = {
	baseHp: 85, // max HP = baseHp + vitality-derived hp + gear maxHp (about 100 at game start)
	regenPerSec: 1, // HP per second while no fight is open
	maxDodge: 40, // % cap on the gear's Dodge, so a monster's hit can never be avoided every time
	knockoutHpFraction: 0.3, // HP restored (as a share of max) after a knockout
	armorK: 40, // mitigation = armor / (armor + armorK)
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
	bagSize: 36,
	potionCooldownSec: 8, // shared cooldown between potions inside a fight
	spawn: {
		firstSec: 120, // first monster this long after the territory reaches minOwnedTiles
		intervalSec: 900, // then one per this long (chests: 600 s)
		minOwnedTiles: 5,
	},
	tierIntervalSec: 1800, // a rat gains a tier every 30 min on the map
	maxTier: 5,
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

export const MONSTERS = {
	rat: {
		label: 'Rat',
		hp: 100,
		hpGrowth: 1.5, // per tier
		attack: 4,
		attackGrowth: 1.25, // per tier
		attackIntervalSec: 2,
		rewardSec: 90, // gold and XP are this many seconds of income
		rewardGrowth: 1.5, // per tier
	},
	ratKing: {
		label: 'Rat King',
		hp: 15600, // 3x the old 5200, matching the tripled weapon damage, so the fight is as hard as before; see docs/generated/fight-sim.md: a starter kit never wins; steel needs ~10+ clicks/s, obsidian ~7, Rattatui is comfortable
		attack: 14,
		attackIntervalSec: 3, // armor decides how many hits you survive; potions fill the gap
		rewardSec: 3600,
		timeLimitSec: 75,
		evolveChance: 0.35, // rolled every evolveCheckSec once a rat has reached the last tier
		evolveCheckSec: 600,
		taunts: [
			"Squeak! Is that all you've got?",
			"Haha, come back when you're stronger!",
			'The King is not impressed.',
			'Run along, little knight!',
		],
	},
} as const;
