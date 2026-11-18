import type { BossModifiers } from '@/config/combatConfig';

/** One chip of the fight panel: the modifier's name and what it does, worked out from the monster's numbers. */
export interface ModifierChip {
	key: keyof BossModifiers;
	label: string;
	text: string;
}

const pct = (n: number): string => `${+n.toFixed(2)}%`;

/**
 * The chips a boss shows in the fight panel, one per modifier it carries (none for a monster without). Pure text from the config, so a retune needs no edit here.
 *
 * @category Monsters/Boss modifiers
 * @order 2
 */
export const describeModifiers = (mods: BossModifiers | undefined): ModifierChip[] => {
	const chips: ModifierChip[] = [];
	if (!mods) return chips;
	if (mods.venom) {
		const v = mods.venom;
		chips.push({
			key: 'venom',
			label: 'Venom',
			text: `Every hit that lands adds a poison stack (up to ${v.maxStacks}, ${v.durationSec} s): each costs ${pct(v.pctPerSec)} of your max HP per second, and your regeneration is cut by ${v.regenCutPct}% while poisoned.`,
		});
	}
	if (mods.sluggish)
		chips.push({
			key: 'sluggish',
			label: 'Sluggish',
			text: `Potions take ${pct((mods.sluggish.potionCooldownMult - 1) * 100)} longer to come off cooldown in this fight.`,
		});
	if (mods.enrage) {
		const e = mods.enrage;
		chips.push({
			key: 'enrage',
			label: 'Enrage',
			text: `Attacks ${e.speedPct}% faster every ${e.everySec} s of the fight, up to ${e.maxSteps} times (+${e.speedPct * e.maxSteps}%).`,
		});
	}
	if (mods.brutal) chips.push({ key: 'brutal', label: 'Brutal', text: `Hits ${mods.brutal.attackPct}% harder.` });
	return chips;
};
