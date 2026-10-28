import { SKILLS, type SkillDef, type SkillId } from '@/catalog/skills';
import { aggregateStats } from '@/lib/inventory';
import { magicDamagePercent, type Attributes } from '@/lib/statBonuses';
import { maxHp } from '@/lib/combat';
import type { CharacterStats, Equipment } from '@/types/game';

// Pure skill rules: what a cast does. The server's fight engine (lib/offline/fight.ts) decides whether and when it may be cast.

export const isSkillId = (value: unknown): value is SkillId => typeof value === 'string' && Object.hasOwn(SKILLS, value);

/** HP a Heal restores: its share of max HP, times the Intelligence bonus (the same one magic weapons get) and the gear's Spell Power. */
export const healAmount = (characterStats: CharacterStats, equipment: Equipment, skill: SkillDef = SKILLS.heal): number => {
	const base = maxHp(characterStats, equipment) * (skill.healFraction ?? 0);
	const attributes: Attributes = characterStats;
	const bonus = (1 + magicDamagePercent(attributes) / 100) * (1 + aggregateStats(equipment).spellPower / 100);
	return Math.max(1, Math.round(base * bonus));
};
