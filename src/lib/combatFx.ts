// Tiny event bus for fight effects (blood, shake, damage numbers). The store emits, the fight modal listens.

export type CombatFx =
	| { kind: 'hit'; damage: number; killed: boolean; crit: 'none' | 'crit' | 'super' }
	| { kind: 'hurt'; amount: number }
	| { kind: 'heal'; amount: number };

export const COMBAT_EVENT = 'idlarz:combat';

export const emitCombat = (fx: CombatFx): void => {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent<CombatFx>(COMBAT_EVENT, { detail: fx }));
};
