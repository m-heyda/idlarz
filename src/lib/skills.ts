import { SKILLS, type SkillDef, type SkillId } from '@/catalog/skills';
import { aggregateStats } from '@/lib/inventory';
import { magicDamagePercent, type Attributes } from '@/lib/statBonuses';
import { maxHp } from '@/lib/combat';
import type { CharacterStats, Equipment, FightState } from '@/types/game';

// Pure skill rules: what a cast does and whether it may be cast. The store applies the result; nothing here touches state.

export type SkillCooldowns = Partial<Record<SkillId, number>>;

export const isSkillId = (value: unknown): value is SkillId => typeof value === 'string' && Object.hasOwn(SKILLS, value);

/** HP a Heal restores: its share of max HP, times the Intelligence bonus (the same one magic weapons get) and the gear's Spell Power. */
export const healAmount = (characterStats: CharacterStats, equipment: Equipment, skill: SkillDef = SKILLS.heal): number => {
	const base = maxHp(characterStats, equipment) * (skill.healFraction ?? 0);
	const attributes: Attributes = characterStats;
	const bonus = (1 + magicDamagePercent(attributes) / 100) * (1 + aggregateStats(equipment).spellPower / 100);
	return Math.max(1, Math.round(base * bonus));
};

export type CastRefusal = 'locked' | 'cooldown' | 'mana' | 'noFight' | 'fullHp';

/** Why a cast is refused (null when it can go). The reasons come in the order the UI should explain them. */
export const castRefusal = (
	id: SkillId,
	state: { level: number; mana: number; hp: number; maxHp: number; fight: FightState | null; cooldowns: SkillCooldowns }
): CastRefusal | null => {
	const skill = SKILLS[id];
	if (state.level < skill.unlockLevel) return 'locked';
	if (state.fight && state.fight.phase !== 'active') return 'noFight'; // a finished fight cannot be cast in
	if (skill.fightOnly && !state.fight) return 'noFight';
	if ((state.cooldowns[id] ?? 0) > 0) return 'cooldown';
	if (state.mana < skill.manaCost) return 'mana';
	if (id === 'heal' && state.hp >= state.maxHp) return 'fullHp';
	return null;
};

/** Cooldowns after `dtSec` have passed. */
export const tickCooldowns = (cooldowns: SkillCooldowns, dtSec: number): SkillCooldowns => {
	if (!Number.isFinite(dtSec) || dtSec <= 0) return cooldowns;
	const next: SkillCooldowns = {};
	for (const [id, left] of Object.entries(cooldowns) as [SkillId, number][]) if (left - dtSec > 0) next[id] = left - dtSec;
	return next;
};
