import type { ItemDef, WeaponType } from '@/types/game';

/**
 * Attacks per second of a one-hand weapon by type (a plain weapon uses its type's speed; an item can override it with
 * `attackSpeed`). Light weapons swing fast, heavy ones slowly. Server fights swing at this speed (lib/offline/profile.ts),
 * together with each weapon's damage per hit.
 */
export const WEAPON_ATTACK_SPEED: Partial<Record<WeaponType, number>> = {
	dagger: 1.6,
	wand: 1.3,
	sword: 1.2,
	spear: 1.1,
	bow: 1,
	axe: 1,
	staff: 0.9,
	crossbow: 0.8,
	mace: 0.8,
	maul: 0.6,
};

/** Damage per second of a weapon: its damage per hit times its attacks per second (0 for anything that is not a weapon). */
export const weaponDps = (def: Pick<ItemDef, 'stats' | 'attackSpeed'>): number =>
	Math.round((def.stats?.damage ?? 0) * (def.attackSpeed ?? 0) * 100) / 100;
