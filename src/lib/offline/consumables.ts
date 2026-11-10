import { ITEM_CATALOG } from '@/catalog';
import { drink } from '@/lib/buffs';
import { COMBAT } from '@/config/combatConfig';
import { removeFromBag, stackOf } from '@/lib/inventory';
import { combatOf, type CombatEnv } from '@/lib/offline/fightContext';
import type { Ledger } from '@/lib/offline/ledger';
import { profileWithBuffs } from '@/lib/offline/profile';
import type { ActiveBuff } from '@/lib/buffs';

// SERVER ONLY. Drinking a potion from the bag (the `use` operation of /api/inventory). The pure rules (what each effect does, the five-buff cap, the
// refresh) are in lib/buffs.ts; this applies them to the ledger so that the potion leaving the bag, the HP and mana it gives and the buff it starts
// are one change to one ledger, written by the caller's compare-and-swap together with the idempotency key.

export type UseResult = { ok: true; ledger: Ledger; buffs: ActiveBuff[] } | { ok: false; message: string };

/**
 * Drinks the potion in bag slot `index`, at the server clock `nowSec` (the combat in `input` has already been brought up to now).
 *
 * - Refused, with nothing consumed, when the slot holds no consumable with effects, when a fight is open and the potion cooldown still runs, when the
 *   potion would do nothing (full HP / mana) or when a sixth buff would be needed ({@link drink}).
 * - Otherwise one potion leaves the bag (the inventory `ver` grows), HP and mana are filled (capped by the max the running buffs give), a buff is
 *   recorded in `ledger.buffs` with its end time, a heal over time starts on the combat record, and in a fight the potion cooldown starts.
 *
 * @category Combat/Consumables
 * @order 9
 */
export const applyUse = (input: Ledger, env: CombatEnv, index: number): UseResult => {
	const inv = input.inv!;
	const stack = Number.isInteger(index) ? stackOf(inv.bag[index]) : null;
	const effects = stack ? ITEM_CATALOG[stack.id]?.effects : undefined;
	if (!stack || !effects || effects.length === 0) return { ok: false, message: 'That cannot be drunk' };
	const c = combatOf(input, env);
	if (c.fight && c.cd.potion > 0) return { ok: false, message: 'Potions are still on cooldown' };
	const now = env.nowSec;
	const profile = profileWithBuffs(env.stored.core, input.buffs, now);
	const drunk = drink(effects, { hp: c.hp, maxHp: profile.maxHp, mp: c.mp, maxMp: profile.maxMp, buffs: input.buffs }, now, profile.potionPower ?? 1);
	if (!drunk.ok) return drunk;
	// a new maxHp buff (Fortitude) does not raise the HP at once: only heals do; the fight in progress keeps the profile it started with
	const combat = {
		...c,
		hp: drunk.hp,
		mp: drunk.mp,
		cd: c.fight ? { ...c.cd, potion: profile.potionCooldownSec ?? COMBAT.potionCooldownSec } : c.cd,
		...(drunk.regen ? { regen: { hpPerSec: drunk.regen.hpPerSec, untilSec: now + drunk.regen.durationSec } } : {}),
	};
	const ledger: Ledger = {
		...input,
		combat,
		buffs: drunk.buffs,
		inv: { ...inv, bag: removeFromBag(inv.bag, index, 1), ver: inv.ver + 1 },
	};
	return { ok: true, ledger, buffs: drunk.buffs };
};
