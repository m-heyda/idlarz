import { COMBAT, MONSTERS } from '@/config/combatConfig';
import { aggregateStats } from '@/lib/inventory';
import { monsterStats } from '@/lib/monsters';
import type { CharacterStats, Equipment, FightState, Monster } from '@/types/game';

// Pure combat rules. The store applies the results; nothing here touches state.

export const maxHp = (characterStats: CharacterStats, equipment: Equipment): number =>
	Math.round(COMBAT.baseHp + characterStats.hp + aggregateStats(equipment).maxHp);

/** Damage of a plain click: the gear's total damage (1 without a weapon). */
export const damagePerClick = (equipment: Equipment): number => Math.max(1, aggregateStats(equipment).damage);

export type CritKind = 'none' | 'crit' | 'super';

const clampPct = (pct: number, max: number) => Math.max(0, Math.min(max, pct)) / 100;

/** Chance (0-1) that a click crits, and that a crit becomes a super crit: character crit plus gear. */
export const critOdds = (characterStats: CharacterStats, equipment: Equipment): { crit: number; superCrit: number } => {
	const gear = aggregateStats(equipment);
	return {
		crit: clampPct((characterStats.critChance || 0) + gear.critChance, COMBAT.crit.maxCritChance),
		superCrit: clampPct(COMBAT.crit.superBase + gear.superCrit, COMBAT.crit.maxSuperChance),
	};
};

/** One click: the base damage, times the crit or super crit multiplier. Two random numbers at most (the second only on a crit). */
export const rollHit = (
	characterStats: CharacterStats,
	equipment: Equipment,
	rng: () => number
): { damage: number; crit: CritKind } => {
	const base = damagePerClick(equipment);
	const odds = critOdds(characterStats, equipment);
	if (!(rng() >= 1 - odds.crit)) return { damage: base, crit: 'none' }; // high rolls crit, so a stubbed rng() of 0 never does
	if (rng() >= 1 - odds.superCrit) return { damage: Math.max(1, Math.round(base * COMBAT.crit.superMult)), crit: 'super' };
	return { damage: Math.max(1, Math.round(base * COMBAT.crit.mult)), crit: 'crit' };
};

export const armorOf = (equipment: Equipment): number => aggregateStats(equipment).armor;

export const mitigate = (rawDamage: number, armor: number): number =>
	Math.max(1, Math.round(rawDamage * (1 - armor / (armor + COMBAT.armorK))));

/** HP regeneration outside fights: the base rate plus the gear's regen stat. */
export const regen = (hp: number, max: number, dtSec: number, gearRegenPerSec = 0): number => {
	if (!Number.isFinite(dtSec) || dtSec <= 0) return hp;
	return Math.min(max, hp + (COMBAT.regenPerSec + gearRegenPerSec) * dtSec);
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

const pickTaunt = (rng: () => number): string => {
	const taunts = MONSTERS.ratKing.taunts;
	return taunts[Math.floor(rng() * taunts.length) % taunts.length];
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
	rng: () => number,
	/** Gear regen works in fights too (the base regen does not); `max` caps the healing */
	gearRegen: { perSec: number; max: number } = { perSec: 0, max: Infinity }
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
	if (hp > 0 && gearRegen.perSec > 0) hp = Math.min(gearRegen.max, hp + gearRegen.perSec * dt);

	let next: FightState = {
		...fight,
		attackTimer,
		potionCd: Math.max(0, fight.potionCd - dt),
		timeLeftSec: fight.timeLeftSec === null ? null : Math.max(0, fight.timeLeftSec - dt),
	};
	if (hp === 0) {
		// the King gloats about a knockout as well as about a timeout
		next = { ...next, phase: 'knockedOut', taunt: fight.type === 'ratKing' ? pickTaunt(rng) : null };
		events.push({ kind: 'knockedOut' });
	} else if (next.timeLeftSec === 0) {
		next = { ...next, phase: 'timeout', taunt: pickTaunt(rng) };
		events.push({ kind: 'timeout' });
	}
	return { fight: next, playerHp: hp, events };
};
