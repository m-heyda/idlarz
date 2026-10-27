// Skills: the things a character can cast with mana. Data only; the rules (damage-free, so nothing here touches the click combat)
// live in lib/skills.ts and the store's `castSkill`. Every number is here, and the tooltips are built from them.

export type SkillId = 'heal' | 'stun';

export interface SkillDef {
	id: SkillId;
	name: string;
	/** Character level that unlocks it */
	unlockLevel: number;
	manaCost: number;
	cooldownSec: number;
	/** Needs an open fight (Heal works anywhere) */
	fightOnly: boolean;
	/** Heal: share of max HP restored before the bonuses */
	healFraction?: number;
	/** Stun: seconds the monster's attack timer is frozen */
	stunSec?: number;
}

export const SKILLS: Record<SkillId, SkillDef> = {
	heal: { id: 'heal', name: 'Heal', unlockLevel: 5, manaCost: 20, cooldownSec: 12, fightOnly: false, healFraction: 0.25 },
	stun: { id: 'stun', name: 'Stun', unlockLevel: 10, manaCost: 15, cooldownSec: 15, fightOnly: true, stunSec: 3 },
};

/** The order they show in (hotkeys 4 and 5 in a fight). */
export const SKILL_IDS: readonly SkillId[] = ['heal', 'stun'];

const pct = (fraction: number) => `${Math.round(fraction * 100)}%`;

/** The static part of a tooltip, built from the numbers above so text and rules cannot drift apart. */
export const skillDescription = (skill: SkillDef): string =>
	skill.id === 'heal'
		? `Restores ${pct(skill.healFraction ?? 0)} of your max HP, more with Intelligence and Spell Power. Works in and out of fights.`
		: `Freezes the monster's attacks for ${skill.stunSec} s. Fights only.`;
