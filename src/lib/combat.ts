import { COMBAT, MONSTERS } from '@/config/combatConfig';
import { aggregateStats } from '@/lib/inventory';
import { monsterStats } from '@/lib/monsters';
import type { CharacterStats, Equipment, FightState, Monster } from '@/types/game';

// Pure combat rules. The store applies the results; nothing here touches state.

export const maxHp = (characterStats: CharacterStats, equipment: Equipment): number =>
	Math.round(COMBAT.baseHp + characterStats.hp + aggregateStats(equipment).maxHp);

/** One click = the weapon's damage (1 without a weapon). The stat rework extends this single hook. */
export const damagePerClick = (equipment: Equipment): number => Math.max(1, aggregateStats(equipment).damage);

export const armorOf = (equipment: Equipment): number => aggregateStats(equipment).armor;

export const mitigate = (rawDamage: number, armor: number): number =>
	Math.max(1, Math.round(rawDamage * (1 - armor / (armor + COMBAT.armorK))));

export const regen = (hp: number, max: number, dtSec: number): number => {
	if (!Number.isFinite(dtSec) || dtSec <= 0) return hp;
	return Math.min(max, hp + COMBAT.regenPerSec * dtSec);
};

export const newFight = (monster: Pick<Monster, 'id' | 'type' | 'tier'>): FightState => {
	const stats = monsterStats(monster.type, monster.tier);
	return {
		monsterId: monster.id,
		type: monster.type,
		tier: monster.tier,
		monsterHp: stats.maxHp,
		monsterMaxHp: stats.maxHp,
		attackTimer: 0,
		timeLeftSec: monster.type === 'ratKing' ? MONSTERS.ratKing.timeLimitSec : null,
		potionCd: 0,
		phase: 'active',
		summary: null,
		taunt: null,
	};
};

/** Subtracts click damage. The store decides what a kill means (`killed` only says the HP ran out). */
export const applyHit = (fight: FightState, damage: number): { fight: FightState; killed: boolean } => {
	if (fight.phase !== 'active') return { fight, killed: false };
	const monsterHp = Math.max(0, fight.monsterHp - damage);
	return { fight: { ...fight, monsterHp }, killed: monsterHp === 0 };
};

export type CombatEvent = { kind: 'hurt'; amount: number } | { kind: 'knockedOut' } | { kind: 'timeout' };

/**
 * Advances an active fight: monster attacks, potion cooldown and the king's timer. `dtSec` is clamped so a throttled
 * background tab slows the fight down instead of replaying minutes of attacks at once.
 */
export const stepFight = (
	fight: FightState,
	dtSec: number,
	playerHp: number,
	armor: number,
	rng: () => number
): { fight: FightState; playerHp: number; events: CombatEvent[] } => {
	if (fight.phase !== 'active' || !Number.isFinite(dtSec) || dtSec <= 0) return { fight, playerHp, events: [] };

	const dt = Math.min(dtSec, COMBAT.fightStepClampSec);
	const stats = monsterStats(fight.type, fight.tier);
	const events: CombatEvent[] = [];
	let hp = playerHp;
	let attackTimer = fight.attackTimer + dt;
	while (attackTimer >= stats.attackIntervalSec) {
		attackTimer -= stats.attackIntervalSec;
		const amount = mitigate(stats.attack, armor);
		hp = Math.max(0, hp - amount);
		events.push({ kind: 'hurt', amount });
		if (hp === 0) break;
	}

	let next: FightState = {
		...fight,
		attackTimer,
		potionCd: Math.max(0, fight.potionCd - dt),
		timeLeftSec: fight.timeLeftSec === null ? null : Math.max(0, fight.timeLeftSec - dt),
	};
	if (hp === 0) {
		next = { ...next, phase: 'knockedOut' };
		events.push({ kind: 'knockedOut' });
	} else if (next.timeLeftSec === 0) {
		const taunts = MONSTERS.ratKing.taunts;
		next = { ...next, phase: 'timeout', taunt: taunts[Math.floor(rng() * taunts.length) % taunts.length] };
		events.push({ kind: 'timeout' });
	}
	return { fight: next, playerHp: hp, events };
};
