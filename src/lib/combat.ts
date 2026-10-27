import { ITEM_CATALOG } from '@/catalog';
import { COMBAT, STAT_RULES } from '@/config/combatConfig';
import { aggregateStats } from '@/lib/inventory';
import { monsterDef, monsterStats } from '@/lib/monsters';
import { atkSpeedPercent, critDamagePercent, magicDamagePercent, physicalDamagePercent, statArmor, statManaRegen, type Attributes } from '@/lib/statBonuses';
import type { CharacterStats, Equipment, FightState, Monster } from '@/types/game';

// Pure combat rules. The store applies the results; nothing here touches state.

export const maxHp = (characterStats: CharacterStats, equipment: Equipment): number =>
	Math.round(COMBAT.baseHp + characterStats.hp + aggregateStats(equipment).maxHp);

export type DamageType = 'physical' | 'magic';

/** Magic weapons (staves, wands) scale with Intelligence; everything else, bare hands included, with Strength. */
export const weaponDamageType = (equipment: Equipment): DamageType => {
	const base = equipment.mainHand?.base;
	const type = base ? ITEM_CATALOG[base]?.weaponType : undefined;
	return type && STAT_RULES.magicWeaponTypes.includes(type) ? 'magic' : 'physical';
};

/** The damage multiplier the attributes give with the worn weapon (1 for a character with no bonus, or when no attributes are given). */
export const damageMultiplier = (equipment: Equipment, stats?: Attributes): number => {
	if (!stats) return 1;
	const percent = weaponDamageType(equipment) === 'magic' ? magicDamagePercent(stats) : physicalDamagePercent(stats);
	return 1 + percent / 100;
};

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Damage of a plain click: the gear's total damage times the attribute bonus of the weapon's type (1 without a weapon). */
export const damagePerClick = (equipment: Equipment, stats?: Attributes): number =>
	Math.max(1, round1(aggregateStats(equipment).damage * damageMultiplier(equipment, stats)));

/** Attacks per second: the weapon's speed (1 bare-handed) and the Dexterity bonus. Clicks do not use it yet; the speed-based combat will. */
export const attacksPerSecond = (equipment: Equipment, stats?: Attributes): number => {
	const base = equipment.mainHand ? (ITEM_CATALOG[equipment.mainHand.base]?.attackSpeed ?? 1) : 1;
	return Math.round(base * (1 + (stats ? atkSpeedPercent(stats) : 0) / 100) * 100) / 100;
};

/** Damage per second at that speed: what the damage readout and, later, the fight are built on. */
export const damagePerSecond = (equipment: Equipment, stats?: Attributes): number =>
	Math.round(damagePerClick(equipment, stats) * attacksPerSecond(equipment, stats) * 100) / 100;

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
	const base = damagePerClick(equipment, characterStats);
	const odds = critOdds(characterStats, equipment);
	if (!(rng() >= 1 - odds.crit)) return { damage: base, crit: 'none' }; // high rolls crit, so a stubbed rng() of 0 never does
	const extra = 1 + critDamagePercent(characterStats) / 100; // Strength, Dexterity and Charisma points above 5 make crits hit harder
	if (rng() >= 1 - odds.superCrit) return { damage: Math.max(1, round1(base * COMBAT.crit.superMult * extra)), crit: 'super' };
	return { damage: Math.max(1, round1(base * COMBAT.crit.mult * extra)), crit: 'crit' };
};

/** Armor against monster hits: the gear's plus (when the attributes are given) what Dexterity, Vitality and Strength add. */
export const armorOf = (equipment: Equipment, stats?: Attributes): number => aggregateStats(equipment).armor + (stats ? statArmor(stats) : 0);

/** Mana: the attributes' pool plus the gear's. */
export const maxMana = (characterStats: CharacterStats, equipment: Equipment): number =>
	Math.round(characterStats.mp + aggregateStats(equipment).maxMana);

/** Mana per second, in and out of fights. */
export const manaRegenPerSec = (stats: Attributes, equipment: Equipment): number => statManaRegen(stats) + aggregateStats(equipment).manaRegen;

/** The gear's Life Leech in %, never above the cap. */
export const lifeLeechPercent = (equipment: Equipment): number => Math.min(STAT_RULES.lifeLeechCap, Math.max(0, aggregateStats(equipment).lifeLeech));

/** HP a click of `damage` gives back through Life Leech. */
export const leechHeal = (damage: number, equipment: Equipment): number => (damage * lifeLeechPercent(equipment)) / 100;

/**
 * The share (0-0.75) of a hit that `armor` takes away: armor / (armor + K) up to 50 %, then every further point counts half as much,
 * so no amount of armor makes anything unkillable (the asymptote is 75 %).
 */
export const armorReduction = (armor: number): number => {
	if (!(armor > 0)) return 0;
	const raw = armor / (armor + COMBAT.armorK);
	const { armorSoftCap: cap, armorSoftSlope: slope } = COMBAT;
	return raw <= cap ? raw : cap + (raw - cap) * slope;
};

export const mitigate = (rawDamage: number, armor: number): number =>
	Math.max(1, Math.round(rawDamage * (1 - armorReduction(armor))));

/** HP regeneration outside fights: the base rate plus the gear's regen stat. */
export const regen = (hp: number, max: number, dtSec: number, gearRegenPerSec = 0): number => {
	if (!Number.isFinite(dtSec) || dtSec <= 0) return hp;
	return Math.min(max, hp + (COMBAT.regenPerSec + gearRegenPerSec) * dtSec);
};

export const newFight = (monster: Pick<Monster, 'id' | 'type' | 'level'>): FightState => {
	const stats = monsterStats(monster.type, monster.level);
	return {
		monsterId: monster.id,
		type: monster.type,
		level: monster.level,
		monsterHp: stats.maxHp,
		monsterMaxHp: stats.maxHp,
		attackTimer: 0,
		timeLeftSec: monsterDef(monster.type).timeLimitSec ?? null,
		potionCd: 0,
		stunLeftSec: 0,
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

/** What a monster that mocks the player says (null for the ones that do not talk). */
const pickTaunt = (type: Monster['type'], rng: () => number): string | null => {
	const taunts = monsterDef(type).taunts;
	return taunts && taunts.length > 0 ? taunts[Math.floor(rng() * taunts.length) % taunts.length] : null;
};

/** What is left of a click after the monster's armor (never less than 1): the same curve as the player's own armor. */
export const damageAfterArmor = (fight: Pick<FightState, 'type' | 'level'>, raw: number): number => {
	const { armor } = monsterStats(fight.type, fight.level);
	return armor > 0 ? Math.max(1, round1(raw * (1 - armorReduction(armor)))) : raw;
};

/** Whether the monster shrugs off a Stun (one rng call, and only for monsters that can resist at all). */
export const stunResisted = (fight: Pick<FightState, 'type' | 'level'>, rng: () => number): boolean => {
	const { stunResist } = monsterStats(fight.type, fight.level);
	return stunResist > 0 && rng() * 100 < stunResist;
};

/** Chance (0-1) that a monster's hit misses: the gear's Dodge, capped. */
export const dodgeChance = (equipment: Equipment): number =>
	Math.max(0, Math.min(COMBAT.maxDodge, aggregateStats(equipment).dodge)) / 100;

export type CombatEvent = { kind: 'hurt'; amount: number; crit: boolean } | { kind: 'dodged' } | { kind: 'knockedOut' } | { kind: 'timeout' };

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
	gearRegen: { perSec: number; max: number } = { perSec: 0, max: Infinity },
	/** Chance (0-1) that a monster's hit misses; rolled (one rng call per hit) only when above 0, so high rolls dodge like they crit */
	dodge = 0
): { fight: FightState; playerHp: number; events: CombatEvent[] } => {
	if (fight.phase !== 'active' || !Number.isFinite(dtSec) || dtSec <= 0) return { fight, playerHp, events: [] };

	const dt = Math.min(dtSec, COMBAT.fightStepClampSec);
	const stats = monsterStats(fight.type, fight.level);
	const events: CombatEvent[] = [];
	let hp = playerHp;
	// A stunned monster does not wind up its next attack; the stun runs down first and only the rest of the step counts
	const stunned = Math.min(fight.stunLeftSec, dt);
	let attackTimer = fight.attackTimer + (dt - stunned);
	while (attackTimer >= stats.attackIntervalSec) {
		attackTimer -= stats.attackIntervalSec;
		if (dodge > 0 && rng() >= 1 - dodge) {
			events.push({ kind: 'dodged' });
			continue;
		}
		// a monster that can crit rolls once per hit (high rolls crit, so a stubbed rng() of 0 never does)
		const crit = stats.critChance > 0 && rng() >= 1 - stats.critChance / 100;
		const amount = mitigate(crit ? Math.round(stats.attack * stats.critMult) : stats.attack, armor);
		hp = Math.max(0, hp - amount);
		events.push({ kind: 'hurt', amount, crit });
		if (hp === 0) break;
	}
	if (hp > 0 && gearRegen.perSec > 0) hp = Math.min(gearRegen.max, hp + gearRegen.perSec * dt);

	let next: FightState = {
		...fight,
		attackTimer,
		potionCd: Math.max(0, fight.potionCd - dt),
		stunLeftSec: fight.stunLeftSec - stunned,
		timeLeftSec: fight.timeLeftSec === null ? null : Math.max(0, fight.timeLeftSec - dt),
	};
	if (hp === 0) {
		// the King gloats about a knockout as well as about a timeout
		next = { ...next, phase: 'knockedOut', taunt: pickTaunt(fight.type, rng) };
		events.push({ kind: 'knockedOut' });
	} else if (next.timeLeftSec === 0) {
		next = { ...next, phase: 'timeout', taunt: pickTaunt(fight.type, rng) };
		events.push({ kind: 'timeout' });
	}
	return { fight: next, playerHp: hp, events };
};
