import { COMBAT, MONSTERS, type BossModifiers, type MonsterDef } from '@/config/combatConfig';
import { levelScale, levelTail } from '@/catalog/stats';
import { castleLevelOf, isInWard } from '@/lib/castleWard';
import { bandOf, castleDistance } from '@/lib/distance';
import { limitOf, type LimitContext } from '@/lib/limits';
import { mulberry32, randomInt } from '@/lib/rng';
import type { Monster, MonsterType } from '@/types/game';
import { ownedRowMajor, type World } from '@/utils/world';

export interface MonsterStats {
	maxHp: number;
	attack: number;
	/** Reduces the damage of every hit the player lands (same curve as the player's armor) */
	armor: number;
	/** % chance and multiplier of a crit on one of its hits */
	critChance: number;
	critMult: number;
	/** % chance that Stun does not work */
	stunResist: number;
	/** Attacks per second */
	attackSpeed: number;
}

export const monsterDef = (type: MonsterType): MonsterDef => MONSTERS[type];

export const isBoss = (type: MonsterType): boolean => MONSTERS[type].grade === 'boss';

/** What sets a boss apart in a fight (`MonsterDef.modifiers`); empty for every monster without any. */
export const modifiersOf = (type: MonsterType): BossModifiers => (MONSTERS[type] as MonsterDef).modifiers ?? {};

/** The shared potion cooldown inside a fight with this monster: `base` times the Sluggish multiplier, if it has one. */
export const potionCooldownAgainst = (type: MonsterType, base: number): number => base * (modifiersOf(type).sluggish?.potionCooldownMult ?? 1);

/** How many Enrage steps a fight has reached after `elapsedSec`: one per `everySec`, up to `maxSteps` (0 without the modifier). */
export const enrageSteps = (type: MonsterType, elapsedSec: number): number => {
	const e = modifiersOf(type).enrage;
	return e ? Math.min(e.maxSteps, Math.max(0, Math.floor(elapsedSec / e.everySec))) : 0;
};

/**
 * The levels a new monster of this type can appear at in a world of this castle level (both ends included).
 *
 * Spawn window. Plains normal: base 1, +1 per castle level, spread 2, cap 10; coast 2/+1/2/12; forest 4/+1/2/14; hills 6/+1/2/16; swamp 8/+1/2/18; lake 10/+1/2/19; tundra 12/+0.5/2/20. Bosses: base 15 / 17 / 20 / 22 / 25 / 27 / 30 (plains, coast, forest, hills, swamp, lake, tundra), +0.8 per castle level, spread 3, cap base + 10.
 *
 * @category Monsters/Level scaling
 * @order 2
 * @formula
 * min = max(1, min(cap - spread, base + floor(perCastleLevel x (castle level - 1))))
 * max = min(cap, min + spread)
 */
export const spawnLevelRange = (type: MonsterType, castleLevel = 1, rebirths = 0): { min: number; max: number } => {
	const { base, perCastleLevel, spread, cap } = MONSTERS[type].spawnWindow;
	const min = Math.max(1, Math.min(cap - spread, base + Math.floor(perCastleLevel * (Math.max(1, castleLevel) - 1))));
	const lift = rebirthLevelBonus(rebirths);
	return { min: min + lift, max: Math.min(cap, min + spread) + lift };
};

/**
 * Levels every spawn window and cap rises by after completed rebirths (owner 2026-11-27: a level 100 hero after four rebirths met level ~20 monsters): `COMBAT.spawn.levelsPerRebirth` (4) per rebirth, so a plains monster of castle level 5 is level 5-7 at rebirth 0 and 21-23 at rebirth 4. 0 for a first run.
 *
 * @category Monsters/Level scaling
 * @order 1
 * @formula
 * bonus = 4 x rebirths      (added to the window's min, max and to the type's cap)
 */
export const rebirthLevelBonus = (rebirths = 0): number => COMBAT.spawn.levelsPerRebirth * Math.max(0, Math.floor(Number.isFinite(rebirths) ? rebirths : 0));

/**
 * The level a new monster starts at. Rolled from a generator seeded by its id and nothing else, so it takes no number from
 * Math.random (the rest of the game's randomness is the same with or without it) and the same monster always rolls the same.
 * `levelCap` (optional) is the highest level the player can still beat (see offline/spawnWeights.ts): a roll above it comes down to it, never below `min`.
 *
 * The level is rolled from a generator seeded by the monster's ticket number only, plus a **danger bonus** of 1 level per 8 tiles of Chebyshev distance from the castle ({@link dangerBonus}, `COMBAT.spawn.dangerStep`).
 * The per-band `dangerOffset` of `DISTANCE_BANDS` is added to it (frontier +1, wilds +2), and every completed rebirth lifts the window and the cap by {@link rebirthLevelBonus} levels.
 *
 * @category Monsters/Level scaling
 * @order 3
 */
export const rollSpawnLevel = (type: MonsterType, castleLevel: number, monsterId: number, distance = 0, levelCap?: number, rebirths = 0): number => {
	const { min, max } = spawnLevelRange(type, castleLevel, rebirths);
	const bonus = dangerBonus(distance) + bandOf(distance).dangerOffset;
	const cap = MONSTERS[type].spawnWindow.cap + rebirthLevelBonus(rebirths);
	const lo = Math.min(cap, min + bonus);
	const rolled = randomInt(mulberry32(monsterId * 2654435761 + 17), lo, Math.min(cap, max + bonus));
	// a weak player's cap pulls the roll down, but never below the bottom of the window (the roll itself is the same with or without a cap)
	return levelCap === undefined ? rolled : Math.max(lo, Math.min(rolled, levelCap));
};

/**
 * Levels added to a monster that appears `distance` tiles (Chebyshev) from the castle: danger grows toward the frontier.
 *
 * @category Monsters/Level scaling
 * @order 5
 * @formula
 * danger bonus = floor(Chebyshev distance from the castle / 8) levels
 */
export const dangerBonus = (distance: number): number => Math.floor(Math.max(0, Number.isFinite(distance) ? distance : 0) / COMBAT.spawn.dangerStep);

/** How many levels a monster can grow: the growth limit, or less when the server capped it for a weak player (`growCap`, set when it appeared). */
const growthLevels = (ctx: LimitContext, growCap?: number): number => Math.min(limitOf('monsterGrowthLevels', ctx), growCap ?? Infinity);

/** The highest level a monster that appeared at `spawnLevel` can grow to. */
export const maxLevelOf = (spawnLevel: number, ctx: LimitContext = {}, growCap?: number): number => spawnLevel + growthLevels(ctx, growCap);

/**
 * The level of a monster of this age: its spawn level plus one per growth interval, up to the growth limit.
 *
 * Growth: +1 level per 900 s on the map (`LIMITS.monsterGrowthIntervalSec`), at most +10 above the spawn level (`LIMITS.monsterGrowthLevels`, hard 40). The level is a function of age.
 * A monster whose spawn was capped for a weak player has a smaller `growCap`.
 *
 * @category Monsters/Level scaling
 * @order 4
 * @formula
 * level = spawnLevel + min(growthLevels, floor(ageSec / 900))
 */
export const levelAtAge = (spawnLevel: number, ageSec: number, ctx: LimitContext = {}, growCap?: number): number =>
	spawnLevel + Math.min(growthLevels(ctx, growCap), Math.floor(Math.max(0, ageSec) / limitOf('monsterGrowthIntervalSec', ctx)));

/** Rounds .5 up even when the power of an irrational growth factor lands a hair below it (337.4999... is 338, like the old exact 1.5 per tier). */
const roundHalfUp = (value: number): number => Math.round(value + 1e-9);

/**
 * HP, attack, armor, crit and stun resistance of a monster at a level (the reward is `monsterReward`).
 *
 * Level scaling: a monster has an integer level. Stats follow `monsterStats`.
 *
 * - **Normal** (`scaling: 'exp'`): `HP = round(hp x sqrt(1.5)^(level-1))`, `attack = round(attack x sqrt(1.25)^(level-1))`, `armor = armor + 0.5 x (level-1)`. A level 9 plains monster has 506 HP.
 * - **Boss** (`scaling: 'gear'`): HP and attack `x levelScale(level) / levelScale(refLevel)` (`1 + 0.07 x (level - 1)`, `src/catalog/stats.ts`); armor `+0.5` per level away from `refLevel`. The plains boss has 1,000 HP and 11 attack at level 15.
 * - Reference levels: plains 15, coast 17, forest 20, hills 22, swamp 25, lake 27, tundra 30.
 * - Boss modifiers ({@link BossModifiers}): **Brutal** raises `attack` by its %, **Enrage** raises `attackSpeed` by its % for every step the fight has reached (`elapsedSec`, one step per `everySec`, a maximum of `maxSteps`).
 *
 * @category Monsters/Level scaling
 * @order 1
 * @formula
 * normal: HP     = round(hp     x sqrt(1.5)^(level - 1))
 *         attack = round(attack x sqrt(1.25)^(level - 1))
 *         armor  = armor + 0.5 x (level - 1)
 * boss:   HP, attack = base x levelScale(level) / levelScale(refLevel)         levelScale(L) = 1 + 0.07 x (L - 1)
 *         armor  = armor + 0.5 x (level - refLevel)
 * Brutal: attack      x (1 + attackPct / 100)
 * Enrage: attackSpeed x (1 + speedPct / 100 x steps)        steps = min(maxSteps, floor(elapsedSec / everySec))
 */
export const monsterStats = (type: MonsterType, level: number, elapsedSec = 0): MonsterStats => {
	const d = monsterDef(type);
	const steps = Math.max(1, Math.floor(level)) - d.refLevel;
	const gear = d.scaling === 'gear' ? (levelScale(Math.max(1, Math.floor(level))) * levelTail(level)) / (levelScale(d.refLevel) * levelTail(d.refLevel)) : null;
	return {
		maxHp: roundHalfUp(d.hp * (gear ?? Math.pow(d.hpPerLevel, steps))),
		attack: roundHalfUp(d.attack * (gear ?? Math.pow(d.attackPerLevel, steps)) * (1 + (d.modifiers?.brutal?.attackPct ?? 0) / 100)),
		armor: Math.max(0, d.armor + d.armorPerLevel * steps),
		critChance: d.critChance,
		critMult: d.critMult,
		stunResist: d.stunResist,
		attackSpeed: d.attackSpeed * (1 + ((d.modifiers?.enrage?.speedPct ?? 0) / 100) * enrageSteps(type, elapsedSec)),
	};
};

/** The reward block of a monster at a level: the multiplier `levelMult^(level - refLevel)` that applies to its gold and XP (see `MonsterDef.reward`). */
export const rewardLevelMult = (type: MonsterType, level: number): number => {
	const d = monsterDef(type);
	return Math.pow(d.reward.levelMult, Math.max(1, Math.floor(level)) - d.refLevel);
};

export const monsterAt = (monsters: Monster[], x: number, y: number): Monster | undefined => monsters.find((mon) => mon.x === x && mon.y === y);

/**
 * Whether a monster of this type may stand on this tile: the biome is on its allowlist, the tile is within its castle distance
 * (Chebyshev), and nothing else is there (castle ward, chest, another monster). The rules are `MonsterDef.spawn`.
 *
 * The tile: an owned tile whose biome is in the monster's list (`MonsterDef.spawn`), Chebyshev distance from the castle 2 to 9 (`minCastleDistance`, `maxCastleDistance`), no chest, no other monster,
 * outside the castle ward from castle level 7. `minRebirths` exists in the rule but no monster uses it.
 *
 * @category Monsters/Spawning
 * @order 2
 */
export const canSpawnOn = (
	type: MonsterType,
	x: number,
	y: number,
	tile: { biome: string; hasChest?: boolean },
	castleLevel: number,
	rebirths = 0,
): boolean => {
	const def = monsterDef(type);
	if (def.retired) return false; // a stand-in the real art replaced: it never appears again
	const rule = def.spawn;
	if (rebirths < (rule.minRebirths ?? 0)) return false;
	if (!(rule.biomes as readonly string[]).includes(tile.biome)) return false;
	const distance = castleDistance({ x, y });
	return distance >= rule.minCastleDistance && distance <= rule.maxCastleDistance && !tile.hasChest && !isInWard(x, y, castleLevel);
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
export const pickSpawnTile = (
	type: MonsterType,
	tiles: World,
	taken: ReadonlySet<string>,
	rng: () => number,
	rebirths = 0,
): { x: number; y: number } | null => {
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
		return { ...mon, ageSec, level: levelAtAge(mon.spawnLevel, ageSec, ctx, mon.growCap) };
	});

/** Where a monster is on its way to full size: its top level, whether it is there, the time to the next level and the share of this level's wait that has passed. */
export interface GrowthInfo {
	max: number;
	maxed: boolean;
	leftSec: number | null;
	/** 0 just after a level, 1 when the next one comes (always 1 at the top) */
	fraction: number;
}

export const growthInfo = (mon: Pick<Monster, 'level' | 'spawnLevel' | 'ageSec' | 'growCap'>, ctx: LimitContext = {}): GrowthInfo => {
	const max = maxLevelOf(mon.spawnLevel, ctx, mon.growCap);
	if (mon.level >= max) return { max, maxed: true, leftSec: null, fraction: 1 };
	const interval = limitOf('monsterGrowthIntervalSec', ctx);
	const leftSec = Math.max(0, interval * (mon.level - mon.spawnLevel + 1) - mon.ageSec);
	return { max, maxed: false, leftSec, fraction: Math.min(1, Math.max(0, 1 - leftSec / interval)) };
};

/** Seconds until a monster gains its next level; null at the growth limit. */
export const growthSecondsLeft = (mon: Monster, ctx: LimitContext = {}): number | null => {
	if (mon.level >= maxLevelOf(mon.spawnLevel, ctx, mon.growCap)) return null;
	const interval = limitOf('monsterGrowthIntervalSec', ctx);
	return interval * (mon.level - mon.spawnLevel + 1) - mon.ageSec;
};
