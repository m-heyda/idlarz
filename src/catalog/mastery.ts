import { MONSTER_CATALOG, type CatalogBiome } from './monsters';

// Bestiary mastery as data (IDL-309, IDL-336, decided 2026-11-12 and 2026-11-17). A monster type has a ladder of kill tiers; reaching a tier lets the player claim it. A claim is the count of tiers taken, so appending a tier later
// (the decided 1,000 and 5,000 steps) or changing a threshold is a config change: tiers are numbered by position and nothing stored changes meaning. The server judges every claim from its own kill counts. Nothing here imports the server.

/** What a tier unlocks in the Bestiary window. */
export type MasteryReveal = 'stats' | 'drops';

/** What a mastery bonus makes better, always **against that monster** (or against every monster of a biome, for a biome goal): the damage the hero deals, the damage the hero takes (less), the gold and XP a kill pays, the chance of gear drops. */
export type MasteryStat = 'damage' | 'defense' | 'gold' | 'xp' | 'loot';
export const MASTERY_STATS: readonly MasteryStat[] = ['damage', 'defense', 'gold', 'xp', 'loot'];

/** One bonus, in percent (`damage` 2 is +2% damage; `defense` 2 is 2% less damage taken). */
export interface MasteryBonus {
	stat: MasteryStat;
	value: number;
}

export interface MasteryTier {
	/** Kills of the type that reach the tier */
	kills: number;
	/** The layer of the entry the tier shows (the data is in the client catalog anyway: this is a UI gate, not a secret) */
	reveal?: MasteryReveal;
	/** The permanent bonuses the claim switches on, against that monster. Structured numbers the server applies (`lib/mastery.ts` `masteryBonusesFor`). */
	bonuses: readonly MasteryBonus[];
	/** Gems the claim pays (0: none). The top tier pays (decided 2026-11-17); capped by `GEMS_CAP` like every gem payout. */
	gems: number;
}

/** The label of a stat in the window ("+2% damage", "-2% damage taken") */
export const MASTERY_STAT_LABEL: Readonly<Record<MasteryStat, string>> = {
	damage: 'damage dealt',
	defense: 'damage taken',
	gold: 'gold',
	xp: 'XP',
	loot: 'gear drop chance',
};

/** "+2% damage dealt" / "-2% damage taken": how one bonus reads. */
export const bonusText = (b: MasteryBonus): string => `${b.stat === 'defense' ? '-' : '+'}${b.value}% ${MASTERY_STAT_LABEL[b.stat]}`;

/**
 * The mastery ladder shared by every normal monster: 10 kills open the entry and reveal the stats, 100 reveal the drop table, 500 and 2,500 are Mastery I and II. Every tier gives a permanent bonus against that monster and the top tier also pays gems.
 * The decided 1,000 and 5,000 steps (up to +50% XP per type) are appended later as tiers 5 and 6.
 *
 * @title Bestiary mastery
 * @category Progression/Mastery
 * @order 0
 * @table bestiary-tiers
 * @see masteryState, claimMastery, BOSS_MASTERY_TIERS, BIOME_GOALS
 */
export const MASTERY_TIERS: readonly MasteryTier[] = [
	{ kills: 10, reveal: 'stats', bonuses: [{ stat: 'damage', value: 2 }], gems: 0 },
	{ kills: 100, reveal: 'drops', bonuses: [{ stat: 'xp', value: 5 }], gems: 0 },
	{ kills: 500, bonuses: [{ stat: 'loot', value: 5 }, { stat: 'defense', value: 3 }], gems: 0 },
	{ kills: 2500, bonuses: [{ stat: 'damage', value: 4 }, { stat: 'gold', value: 5 }], gems: 10 },
];

/**
 * The ladder of a boss: a boss is rare and fights alone, so its tiers come at 1, 5, 25 and 100 kills (decided 2026-11-17). The bonuses are a step above a normal monster's and the top tier pays more gems.
 *
 * @category Progression/Mastery
 * @order 0.5
 */
export const BOSS_MASTERY_TIERS: readonly MasteryTier[] = [
	{ kills: 1, reveal: 'stats', bonuses: [{ stat: 'damage', value: 3 }], gems: 0 },
	{ kills: 5, reveal: 'drops', bonuses: [{ stat: 'xp', value: 8 }], gems: 0 },
	{ kills: 25, bonuses: [{ stat: 'loot', value: 8 }, { stat: 'defense', value: 5 }], gems: 0 },
	{ kills: 100, bonuses: [{ stat: 'damage', value: 6 }, { stat: 'gold', value: 8 }], gems: 40 },
];

/** Kills that fill a Bestiary entry: the first tier of the shared ladder (the Scholar deed counts the entries that reached it). */
export const MASTERY_ENTRY_KILLS: number = MASTERY_TIERS[0].kills;

const GRADE_OF: ReadonlyMap<string, 'normal' | 'boss'> = new Map(MONSTER_CATALOG.map((m) => [m.id, m.grade]));

/** The ladder of one monster type: the boss ladder for a boss, the shared one for everything else (including a type the catalog no longer lists, so old kill counts still read). */
export const masteryTiersOf = (type: string): readonly MasteryTier[] => (GRADE_OF.get(type) === 'boss' ? BOSS_MASTERY_TIERS : MASTERY_TIERS);

/** The most tiers any ladder has (the highest tier a claim may name). */
export const MAX_MASTERY_TIERS: number = Math.max(MASTERY_TIERS.length, BOSS_MASTERY_TIERS.length);

/** A biome's collection goal: when **every** monster of the biome, its boss included, has reached tier N (by kills), the player may claim the biome tier and gets the bonus against **all** monsters there. */
export interface BiomeGoal {
	bonuses: readonly MasteryBonus[];
	gems: number;
}

/**
 * The biome collection goals, one per ladder tier (decided 2026-11-17): the same rewards for every biome, a step bigger each tier. The biome's progress is the lowest tier reached by any of its monsters.
 *
 * @category Progression/Mastery
 * @order 0.6
 */
export const BIOME_GOALS: readonly BiomeGoal[] = [
	{ bonuses: [{ stat: 'damage', value: 1 }], gems: 0 },
	{ bonuses: [{ stat: 'xp', value: 3 }, { stat: 'gold', value: 3 }], gems: 0 },
	{ bonuses: [{ stat: 'loot', value: 4 }, { stat: 'defense', value: 2 }], gems: 0 },
	{ bonuses: [{ stat: 'damage', value: 3 }, { stat: 'gold', value: 4 }], gems: 25 },
];

/**
 * The most each stat may add against one monster, monster tiers and biome goal together, in percent. The damage cap sits under the gear damage cap (`PERK_CAPS.damagePct` 50) and none of these ever reaches a global bucket: a mastery bonus only works against the monster it was earned on (or the biomes it completes).
 *
 * @category Progression/Mastery
 * @order 0.7
 * @formula
 * bonus vs one monster = min(cap, tier bonuses of that monster + biome goal bonuses of its biome)       multiplier = 1 + bonus / 100 (defense: damage taken x (1 - bonus / 100))
 */
export const MASTERY_CAPS: Readonly<Record<MasteryStat, number>> = { damage: 20, defense: 20, gold: 25, xp: 25, loot: 20 };

/** The biomes with a collection goal and the live monsters in each (retired stand-ins do not count). */
export const biomeRoster = (biome: string): readonly string[] => MONSTER_CATALOG.filter((m) => m.enabled && m.biomes[0] === biome).map((m) => m.id);

/** The biome of a monster type (its first catalog biome), or undefined for a type the catalog does not list. */
export const biomeOfType = (type: string): CatalogBiome | undefined => MONSTER_CATALOG.find((m) => m.id === type)?.biomes[0];

/** Every biome that has a roster, in catalog order. */
export const MASTERY_BIOMES: readonly CatalogBiome[] = [...new Set(MONSTER_CATALOG.filter((m) => m.enabled).map((m) => m.biomes[0]))];
