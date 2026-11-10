// The launch achievements as data (IDL-73, gem amounts IDL-194, decided 2026-11-07). Order is the order of the list in the game. A condition is a plain tag that
// `lib/offline/achievements.ts` checks against numbers the server already holds; nothing here imports the config or the server.

/** What has to hold. Each tag reads one number the server owns (lifetime counters, the last accepted save, the rebirth count). */
export type AchievementCondition =
	/** The last step of the starter path is done (skipping the tutorial does not count) */
	| { kind: 'tutorial' }
	/** Tiles bought, lifetime */
	| { kind: 'tiles'; min: number }
	/** Buildings built, lifetime. Dormant until the building system reports a count (the fact reads 0 until then). */
	| { kind: 'buildings'; min: number }
	/** Monsters killed, all types */
	| { kind: 'kills'; min: number }
	| { kind: 'chests'; min: number }
	/** The castle has reached this level in the last accepted save */
	| { kind: 'castle'; level: number }
	| { kind: 'rebirths'; min: number }
	/** Kills of one monster type (a catalog id) */
	| { kind: 'kill'; monster: string; min: number }
	/** Golden (lucky) monsters killed */
	| { kind: 'golden'; min: number }
	/** Never checked by the lazy evaluator: granted by a one-off server step (the early tester by the new chapter reset) */
	| { kind: 'manual' };

/** What an achievement pays. Gems always; an avatar and a title are optional (ids of `catalog/avatars.ts` and the titles, built in IDL-71 and later). */
export interface AchievementRewards {
	gems: number;
	avatarId?: string;
	titleId?: string;
}

export interface AchievementDef {
	id: string;
	title: string;
	description: string;
	when: AchievementCondition;
	rewards: AchievementRewards;
}

/**
 * The 12 launch achievements: 600 gems in total and 4 avatars (docs/plan/21 section 3). Gems are paid once per account by the server when the condition first holds
 * ({@link settleAchievements}); the early tester is granted by the new chapter reset instead of being checked. "Rat King defeated" was replaced by the first boss, The Great Auroch.
 * The first one ends where the guided tutorial's starter path ends. Later releases add grind ladders (R6) after these.
 *
 * @title Achievements
 * @category Progression/Achievements
 * @order 0
 * @table achievement-list
 * @see settleAchievements, achievementsDue
 */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
	{ id: 'tutorial', title: 'Learned the ropes', description: 'Finish the guided tutorial.', when: { kind: 'tutorial' }, rewards: { gems: 25 } },
	{ id: 'first_tile', title: 'Landowner', description: 'Buy your first tile.', when: { kind: 'tiles', min: 1 }, rewards: { gems: 25 } },
	{ id: 'first_building', title: 'Builder', description: 'Build your first building.', when: { kind: 'buildings', min: 1 }, rewards: { gems: 25 } },
	{ id: 'first_fight', title: 'First blood', description: 'Win your first fight.', when: { kind: 'kills', min: 1 }, rewards: { gems: 25 } },
	{ id: 'first_chest', title: 'Treasure hunter', description: 'Open your first chest.', when: { kind: 'chests', min: 1 }, rewards: { gems: 25 } },
	{ id: 'castle_2', title: 'Growing keep', description: 'Upgrade the castle to level 2.', when: { kind: 'castle', level: 2 }, rewards: { gems: 25 } },
	{ id: 'castle_6', title: 'Stout walls', description: 'Upgrade the castle to level 6.', when: { kind: 'castle', level: 6 }, rewards: { gems: 75 } },
	{
		id: 'castle_10',
		title: 'Architect',
		description: 'Upgrade the castle to level 10.',
		when: { kind: 'castle', level: 10 },
		rewards: { gems: 100, avatarId: 'architect' },
	},
	{
		id: 'first_rebirth',
		title: 'Reborn',
		description: 'Rebirth for the first time.',
		when: { kind: 'rebirths', min: 1 },
		rewards: { gems: 75, avatarId: 'reborn' },
	},
	{
		id: 'boss_auroch',
		title: 'Boss slayer',
		description: 'Defeat The Great Auroch.',
		when: { kind: 'kill', monster: 'bossGreatAuroch', min: 1 },
		rewards: { gems: 50, avatarId: 'boss_slayer' },
	},
	{ id: 'golden_kill', title: 'Golden touch', description: 'Kill a golden monster.', when: { kind: 'golden', min: 1 }, rewards: { gems: 50 } },
	{
		id: 'early_tester', // the id the new chapter reset writes (`EARLY_TESTER` in lib/offline/chapter.ts)
		title: 'Early tester',
		description: 'Played before the new chapter.',
		when: { kind: 'manual' },
		rewards: { gems: 100, avatarId: 'early_tester', titleId: 'early-tester' },
	},
];

export const achievementById = (id: string): AchievementDef | undefined => ACHIEVEMENTS.find((a) => a.id === id);

/** What the list shows for an achievement the player has not earned: nothing but its place. */
export const LOCKED_LABEL = '???';
