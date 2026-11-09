import { COMBAT } from '@/config/combatConfig';
import { spawnLevelRange } from '@/lib/monsters';
import { limitOf } from '@/lib/limits';
import { estimateWin } from '@/lib/offline/winChance';
import type { PlayerProfile } from '@/lib/offline/fightTypes';
import type { MonsterType } from '@/types/game';

// How beatable a monster is for the player decides how often the server picks it for a new spawn (docs/plan/20-monster-families-and-rewards.md section 8, "relevance"): a new
// player on land of four biomes should meet mostly monsters worth fighting, with the scary ones still on the horizon. Pure maths on the
// frozen PlayerProfile; no random numbers, so a ticket places the same way for the same profile.

/** Win chance range that is worth a fight: full weight inside it. Below it a monster fades to `HOPELESS_WEIGHT`, above it to `TRIVIAL_WEIGHT`. */
export const WORTH_FIGHTING = { from: 0.4, to: 0.95 } as const;
/** Chance at (and below) which a monster has the lowest weight. */
const HOPELESS_AT = 0.05;
/** Never gone: a monster the player cannot beat still appears now and then (docs/plan/20-monster-families-and-rewards.md section 8). */
export const HOPELESS_WEIGHT = 0.1;
/** A monster that is no challenge any more is not rare, only a little less common. */
export const TRIVIAL_WEIGHT = 0.75;

/** The weight of a monster the player wins against with this chance (0-1). */
export const spawnWeight = (winChance: number): number => {
	const chance = Number.isFinite(winChance) ? Math.min(1, Math.max(0, winChance)) : 0;
	if (chance >= WORTH_FIGHTING.to) return 1 - ((1 - TRIVIAL_WEIGHT) * (chance - WORTH_FIGHTING.to)) / (1 - WORTH_FIGHTING.to);
	if (chance >= WORTH_FIGHTING.from) return 1;
	if (chance <= HOPELESS_AT) return HOPELESS_WEIGHT;
	return HOPELESS_WEIGHT + ((1 - HOPELESS_WEIGHT) * (chance - HOPELESS_AT)) / (WORTH_FIGHTING.from - HOPELESS_AT);
};

/** The chance the player beats a monster of this type at this level, starting from full HP and with no potions. */
export const winChanceAt = (profile: PlayerProfile, type: MonsterType, level: number): number => estimateWin(profile, profile.maxHp, type, level).chance;

/** The level the weights judge a type by: the middle of the window it appears in at this castle level. */
export const expectedSpawnLevel = (type: MonsterType, castleLevel: number): number => {
	const { min, max } = spawnLevelRange(type, castleLevel);
	return Math.round((min + max) / 2);
};

/**
 * Weight of each type for this player and castle level, in the order given.
 *
 * Which type spawns. Each type is weighted by the player's win chance against it ({@link estimateWin}) at the middle of its spawn window: full weight (1) for 40-95%, falling to 0.75 for a trivial monster (chance 1)
 * and to 0.1 for a hopeless one (chance <= 5%); equal weights give the plain uniform pick. The spawn level is capped at the highest level the player still beats (never below the window's bottom) and so is its growth (`growCap`),
 * for new spawns only. Bosses follow the same rules (IDL-222): among the boss types that have a free tile the pick is weighted and the level capped ({@link placeTickets}). Measured: `docs/generated/spawn-mix.md`.
 *
 * @category Monsters/Spawning
 * @order 3
 */
export const typeWeights = (profile: PlayerProfile, types: readonly MonsterType[], castleLevel: number): number[] =>
	types.map((type) => spawnWeight(winChanceAt(profile, type, expectedSpawnLevel(type, castleLevel))));

/**
 * Picks an index with probability proportional to its weight, from one roll in [0, 1). When all the weights are equal it is the plain
 * uniform pick `floor(roll * n)` (so a player to whom every type looks the same gets the map they always got).
 */
export const pickWeighted = (weights: readonly number[], roll: number): number => {
	const n = weights.length;
	if (weights.every((w) => w === weights[0])) return Math.floor(roll * n) % n;
	const total = weights.reduce((sum, w) => sum + w, 0);
	let left = roll * total;
	for (let i = 0; i < n; i++) {
		left -= weights[i];
		if (left < 0) return i;
	}
	return n - 1;
};

/** The highest level of this type the player still beats at least as often as not (`COMBAT.auto.minWinChance`), or `from - 1` when not even `from`. */
const beatableLevel = (profile: PlayerProfile, type: MonsterType, from: number, to: number): number => {
	let best = from - 1;
	for (let level = from; level <= to; level++) {
		if (winChanceAt(profile, type, level) < COMBAT.auto.minWinChance) break;
		best = level;
	}
	return best;
};

/** Highest spawn level worth rolling for a player: the highest the player beats, `Infinity` when the whole window is beatable. */
export const spawnLevelCap = (profile: PlayerProfile, type: MonsterType, castleLevel: number): number => {
	const { min, max } = spawnLevelRange(type, castleLevel);
	const best = beatableLevel(profile, type, min, max);
	return best >= max ? Infinity : best;
};

/**
 * How many levels a monster that appeared at `spawnLevel` may grow before it outgrows the player (it still has the full growth limit when the
 * player would beat it at every level it can reach). `undefined`: no cap.
 */
export const growthCap = (profile: PlayerProfile, type: MonsterType, spawnLevel: number): number | undefined => {
	const top = spawnLevel + limitOf('monsterGrowthLevels', {});
	const best = beatableLevel(profile, type, spawnLevel, top);
	return best >= top ? undefined : Math.max(0, best - spawnLevel);
};

/** A short fingerprint of how strong the player is, in coarse steps: a different one means the weights may differ, so the map is looked at again. */
export const powerKey = (profile: PlayerProfile): string => {
	const step = (value: number) => Math.round(Math.log(Math.max(1, value)) * 6);
	return `${step(profile.hit * profile.attacksPerSec)}.${step(profile.maxHp)}.${step(1 + profile.armor)}`;
};
