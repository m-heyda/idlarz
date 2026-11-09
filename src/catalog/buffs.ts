/**
 * Consumable effects and the buff families (IDL-155). Data and types only: the rules that apply them are pure functions in `lib/buffs.ts`.
 */
import type { ItemDef } from '@/types/game';

/**
 * The stats a timed buff can change. Each is an additive percent (`amount` 10 = +10 %) that the fight reads on top of the gear's own numbers.
 * Economy stats (gold, XP, click) are not buffable until the server owns the economy actions (IDL-22).
 */
export type BuffStat = 'damagePct' | 'atkSpeedPct' | 'armorPct' | 'critChance' | 'maxHpPct' | 'dodge';

/** One buff family: potions of the same family never stack, they refresh each other. `stat` is the single stat the family changes. */
export interface BuffFamilyDef {
	label: string;
	stat: BuffStat;
}

/**
 * The buff families. A saved buff names its family, so removing a family here makes saved buffs of it disappear on the next read (they are dropped,
 * never an error): see {@link readBuffs}.
 *
 * @category Combat/Consumables
 * @order 2
 */
export const BUFF_FAMILIES = {
	might: { label: 'Might', stat: 'damagePct' },
	haste: { label: 'Haste', stat: 'atkSpeedPct' },
	ironskin: { label: 'Ironskin', stat: 'armorPct' },
	keenEye: { label: 'Keen Eye', stat: 'critChance' },
	fortitude: { label: 'Fortitude', stat: 'maxHpPct' },
	warding: { label: 'Warding', stat: 'dodge' },
} as const satisfies Record<string, BuffFamilyDef>;

const BUFF_STAT_LABEL: Record<BuffStat, string> = {
	damagePct: 'Damage',
	atkSpeedPct: 'Attack Speed',
	armorPct: 'Armor',
	critChance: 'Crit Chance',
	maxHpPct: 'Max HP',
	dodge: 'Dodge',
};

export type BuffFamily = keyof typeof BUFF_FAMILIES;

export const isBuffFamily = (family: unknown): family is BuffFamily =>
	typeof family === 'string' && Object.prototype.hasOwnProperty.call(BUFF_FAMILIES, family);

/** What drinking a potion does. Instant effects happen at once; a `buff` is recorded with an end time. */
export type ConsumableEffect =
	| { kind: 'healHp'; amount: number }
	| { kind: 'healMp'; amount: number }
	/** Heals `hpPerSec` for `durationSec` seconds (a heal over time kept by the fight, not a buff record) */
	| { kind: 'regen'; hpPerSec: number; durationSec: number }
	| { kind: 'buff'; family: BuffFamily; stat: BuffStat; amount: number; durationSec: number };

/** The HP one potion restores at once (0 when it has no `healHp` effect). Sums the effects so a two-part potion still reads right. */
export const healHpOf = (def: Pick<ItemDef, 'effects'> | undefined): number =>
	(def?.effects ?? []).reduce((sum, effect) => sum + (effect.kind === 'healHp' ? effect.amount : 0), 0);

/** The mana one potion restores at once. */
export const healMpOf = (def: Pick<ItemDef, 'effects'> | undefined): number =>
	(def?.effects ?? []).reduce((sum, effect) => sum + (effect.kind === 'healMp' ? effect.amount : 0), 0);

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** One tooltip line for an effect: 'Restores 35 HP', '+10% Damage for 2 min (Might)'. */
export function describeEffect(effect: ConsumableEffect): string {
	switch (effect.kind) {
		case 'healHp':
			return `Restores ${fmt(effect.amount)} HP`;
		case 'healMp':
			return `Restores ${fmt(effect.amount)} Mana`;
		case 'regen':
			return `Heals ${fmt(effect.hpPerSec)} HP per second for ${fmt(effect.durationSec)} s`;
		case 'buff': {
			const min = effect.durationSec >= 120 && effect.durationSec % 60 === 0;
			const time = min ? `${effect.durationSec / 60} min` : `${fmt(effect.durationSec)} s`;
			return `+${fmt(effect.amount)}% ${BUFF_STAT_LABEL[effect.stat]} for ${time} (${BUFF_FAMILIES[effect.family].label})`;
		}
	}
}

/** True when the item does something when drunk (trade goods have no `effects`). */
export const hasEffects = (def: Pick<ItemDef, 'effects'> | undefined): boolean => (def?.effects?.length ?? 0) > 0;
