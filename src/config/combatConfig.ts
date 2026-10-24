// Combat tunables. Every number the fight, the monsters and the loot depend on lives here.

export const COMBAT = {
	baseHp: 85, // max HP = baseHp + vitality-derived hp + gear maxHp (about 100 at game start)
	regenPerSec: 1, // HP per second while no fight is open
	knockoutHpFraction: 0.3, // HP restored (as a share of max) after a knockout
	armorK: 40, // mitigation = armor / (armor + armorK)
	fightStepClampSec: 1, // a fight step never advances more than this (throttled tabs freeze fights instead of fast-forwarding them)
	maxWeaponDamage: 3, // MVP cap: keeps the Rat King unkillable (see tests/kingInvariant.test.ts)
	bagSize: 36,
	maxMonsters: 8,
	potionCooldownSec: 8, // shared cooldown between potions inside a fight
	spawn: {
		firstSec: 120, // first monster this long after the territory reaches minOwnedTiles
		intervalSec: 900, // then one per this long (chests: 600 s)
		minOwnedTiles: 5,
	},
	tierIntervalSec: 1800, // a rat gains a tier every 30 min on the map
	maxTier: 5,
	drops: {
		setPieceBase: 0.08,
		setPieceTierBonus: 0.01,
		potionBase: 0.25,
		potionTierBonus: 0.03,
	},
	rewards: { minGold: 10, minXp: 5 },
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
		hp: 1000,
		attack: 5,
		attackIntervalSec: 3.5, // tuned so the timer, not the player's HP, is the normal way to lose
		rewardSec: 3600,
		timeLimitSec: 60,
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
