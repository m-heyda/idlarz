import { formatCompact } from '@/utils/formatters';

// Tiny event bus for fight effects (blood, shake, damage numbers). The store emits, the fight modal listens.

export type CombatFx =
	| { kind: 'hit'; damage: number; killed: boolean; crit: 'none' | 'crit' | 'super' }
	| { kind: 'hurt'; amount: number; crit?: boolean }
	| { kind: 'heal'; amount: number }
	| { kind: 'poison'; amount: number }
	| { kind: 'stun'; sec: number }
	| { kind: 'resist' };

export const COMBAT_EVENT = 'idlarz:combat';

/** The floating number of a hit the player lands: a crit ends with ! (red), a super crit with !! (purple); the colours are in Fight.css. */
export const hitNumberText = (damage: number, crit: 'none' | 'crit' | 'super'): string =>
	`-${formatCompact(damage)}${crit === 'super' ? '!!' : crit === 'crit' ? '!' : ''}`;

export const emitCombat = (fx: CombatFx): void => {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent<CombatFx>(COMBAT_EVENT, { detail: fx }));
};
