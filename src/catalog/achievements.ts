import { MASTERY_ENTRY_KILLS } from '@/catalog/mastery';

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
	/** The most gold held at once at an accepted save (`LifetimeStats.goldPeak`) */
	| { kind: 'goldPeak'; min: number }
	/** Resource units sold to the merchant, lifetime */
	| { kind: 'unitsSold'; min: number }
	/** Crafts delivered, lifetime */
	| { kind: 'crafted'; min: number }
	/** Fights won without taking a hit */
	| { kind: 'flawless'; min: number }
	/** Bestiary entries filled: monster types with at least `kills` kills each (the first mastery step, `catalog/mastery.ts`) */
	| { kind: 'entries'; kills: number; min: number }
	/** Never checked by the lazy evaluator: granted by a one-off server step (the early tester by the new chapter reset) */
	| { kind: 'manual' };

/** What an achievement pays. Gems always; an avatar and a title are optional (ids of `catalog/avatars.ts` and the titles, built in IDL-71 and later). */
export interface AchievementRewards {
	gems: number;
	avatarId?: string;
	titleId?: string;
	/** Deed points this tier adds once claimed (the Hall of Deeds total; absent: 0). Placeholder numbers until the balance pass. */
	points?: number;
	/** A bonus the tier will grant, as the text the window shows. **Placeholder only**: no stat bonus is applied until the bonus model exists (IDL-310). */
	bonus?: string;
}

export interface AchievementDef {
	id: string;
	title: string;
	description: string;
	when: AchievementCondition;
	rewards: AchievementRewards;
	/** File name (no extension) in `public/pixel/new_assets/achievements/`; swapping the art later is changing this string */
	badge: string;
	/** Granted together with another (manual) achievement: the Beta tester comes with the Early tester */
	withAchievement?: string;
	/** The badge is a stand-in until art for this achievement exists */
	badgePlaceholder?: boolean;
}

/**
 * The 12 launch achievements (600 gems in total and 4 avatars, docs/plan/21 section 3) and the Beta tester (200 gems, its own avatar). The server records an achievement once per account when its condition first holds
 * ({@link settleAchievements}) and pays its gems when the player claims it; the two testers are granted by the new chapter reset (and for the accounts that already had the Early tester) instead of being checked. "Rat King defeated" was replaced by the first boss, The Great Auroch.
 * The first one ends where the guided tutorial's starter path ends. Later releases add grind ladders (R6) after these.
 *
 * @title Achievements
 * @category Progression/Achievements
 * @order 0
 * @table achievement-list
 * @see settleAchievements, achievementsDue
 */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
	{
		id: 'tutorial',
		title: 'Learned the ropes',
		description: 'Finish the guided tutorial.',
		when: { kind: 'tutorial' },
		badge: 'badge_scroll_check_silver',
		rewards: { gems: 25, points: 5 },
	},
	{
		id: 'first_tile',
		title: 'Landowner',
		description: 'Buy your first tile.',
		when: { kind: 'tiles', min: 1 },
		badge: 'badge_map_flag_bronze',
		rewards: { gems: 25, points: 5 },
	},
	{
		id: 'first_building',
		title: 'Builder',
		description: 'Build your first building.',
		when: { kind: 'buildings', min: 1 },
		badge: 'badge_hammer_bronze',
		rewards: { gems: 25, points: 5 },
	},
	{
		id: 'first_fight',
		title: 'First blood',
		description: 'Win your first fight.',
		when: { kind: 'kills', min: 1 },
		badge: 'badge_sword_shield_bronze',
		rewards: { gems: 25, points: 5 },
	},
	{
		id: 'first_chest',
		title: 'Treasure hunter',
		description: 'Open your first chest.',
		when: { kind: 'chests', min: 1 },
		badge: 'badge_chest_bronze',
		rewards: { gems: 25, points: 5 },
	},
	{
		id: 'castle_2',
		title: 'Growing keep',
		description: 'Upgrade the castle to level 2.',
		when: { kind: 'castle', level: 2 },
		badge: 'badge_tower_silver',
		rewards: { gems: 25, points: 5 },
	},
	{
		id: 'castle_6',
		title: 'Stout walls',
		description: 'Upgrade the castle to level 6.',
		when: { kind: 'castle', level: 6 },
		badge: 'badge_tower_silver',
		rewards: { gems: 75, points: 15 },
	},
	{
		id: 'castle_10',
		title: 'Architect',
		description: 'Upgrade the castle to level 10.',
		when: { kind: 'castle', level: 10 },
		badge: 'badge_castle_10_gold',
		rewards: { gems: 100, avatarId: 'architect', points: 30 },
	},
	{
		id: 'first_rebirth',
		title: 'Reborn',
		description: 'Rebirth for the first time.',
		when: { kind: 'rebirths', min: 1 },
		badge: 'badge_first_rebirth_fire',
		rewards: { gems: 75, avatarId: 'reborn', points: 20 },
	},
	{
		id: 'boss_auroch',
		title: 'Boss slayer',
		description: 'Defeat The Great Auroch.',
		when: { kind: 'kill', monster: 'bossGreatAuroch', min: 1 },
		badge: 'badge_great_auroch_boss',
		rewards: { gems: 50, avatarId: 'boss_slayer', points: 15 },
	},
	{
		id: 'golden_kill',
		title: 'Golden touch',
		description: 'Kill a golden monster.',
		when: { kind: 'golden', min: 1 },
		badge: 'badge_golden_monster_gold',
		rewards: { gems: 50, points: 10 },
	},
	{
		id: 'early_tester', // the id the new chapter reset writes (`EARLY_TESTER` in lib/offline/chapter.ts)
		title: 'Early tester',
		description: 'Played before the new chapter.',
		when: { kind: 'manual' },
		badge: 'badge_early_tester_special',
		rewards: { gems: 100, avatarId: 'early_tester', titleId: 'early-tester' },
	},
	{
		id: 'beta_tester', // granted with the Early tester (`withAchievement`): by the reset, and for the accounts that already had it
		title: 'Beta tester',
		description: 'Played in the closed beta.',
		when: { kind: 'manual' },
		withAchievement: 'early_tester',
		badge: 'badge_early_tester_wireframe',
		rewards: { gems: 200, avatarId: 'beta_tester', titleId: 'beta-tester' },
	},
	// The tiers of the Hall of Deeds (IDL-306), appended after the launch list. Goals are the mockup's; gems and points are placeholders until the balance pass (IDL-310) and bonuses are text only.
	{
		id: 'slayer_100',
		title: 'Slayer I',
		description: 'Defeat 100 monsters.',
		when: { kind: 'kills', min: 100 },
		badge: 'badge_skull_bronze',
		rewards: { gems: 25, points: 10 },
	},
	{
		id: 'slayer_500',
		title: 'Slayer II',
		description: 'Defeat 500 monsters.',
		when: { kind: 'kills', min: 500 },
		badge: 'badge_skull_bronze',
		rewards: { gems: 50, points: 25, bonus: '+1% gold' },
	},
	{
		id: 'slayer_2500',
		title: 'Slayer III',
		description: 'Defeat 2,500 monsters.',
		when: { kind: 'kills', min: 2500 },
		badge: 'badge_skull_bronze',
		rewards: { gems: 100, points: 50, bonus: '+2% gold' },
	},
	{
		id: 'slayer_10000',
		title: 'Slayer IV',
		description: 'Defeat 10,000 monsters.',
		when: { kind: 'kills', min: 10000 },
		badge: 'badge_skull_bronze',
		rewards: { gems: 200, points: 100 },
	},
	{
		id: 'wolfsbane_50',
		title: 'Wolfsbane I',
		description: 'Slay 50 Mossback Wolves.',
		when: { kind: 'kill', monster: 'mossbackWolf', min: 50 },
		badge: 'badge_sword_silver',
		rewards: { gems: 20, points: 5 },
	},
	{
		id: 'wolfsbane_200',
		title: 'Wolfsbane II',
		description: 'Slay 200 Mossback Wolves.',
		when: { kind: 'kill', monster: 'mossbackWolf', min: 200 },
		badge: 'badge_sword_silver',
		rewards: { gems: 40, points: 15, bonus: '+2% hide' },
	},
	{
		id: 'wolfsbane_1000',
		title: 'Wolfsbane III',
		description: 'Slay 1,000 Mossback Wolves.',
		when: { kind: 'kill', monster: 'mossbackWolf', min: 1000 },
		badge: 'badge_sword_silver',
		rewards: { gems: 80, points: 40, bonus: 'wolf pet' },
	},
	{
		id: 'untouched_1',
		title: 'Untouched I',
		description: 'Win a fight without taking damage.',
		when: { kind: 'flawless', min: 1 },
		badge: 'badge_shield_silver',
		rewards: { gems: 20, points: 5 },
	},
	{
		id: 'untouched_25',
		title: 'Untouched II',
		description: 'Win 25 fights without taking damage.',
		when: { kind: 'flawless', min: 25 },
		badge: 'badge_shield_silver',
		rewards: { gems: 50, points: 20, bonus: '+1% dodge' },
	},
	{
		id: 'untouched_100',
		title: 'Untouched III',
		description: 'Win 100 fights without taking damage.',
		when: { kind: 'flawless', min: 100 },
		badge: 'badge_shield_silver',
		rewards: { gems: 100, points: 50 },
	},
	{
		id: 'landlord_50',
		title: 'Landlord I',
		description: 'Buy 50 tiles.',
		when: { kind: 'tiles', min: 50 },
		badge: 'badge_map_flag_bronze',
		rewards: { gems: 20, points: 5 },
	},
	{
		id: 'landlord_200',
		title: 'Landlord II',
		description: 'Buy 200 tiles.',
		when: { kind: 'tiles', min: 200 },
		badge: 'badge_map_flag_bronze',
		rewards: { gems: 50, points: 15 },
	},
	{
		id: 'landlord_500',
		title: 'Landlord III',
		description: 'Buy 500 tiles.',
		when: { kind: 'tiles', min: 500 },
		badge: 'badge_map_flag_bronze',
		rewards: { gems: 100, points: 40, bonus: '-1% tile cost' },
	},
	{
		id: 'landlord_1000',
		title: 'Landlord IV',
		description: 'Buy 1,000 tiles.',
		when: { kind: 'tiles', min: 1000 },
		badge: 'badge_map_flag_bronze',
		rewards: { gems: 200, points: 100, bonus: '-3% tile cost' },
	},
	{
		id: 'hoarder_100k',
		title: 'Hoarder I',
		description: 'Hold 100,000 gold at once.',
		when: { kind: 'goldPeak', min: 100_000 },
		badge: 'badge_chest_bronze',
		rewards: { gems: 20, points: 5 },
	},
	{
		id: 'hoarder_1m',
		title: 'Hoarder II',
		description: 'Hold 1,000,000 gold at once.',
		when: { kind: 'goldPeak', min: 1_000_000 },
		badge: 'badge_chest_bronze',
		rewards: { gems: 50, points: 20, bonus: '+1% gold find' },
	},
	{
		id: 'hoarder_10m',
		title: 'Hoarder III',
		description: 'Hold 10,000,000 gold at once.',
		when: { kind: 'goldPeak', min: 10_000_000 },
		badge: 'badge_chest_bronze',
		rewards: { gems: 120, points: 60 },
	},
	{
		id: 'market_1m',
		title: 'Market Day I',
		description: 'Sell 1,000,000 resources to the merchant.',
		when: { kind: 'unitsSold', min: 1_000_000 },
		badge: 'badge_star_silver',
		rewards: { gems: 20, points: 5 },
	},
	{
		id: 'market_10m',
		title: 'Market Day II',
		description: 'Sell 10,000,000 resources to the merchant.',
		when: { kind: 'unitsSold', min: 10_000_000 },
		badge: 'badge_star_silver',
		rewards: { gems: 50, points: 20, bonus: '+1% sell price' },
	},
	{
		id: 'market_100m',
		title: 'Market Day III',
		description: 'Sell 100,000,000 resources to the merchant.',
		when: { kind: 'unitsSold', min: 100_000_000 },
		badge: 'badge_star_silver',
		rewards: { gems: 120, points: 60 },
	},
	{
		id: 'smith_100',
		title: 'Apprentice Smith I',
		description: 'Craft 100 items.',
		when: { kind: 'crafted', min: 100 },
		badge: 'badge_hammer_bronze',
		rewards: { gems: 20, points: 5 },
	},
	{
		id: 'smith_1000',
		title: 'Apprentice Smith II',
		description: 'Craft 1,000 items.',
		when: { kind: 'crafted', min: 1000 },
		badge: 'badge_hammer_bronze',
		rewards: { gems: 50, points: 20, bonus: '+5% craft speed' },
	},
	{
		id: 'smith_10000',
		title: 'Apprentice Smith III',
		description: 'Craft 10,000 items.',
		when: { kind: 'crafted', min: 10000 },
		badge: 'badge_hammer_bronze',
		rewards: { gems: 120, points: 60 },
	},
	{
		id: 'reborn_5',
		title: 'Reborn II',
		description: 'Rebirth 5 times.',
		when: { kind: 'rebirths', min: 5 },
		badge: 'badge_first_rebirth_fire',
		rewards: { gems: 100, points: 50 },
	},
	{
		id: 'reborn_20',
		title: 'Reborn III',
		description: 'Rebirth 20 times.',
		when: { kind: 'rebirths', min: 20 },
		badge: 'badge_first_rebirth_fire',
		rewards: { gems: 250, points: 150 },
	},
	{
		id: 'scholar_5',
		title: 'Scholar I',
		description: 'Fill 5 bestiary entries.',
		when: { kind: 'entries', kills: MASTERY_ENTRY_KILLS, min: 5 },
		badge: 'badge_scroll_check_silver',
		rewards: { gems: 20, points: 5 },
	},
	{
		id: 'scholar_15',
		title: 'Scholar II',
		description: 'Fill 15 bestiary entries.',
		when: { kind: 'entries', kills: MASTERY_ENTRY_KILLS, min: 15 },
		badge: 'badge_scroll_check_silver',
		rewards: { gems: 60, points: 25, bonus: '+5% XP' },
	},
	{
		id: 'scholar_30',
		title: 'Scholar III',
		description: 'Fill 30 bestiary entries.',
		when: { kind: 'entries', kills: MASTERY_ENTRY_KILLS, min: 30 },
		badge: 'badge_scroll_check_silver',
		rewards: { gems: 150, points: 80 },
	},
];

export const achievementById = (id: string): AchievementDef | undefined => ACHIEVEMENTS.find((a) => a.id === id);

/**
 * The Hall of Deeds (IDL-306): the achievements grouped into tiered deeds, in the order of the list. Every achievement above belongs to exactly one deed. The launch single-goal ones are deeds of their own (their ids and rewards are
 * unchanged, so a ledger that earned or claimed one reads exactly as before); the castle and rebirth ones become tiers of a longer deed. The tiers are the mockup's nine deeds, with placeholder rewards (balance pass: IDL-310).
 *
 * @title Deeds
 * @category Progression/Deeds
 * @order 0
 * @see deedState, deedPoints
 */
export const DEEDS: readonly DeedDef[] = [
	{
		id: 'slayer',
		title: 'Slayer',
		description: 'Defeat monsters of any kind.',
		category: 'combat',
		tags: ['kills'],
		badge: 'badge_skull_bronze',
		lore: 'Every blade grows dull before its wielder does. Count the fallen and the realm will remember you.',
		how: 'Any kill counts, including auto-fights while you are away.',
		tiers: ['slayer_100', 'slayer_500', 'slayer_2500', 'slayer_10000'],
	},
	{
		id: 'wolfsbane',
		title: 'Wolfsbane',
		description: 'Slay Mossback Wolves.',
		category: 'combat',
		tags: ['kills', 'forest'],
		badge: 'badge_sword_silver',
		lore: 'The forests east of your keep howl at night. Make them quiet.',
		how: 'Wolves roam forest tiles. Send your hero to a forest tile and let the fight run.',
		tiers: ['wolfsbane_50', 'wolfsbane_200', 'wolfsbane_1000'],
	},
	{
		id: 'untouched',
		title: 'Untouched',
		description: 'Win a fight without taking damage.',
		category: 'combat',
		tags: ['fights'],
		badge: 'badge_shield_silver',
		lore: 'Armor is for those who get hit.',
		how: 'High dodge, or killing before the first enemy swing, both count.',
		tiers: ['untouched_1', 'untouched_25', 'untouched_100'],
	},
	{
		id: 'first_blood',
		title: 'First blood',
		description: 'Win your first fight.',
		category: 'combat',
		tags: ['kills'],
		badge: 'badge_sword_shield_bronze',
		lore: 'Everyone starts somewhere.',
		how: 'Click a monster on the map.',
		tiers: ['first_fight'],
	},
	{
		id: 'boss_slayer',
		title: 'Boss slayer',
		description: 'Defeat The Great Auroch.',
		category: 'combat',
		tags: ['boss'],
		badge: 'badge_great_auroch_boss',
		lore: 'The first great beast of the realm.',
		how: 'Find The Great Auroch on the map and win.',
		tiers: ['boss_auroch'],
	},
	{
		id: 'golden_touch',
		title: 'Golden touch',
		description: 'Kill a golden monster.',
		category: 'combat',
		tags: ['kills', 'golden'],
		badge: 'badge_golden_monster_gold',
		lore: 'Rare, shiny and worth the swing.',
		how: 'Golden monsters appear now and then among the others.',
		tiers: ['golden_kill'],
	},
	{
		id: 'landlord',
		title: 'Landlord',
		description: 'Own tiles.',
		category: 'realm',
		tags: ['tiles'],
		badge: 'badge_map_flag_bronze',
		lore: 'A realm is just land that agreed to be yours.',
		how: 'Buy any tile from the map. Rebirths keep this count.',
		tiers: ['first_tile', 'landlord_50', 'landlord_200', 'landlord_500', 'landlord_1000'],
	},
	{
		id: 'builder',
		title: 'Builder',
		description: 'Build your first building.',
		category: 'realm',
		tags: ['buildings'],
		badge: 'badge_hammer_bronze',
		lore: 'Stone on stone.',
		how: 'Put a building on an owned tile.',
		tiers: ['first_building'],
	},
	{
		id: 'castle',
		title: 'Castle',
		description: 'Upgrade the castle.',
		category: 'realm',
		tags: ['castle'],
		badge: 'badge_tower_silver',
		lore: 'The keep is the heart of the realm.',
		how: 'Upgrade the castle from its window.',
		tiers: ['castle_2', 'castle_6', 'castle_10'],
	},
	{
		id: 'treasure_hunter',
		title: 'Treasure hunter',
		description: 'Open your first chest.',
		category: 'realm',
		tags: ['chests'],
		badge: 'badge_chest_bronze',
		lore: 'X marks the spot.',
		how: 'Open a chest standing on the map.',
		tiers: ['first_chest'],
	},
	{
		id: 'hoarder',
		title: 'Hoarder',
		description: 'Hold gold at one time.',
		category: 'economy',
		tags: ['gold'],
		badge: 'badge_chest_bronze',
		lore: 'Dragons had the right idea.',
		how: 'Your purse at any moment, not total earned. Selling resources is the fastest way.',
		tiers: ['hoarder_100k', 'hoarder_1m', 'hoarder_10m'],
	},
	{
		id: 'market',
		title: 'Market Day',
		description: 'Sell resources to the merchant.',
		category: 'economy',
		tags: ['merchant'],
		badge: 'badge_star_silver',
		lore: 'He will always take it. The price is the question.',
		how: 'Counts units sold, any resource. Use the trade ticket with Max to move stock in bulk.',
		tiers: ['market_1m', 'market_10m', 'market_100m'],
	},
	{
		id: 'smith',
		title: 'Apprentice Smith',
		description: 'Craft items.',
		category: 'craft',
		tags: ['crafting'],
		badge: 'badge_hammer_bronze',
		lore: 'Ten thousand vials before the first potion worth drinking.',
		how: 'Every crafted unit counts, components included.',
		tiers: ['smith_100', 'smith_1000', 'smith_10000'],
	},
	{
		id: 'reborn',
		title: 'Reborn',
		description: 'Complete a rebirth.',
		category: 'rebirth',
		tags: ['rebirth'],
		badge: 'badge_first_rebirth_fire',
		lore: 'The realm ends. You do not.',
		how: 'Rebirth is offered from level 40. You keep deeds, bestiary and merchant upgrades.',
		tiers: ['first_rebirth', 'reborn_5', 'reborn_20'],
	},
	{
		id: 'scholar',
		title: 'Scholar',
		description: 'Fill bestiary entries.',
		category: 'bestiary',
		tags: ['bestiary'],
		badge: 'badge_scroll_check_silver',
		lore: 'Know a thing and it is half beaten.',
		how: 'An entry counts as filled when its first mastery step is reached. See the Bestiary.',
		tiers: ['scholar_5', 'scholar_15', 'scholar_30'],
	},
	{
		id: 'ropes',
		title: 'Learned the ropes',
		description: 'Finish the guided tutorial.',
		category: 'special',
		tags: ['tutorial'],
		badge: 'badge_scroll_check_silver',
		lore: 'Every legend reads the instructions once.',
		how: 'Follow the starter path.',
		tiers: ['tutorial'],
	},
	{
		id: 'early_tester',
		title: 'Early tester',
		description: 'Played before the new chapter.',
		category: 'special',
		tags: ['tester'],
		badge: 'badge_early_tester_special',
		lore: 'You were here first.',
		how: 'Granted to the players of the old chapter.',
		tiers: ['early_tester'],
	},
	{
		id: 'beta_tester',
		title: 'Beta tester',
		description: 'Played in the closed beta.',
		category: 'special',
		tags: ['tester'],
		badge: 'badge_early_tester_wireframe',
		lore: 'You broke it so it could be fixed.',
		how: 'Granted to the players of the closed beta.',
		tiers: ['beta_tester'],
	},
];

export const deedById = (id: string): DeedDef | undefined => DEEDS.find((d) => d.id === id);

/** The deed an achievement id is a tier of (every id is one). */
export const deedOfAchievement = (achievementId: string): DeedDef | undefined => DEEDS.find((d) => d.tiers.includes(achievementId));

/** The groups of the Hall of Deeds window. */
export type DeedCategory = 'combat' | 'realm' | 'economy' | 'craft' | 'bestiary' | 'rebirth' | 'special';

/**
 * A deed groups the tiers of one goal for the Hall of Deeds (Slayer: 100 / 500 / 2.5K / 10K kills). **Each tier is an ordinary achievement** (`tiers` lists their ids in order), so earning, claiming, the ledger and
 * `player_achievements` work per tier exactly as they did for the flat list, and every id that shipped keeps meaning what it meant (a legacy single-goal achievement is a deed with one tier).
 */
export interface DeedDef {
	id: string;
	title: string;
	description: string;
	category: DeedCategory;
	tags: readonly string[];
	/** File name of the badge shown on the deed (`public/pixel/new_assets/achievements/`) */
	badge: string;
	/** The paper panel: a line of flavour and how to make progress */
	lore: string;
	how: string;
	/** Achievement ids, easiest first. Append new tiers at the end, never reorder (a stored id keeps its place). */
	tiers: readonly string[];
}

/** What the list shows for an achievement the player has not earned: nothing but its place. */
export const LOCKED_LABEL = '???';
