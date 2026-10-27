import { COMBAT, MONSTERS, type MonsterDef } from '@/config/combatConfig';
import { levelScale } from '@/catalog/stats';
import { castleLevelOf, isInWard } from '@/lib/castleWard';
import { limitOf, type LimitContext } from '@/lib/limits';
import { mulberry32, randomInt } from '@/lib/rng';
import type { Monster, MonsterType } from '@/types/game';
import { ownedRowMajor, type World } from '@/utils/world';

export interface MonsterStats {
	maxHp: number;
	attack: number;
	/** Reduces the damage of the player's clicks (same curve as the player's armor) */
	armor: number;
	/** % chance and multiplier of a crit on one of its hits */
	critChance: number;
	critMult: number;
	/** % chance that Stun does not work */
	stunResist: number;
	attackIntervalSec: number;
	rewardSec: number;
}

export const monsterDef = (type: MonsterType): MonsterDef => MONSTERS[type];

export const isBoss = (type: MonsterType): boolean => MONSTERS[type].grade === 'boss';

/** The levels a new monster of this type can appear at in a world of this castle level (both ends included). */
export const spawnLevelRange = (type: MonsterType, castleLevel = 1): { min: number; max: number } => {
	const { base, perCastleLevel, spread, cap } = MONSTERS[type].spawnWindow;
	const min = Math.max(1, Math.min(cap - spread, base + Math.floor(perCastleLevel * (Math.max(1, castleLevel) - 1))));
	return { min, max: Math.min(cap, min + spread) };
};

/**
 * The level a new monster starts at. Rolled from a generator seeded by its id and nothing else, so it takes no number from
 * Math.random (the rest of the game's randomness is the same with or without it) and the same monster always rolls the same.
 */
export const rollSpawnLevel = (type: MonsterType, castleLevel: number, monsterId: number): number => {
	const { min, max } = spawnLevelRange(type, castleLevel);
	return randomInt(mulberry32(monsterId * 2654435761 + 17), min, max);
};

/** A new monster standing on `spot`, at a level rolled for the world it appears in. */
export const newMonster = (type: MonsterType, id: number, spot: { x: number; y: number }, castleLevel: number): Monster => {
	const level = rollSpawnLevel(type, castleLevel, id);
	return { id, type, level, spawnLevel: level, x: spot.x, y: spot.y, ageSec: 0 };
};

/** The highest level a monster that appeared at `spawnLevel` can grow to. */
export const maxLevelOf = (spawnLevel: number, ctx: LimitContext = {}): number => spawnLevel + limitOf('monsterGrowthLevels', ctx);

/** The level of a monster of this age: its spawn level plus one per growth interval, up to the growth limit. */
export const levelAtAge = (spawnLevel: number, ageSec: number, ctx: LimitContext = {}): number =>
	spawnLevel + Math.min(limitOf('monsterGrowthLevels', ctx), Math.floor(Math.max(0, ageSec) / limitOf('monsterGrowthIntervalSec', ctx)));

/** Rounds .5 up even when the power of an irrational growth factor lands a hair below it (337.4999... is 338, like the old exact 1.5 per tier). */
const roundHalfUp = (value: number): number => Math.round(value + 1e-9);

/** HP, attack, armor, crit, stun resistance and reward of a monster at a level. Reward is income-based, so it does not scale with the world. */
export const monsterStats = (type: MonsterType, level: number): MonsterStats => {
	const d = monsterDef(type);
	const steps = Math.max(1, Math.floor(level)) - d.refLevel;
	const gear = d.scaling === 'gear' ? levelScale(Math.max(1, Math.floor(level))) / levelScale(d.refLevel) : null;
	return {
		maxHp: roundHalfUp(d.hp * (gear ?? Math.pow(d.hpPerLevel, steps))),
		attack: roundHalfUp(d.attack * (gear ?? Math.pow(d.attackPerLevel, steps))),
		armor: Math.max(0, d.armor + d.armorPerLevel * steps),
		critChance: d.critChance,
		critMult: d.critMult,
		stunResist: d.stunResist,
		attackIntervalSec: d.attackIntervalSec,
		rewardSec: d.rewardSec * Math.pow(d.rewardPerLevel, steps),
	};
};

export const monsterAt = (monsters: Monster[], x: number, y: number): Monster | undefined =>
	monsters.find((mon) => mon.x === x && mon.y === y);

/**
 * A random owned tile without the castle, a chest, a monster or a building on it, not a lake, and outside the castle's ward
 * from level 7. (A chest may lie on a lake - it is drawn as a glowing ripple there - but a monster cannot stand on water.)
 */
export const pickSpawnTile = (
	tiles: World,
	monsters: Monster[],
	rng: () => number
): { x: number; y: number } | null => {
	const taken = new Set(monsters.map((mon) => `${mon.x},${mon.y}`));
	const castleLevel = castleLevelOf(tiles);
	const eligible: { x: number; y: number }[] = [];
	for (const { x, y, tile } of ownedRowMajor(tiles)) {
		if (
			tile.biome !== 'castle' &&
			tile.biome !== 'lake' &&
			!tile.building &&
			!tile.hasChest &&
			!taken.has(`${x},${y}`) &&
			!isInWard(x, y, castleLevel)
		) {
			eligible.push({ x, y });
		}
	}
	return eligible.length === 0 ? null : eligible[Math.floor(rng() * eligible.length) % eligible.length];
};

/** Seconds the spawn timer must reach before the next monster appears. */
export const spawnThreshold = (nextMonsterId: number): number =>
	nextMonsterId === 1 ? COMBAT.spawn.firstSec : COMBAT.spawn.intervalSec;

/**
 * Ages every monster (except `frozenId`, the one being fought) and raises its level as it earns growth. There is no random
 * element: a monster of an age always has the same level.
 */
export const advanceMonsters = (monsters: Monster[], dtSec: number, frozenId: number | null, ctx: LimitContext = {}): Monster[] =>
	monsters.map((mon) => {
		if (mon.id === frozenId) return mon;
		const ageSec = mon.ageSec + dtSec;
		return { ...mon, ageSec, level: levelAtAge(mon.spawnLevel, ageSec, ctx) };
	});

/** Seconds until a monster gains its next level; null at the growth limit. */
export const growthSecondsLeft = (mon: Monster, ctx: LimitContext = {}): number | null => {
	if (mon.level >= maxLevelOf(mon.spawnLevel, ctx)) return null;
	const interval = limitOf('monsterGrowthIntervalSec', ctx);
	return interval * (mon.level - mon.spawnLevel + 1) - mon.ageSec;
};

/** Seconds the boss timer must reach before the next boss appears. */
export const bossThreshold = (): number => COMBAT.spawn.bossIntervalSec;

/** The kind of boss that appears next: one at a time, so the first kind that is not on the map (only the Rat King for now). */
export const nextBossType = (monsters: Monster[]): MonsterType | null =>
	(Object.keys(MONSTERS) as MonsterType[]).find((type) => isBoss(type) && !monsters.some((mon) => mon.type === type)) ?? null;
