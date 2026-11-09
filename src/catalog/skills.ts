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

/**
 * Potions and skills.
 *
 * - Potions (`healHp` in the item catalog): Minor Healing 35 HP, Greater Healing 90 HP; they work in and out of fights, share an 8 s cooldown inside a fight (`COMBAT.potionCooldownSec`), cannot be drunk at full HP. Hotkeys 1-3 are requests the server checks.
 * - Skills, mana spent on cast, cooldown after: **Heal** (level 5, 20 mana, 12 s) restores `25% of max HP x (1 + magic damage% / 100) x (1 + Spell Power / 100)` in or out of a fight ({@link healAmount});
 *   **Stun** (level 10, 15 mana, 30 s) freezes the monster's attack timer for 10 s, fights only; the monster's `stunResist` % can make it fail (mana and cooldown are still spent).
 * - **Auto-use** (switch, default on; a fixed preset in `COMBAT.auto`, {@link autoUse}): a potion below 40% HP (best fit for the missing HP), Heal below 50%, Stun whenever it is ready.
 *
 * Nothing else is learned or levelled. Four classes (warrior, paladin, ranger, mage) are cosmetic: a portrait and a name (`PLAYER_CLASSES`), no class gives a bonus.
 *
 * @category Combat/Potions and skills
 * @table skills
 */
export const SKILLS: Record<SkillId, SkillDef> = {
	heal: { id: 'heal', name: 'Heal', unlockLevel: 5, manaCost: 20, cooldownSec: 12, fightOnly: false, healFraction: 0.25 },
	stun: { id: 'stun', name: 'Stun', unlockLevel: 10, manaCost: 15, cooldownSec: 30, fightOnly: true, stunSec: 10 },
};

/** The order they show in (hotkeys 4 and 5 in a fight). */
export const SKILL_IDS: readonly SkillId[] = ['heal', 'stun'];

const pct = (fraction: number) => `${Math.round(fraction * 100)}%`;

/** The static part of a tooltip, built from the numbers above so text and rules cannot drift apart. */
export const skillDescription = (skill: SkillDef): string =>
	skill.id === 'heal'
		? `Restores ${pct(skill.healFraction ?? 0)} of your max HP, more with Intelligence and Spell Power. Works in and out of fights.`
		: `Freezes the monster's attacks for ${skill.stunSec} s. Fights only.`;
