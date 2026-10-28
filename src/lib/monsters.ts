import { COMBAT, MONSTERS, type MonsterDef } from '@/config/combatConfig';
import { levelScale } from '@/catalog/stats';
import { CASTLE_X, CASTLE_Y } from '@/config/gameConfig';
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
	/** Attacks per second */
	attackSpeed: number;
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
export const rollSpawnLevel = (type: MonsterType, castleLevel: number, monsterId: number, distance = 0): number => {
	const { min, max } = spawnLevelRange(type, castleLevel);
	const bonus = dangerBonus(distance);
	const cap = MONSTERS[type].spawnWindow.cap;
	return randomInt(mulberry32(monsterId * 2654435761 + 17), Math.min(cap, min + bonus), Math.min(cap, max + bonus));
};

/** Levels added to a monster that appears `distance` tiles (Chebyshev) from the castle: danger grows toward the frontier. */
export const dangerBonus = (distance: number): number => Math.floor(Math.max(0, Number.isFinite(distance) ? distance : 0) / COMBAT.spawn.dangerStep);

/** How far a tile is from the castle, the way the chest placement and the danger bonus measure it. */
export const castleDistance = (spot: { x: number; y: number }): number => Math.max(Math.abs(spot.x - CASTLE_X), Math.abs(spot.y - CASTLE_Y));

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
		attackSpeed: d.attackSpeed,
		rewardSec: d.rewardSec * Math.pow(d.rewardPerLevel, steps),
	};
};

export const monsterAt = (monsters: Monster[], x: number, y: number): Monster | undefined =>
	monsters.find((mon) => mon.x === x && mon.y === y);

/**
 * Whether a monster of this type may stand on this tile: the biome is on its allowlist, the tile is within its castle distance
 * (Chebyshev), and nothing else is there (castle ward, building, chest, another monster). The rules are `MonsterDef.spawn`.
 */
export const canSpawnOn = (
	type: MonsterType,
	x: number,
	y: number,
	tile: { biome: string; building?: string; hasChest?: boolean },
	castleLevel: number,
	rebirths = 0
): boolean => {
	const rule = monsterDef(type).spawn;
	if (rebirths < (rule.minRebirths ?? 0)) return false;
	if (!(rule.biomes as readonly string[]).includes(tile.biome)) return false;
	const distance = castleDistance({ x, y });
	return distance >= rule.minCastleDistance && distance <= rule.maxCastleDistance && !tile.building && !tile.hasChest && !isInWard(x, y, castleLevel);
};

/** Every owned tile a monster of this type may appear on, not counting the `taken` ones ("x,y" keys of monsters already standing). */
export const spawnTiles = (type: MonsterType, tiles: World, taken: ReadonlySet<string>, rebirths = 0): { x: number; y: number }[] => {
	const castleLevel = castleLevelOf(tiles);
	const eligible: { x: number; y: number }[] = [];
	for (const { x, y, tile } of ownedRowMajor(tiles)) {
		if (!taken.has(`${x},${y}`) && canSpawnOn(type, x, y, tile, castleLevel, rebirths)) eligible.push({ x, y });
	}
	return eligible;
};

/** A random tile of `spawnTiles`, or null when there is none. */
export const pickSpawnTile = (type: MonsterType, tiles: World, taken: ReadonlySet<string>, rng: () => number, rebirths = 0): { x: number; y: number } | null => {
	const eligible = spawnTiles(type, tiles, taken, rebirths);
	return eligible.length === 0 ? null : eligible[Math.floor(rng() * eligible.length) % eligible.length];
};

/**
 * Ages every monster and raises its level as it earns growth. There is no random element: a monster of an age always has the
 * same level. (The server ages its tickets the same way; this keeps the picture on the map moving between two answers.)
 */
export const advanceMonsters = (monsters: Monster[], dtSec: number, ctx: LimitContext = {}): Monster[] =>
	monsters.map((mon) => {
		const ageSec = mon.ageSec + dtSec;
		return { ...mon, ageSec, level: levelAtAge(mon.spawnLevel, ageSec, ctx) };
	});

/** Seconds until a monster gains its next level; null at the growth limit. */
export const growthSecondsLeft = (mon: Monster, ctx: LimitContext = {}): number | null => {
	if (mon.level >= maxLevelOf(mon.spawnLevel, ctx)) return null;
	const interval = limitOf('monsterGrowthIntervalSec', ctx);
	return interval * (mon.level - mon.spawnLevel + 1) - mon.ageSec;
};

