import { COMBAT, MONSTERS } from '@/config/combatConfig';
import type { Monster, MonsterType, Tile } from '@/types/game';

export interface MonsterStats {
	maxHp: number;
	attack: number;
	attackIntervalSec: number;
	rewardSec: number;
}

/** HP, attack and reward of a monster at a tier (the Rat King ignores the tier). */
export const monsterStats = (type: MonsterType, tier: number): MonsterStats => {
	if (type === 'ratKing') {
		const k = MONSTERS.ratKing;
		return { maxHp: k.hp, attack: k.attack, attackIntervalSec: k.attackIntervalSec, rewardSec: k.rewardSec };
	}
	const r = MONSTERS.rat;
	const t = Math.max(1, Math.min(COMBAT.maxTier, Math.floor(tier))) - 1;
	return {
		maxHp: Math.round(r.hp * Math.pow(r.hpGrowth, t)),
		attack: Math.round(r.attack * Math.pow(r.attackGrowth, t)),
		attackIntervalSec: r.attackIntervalSec,
		rewardSec: r.rewardSec * Math.pow(r.rewardGrowth, t),
	};
};

export const tierFor = (type: MonsterType, ageSec: number): number =>
	type === 'ratKing' ? 1 : Math.min(COMBAT.maxTier, 1 + Math.floor(Math.max(0, ageSec) / COMBAT.tierIntervalSec));

export const monsterAt = (monsters: Monster[], x: number, y: number): Monster | undefined =>
	monsters.find((mon) => mon.x === x && mon.y === y);

/** A random owned tile without the castle, a chest or a monster on it. */
export const pickSpawnTile = (
	tiles: Tile[][],
	monsters: Monster[],
	rng: () => number
): { x: number; y: number } | null => {
	const taken = new Set(monsters.map((mon) => `${mon.x},${mon.y}`));
	const eligible: { x: number; y: number }[] = [];
	tiles.forEach((row, y) =>
		row.forEach((tile, x) => {
			if (tile.isOwned && tile.biome !== 'castle' && !tile.hasChest && !taken.has(`${x},${y}`)) {
				eligible.push({ x, y });
			}
		})
	);
	return eligible.length === 0 ? null : eligible[Math.floor(rng() * eligible.length) % eligible.length];
};

/** Seconds the spawn timer must reach before the next monster appears. */
export const spawnThreshold = (nextMonsterId: number): number =>
	nextMonsterId === 1 ? COMBAT.spawn.firstSec : COMBAT.spawn.intervalSec;

const TIER_CAP_AGE = (COMBAT.maxTier - 1) * COMBAT.tierIntervalSec;
// Number of evolution checks a rat of this age has passed (the first one comes evolveCheckSec after the last tier)
const evolveChecks = (ageSec: number) =>
	Math.max(0, Math.floor((ageSec - TIER_CAP_AGE) / MONSTERS.ratKing.evolveCheckSec));

/**
 * Ages every monster (except `frozenId`, the one being fought), recomputes tiers and rolls the Rat King evolution
 * for rats that passed an evolution check. At most one king exists and at most one rat evolves per call.
 */
export const advanceMonsters = (
	monsters: Monster[],
	dtSec: number,
	rng: () => number,
	frozenId: number | null
): Monster[] => {
	let kingExists = monsters.some((mon) => mon.type === 'ratKing');
	return monsters.map((mon) => {
		if (mon.id === frozenId || mon.type === 'ratKing') return mon;
		const ageSec = mon.ageSec + dtSec;
		const aged: Monster = { ...mon, ageSec, tier: tierFor('rat', ageSec) };
		if (!kingExists) {
			for (let i = evolveChecks(mon.ageSec); i < evolveChecks(ageSec); i++) {
				if (rng() < MONSTERS.ratKing.evolveChance) {
					kingExists = true;
					return { ...aged, type: 'ratKing', tier: 1 };
				}
			}
		}
		return aged;
	});
};

/** Seconds until a rat gains its next tier; null for the king and for a rat at the last tier. */
export const tierSecondsLeft = (mon: Monster): number | null =>
	mon.type === 'ratKing' || mon.tier >= COMBAT.maxTier
		? null
		: COMBAT.tierIntervalSec * mon.tier - mon.ageSec;
