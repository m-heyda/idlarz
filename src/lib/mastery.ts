import {
	BIOME_GOALS,
	MASTERY_CAPS,
	MASTERY_STATS,
	MASTERY_TIERS,
	biomeOfType,
	biomeRoster,
	masteryTiersOf,
	type MasteryBonus,
	type MasteryStat,
	type MasteryTier,
} from '@/catalog/mastery';

// Pure maths of the Bestiary mastery (IDL-309): which tier a kill count reaches, what is claimable, what the entry may show. Shared by the server (claim rules) and the browser (the window).

/** Tiers a kill count has reached (0 to the number of tiers). */
export const masteryReached = (kills: number, tiers: readonly MasteryTier[] = MASTERY_TIERS): number => tiers.filter((t) => kills >= t.kills).length;

/** Where one monster type stands. */
export interface MasteryState {
	/** Tiers reached by the kills, and claimed so far (never above reached) */
	reached: number;
	claimed: number;
	/** Reached and not claimed: the Claim button */
	claimable: number;
	/** The kills the next tier needs (null when every tier is reached) and the kills before it, so a bar can run between them */
	next: number | null;
	from: number;
	/** The layers of the entry the claimed tiers show: stats from the tier that reveals them (a UI gate, see `catalog/mastery.ts`) */
	showStats: boolean;
	showDrops: boolean;
}

/** The state of a monster type from its kills and how many tiers were claimed. A claimed count above what the kills reach (a bad row) is cut to what is reached. */
export const masteryState = (kills: number, claimed: number, tiers: readonly MasteryTier[] = MASTERY_TIERS): MasteryState => {
	const reached = masteryReached(kills, tiers);
	const taken = Math.max(0, Math.min(reached, Math.floor(claimed)));
	const next = tiers[reached]?.kills ?? null;
	const unlocked = tiers.slice(0, taken);
	return {
		reached,
		claimed: taken,
		claimable: reached - taken,
		next,
		from: reached > 0 ? tiers[reached - 1].kills : 0,
		showStats: unlocked.some((t) => t.reveal === 'stats'),
		showDrops: unlocked.some((t) => t.reveal === 'drops'),
	};
};

/** The state of a monster type on its own ladder (the boss ladder for a boss), from the kills and the claimed tiers. */
export const masteryStateOf = (type: string, kills: number, claimed: number): MasteryState => masteryState(kills, claimed, masteryTiersOf(type));

/** Tiers a type's kills reach on its own ladder. */
export const masteryReachedOf = (type: string, kills: number): number => masteryReached(kills, masteryTiersOf(type));

/** The bonus of every stat in percent (0 where there is none). */
export type MasteryTotals = Record<MasteryStat, number>;

export const noBonuses = (): MasteryTotals => ({ damage: 0, defense: 0, gold: 0, xp: 0, loot: 0 });

const addBonuses = (into: MasteryTotals, bonuses: readonly MasteryBonus[]): void => {
	for (const b of bonuses) into[b.stat] += b.value;
};

/**
 * What the mastery gives against one monster type: the bonuses of its claimed tiers plus the biome goal tiers claimed for its biome, each stat cut at `MASTERY_CAPS`. One pure function, used by the fight (damage dealt and taken), the kill reward (gold, XP, gear chance) and the Bestiary.
 *
 * @category Progression/Mastery
 * @order 3
 * @formula
 * bonus[stat] = min(MASTERY_CAPS[stat], sum of the bonuses of the claimed tiers of the type + sum of the bonuses of the claimed biome goals of its biome)
 */
export const masteryBonusesFor = (type: string, claimed: Readonly<Record<string, number>>, biomeClaimed: Readonly<Record<string, number>> = {}): MasteryTotals => {
	const total = noBonuses();
	const tiers = masteryTiersOf(type);
	const taken = Math.max(0, Math.min(tiers.length, Math.floor(claimed[type] ?? 0)));
	for (const tier of tiers.slice(0, taken)) addBonuses(total, tier.bonuses);
	const biome = biomeOfType(type);
	const goals = biome ? Math.max(0, Math.min(BIOME_GOALS.length, Math.floor(biomeClaimed[biome] ?? 0))) : 0;
	for (const goal of BIOME_GOALS.slice(0, goals)) addBonuses(total, goal.bonuses);
	for (const stat of MASTERY_STATS) total[stat] = Math.min(MASTERY_CAPS[stat], total[stat]);
	return total;
};

/** Where one biome's collection goal stands. */
export interface BiomeState {
	/** Monsters in the biome and how many reached each tier by kills */
	monsters: number;
	/** The goal tier every monster has reached (the lowest tier reached by any of them), and the goal tiers claimed */
	reached: number;
	claimed: number;
	claimable: number;
	/** The monsters that still hold the next goal tier back (ids), empty when every goal is reached */
	missing: readonly string[];
}

/** The goal state of one biome from the kill counts and how many goal tiers were claimed. A claimed count above what is reached is cut to what is reached. */
export const biomeState = (biome: string, kills: Readonly<Record<string, number>>, claimed: number): BiomeState => {
	const roster = biomeRoster(biome);
	const reachedBy = roster.map((id) => masteryReachedOf(id, kills[id] ?? 0));
	const reached = roster.length === 0 ? 0 : Math.min(BIOME_GOALS.length, ...reachedBy);
	const taken = Math.max(0, Math.min(reached, Math.floor(claimed)));
	const missing = reached >= BIOME_GOALS.length ? [] : roster.filter((_, i) => reachedBy[i] <= reached);
	return { monsters: roster.length, reached, claimed: taken, claimable: reached - taken, missing };
};
