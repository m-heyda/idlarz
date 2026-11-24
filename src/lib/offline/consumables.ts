import { ITEM_CATALOG } from '@/catalog';
import { drink } from '@/lib/buffs';
import { COMBAT } from '@/config/combatConfig';
import { potionCooldownAgainst } from '@/lib/monsters';
import { removeFromBag, stackOf } from '@/lib/inventory';
import { combatOf, type CombatEnv } from '@/lib/offline/fightContext';
import type { Ledger } from '@/lib/offline/ledger';
import { profileWithBuffs } from '@/lib/offline/profile';
import type { ActiveBuff } from '@/lib/buffs';
import { TIME_SHIFT } from '@/config/crafting';
import { computeOfflineGrant, type OfflineGrant } from '@/lib/offline/grant';
import { addTotals } from '@/lib/offline/ledger';
import { derivedJobs } from '@/lib/cloudSave/summary';

// SERVER ONLY. Drinking a potion from the bag (the `use` operation of /api/inventory). The pure rules (what each effect does, the five-buff cap, the
// refresh) are in lib/buffs.ts; this applies them to the ledger so that the potion leaving the bag, the HP and mana it gives and the buff it starts
// are one change to one ledger, written by the caller's compare-and-swap together with the idempotency key.

export type UseResult = { ok: true; ledger: Ledger; buffs: ActiveBuff[]; shifted?: OfflineGrant } | { ok: false; message: string };

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
	const shift = effects.find((effect) => effect.kind === 'timeShift');
	if (shift && shift.kind === 'timeShift') return applyTimeShift(input, env, index, shift.seconds, !!c.fight);
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
		cd: c.fight ? { ...c.cd, potion: potionCooldownAgainst(c.fight.type, profile.potionCooldownSec ?? COMBAT.potionCooldownSec) } : c.cd,
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

/**
 * Drinks a time-shift potion (IDL-355, the Crafting tab's most expensive brew). The server moves the clock for the player: it pays `seconds` of income at the away efficiency (the same piecewise maths as an absence, so an upgrade that finishes inside the hour
 * pays its higher rates after it), records it in `ledger.granted` and as `granted.shiftSec`, and answers with the payment as an {@link OfflineGrant} for the browser to apply: resources, castle and building timers and the monsters' age run that many seconds ahead.
 * The save check reads `granted.shiftSec` as the extra seconds the timers may have gained.
 *
 * - Refused, with nothing consumed, in a fight, after `TIME_SHIFT.perDay` of them on the same UTC day, or when the last save has no rates to pay from.
 * - One potion leaves the bag; the HP and mana are not touched (the grant carries a zero gap, so the browser does not rest the hero).
 *
 * @category Economy/Crafting
 * @order 8
 * @formula
 * paid[r] = floor(rate[r] x seconds x efficiency)         efficiency = the account's away efficiency (50% + Steward ...)
 * drunk today <= TIME_SHIFT.perDay (3)                      the day is the UTC day of the server clock
 */
export const applyTimeShift = (input: Ledger, env: CombatEnv, index: number, seconds: number, inFight: boolean): UseResult => {
	if (inFight) return { ok: false, message: 'Finish the fight first' };
	const inv = input.inv!;
	const day = Math.floor(env.nowSec / 86_400);
	const used = input.craft.shift?.day === day ? input.craft.shift.used : 0;
	if (used >= TIME_SHIFT.perDay) return { ok: false, message: `Time can only be shifted ${TIME_SHIFT.perDay} times a day` };
	const derived = env.stored.summary.derived;
	const jobs = derivedJobs(derived);
	const paid = computeOfflineGrant({
		rates: env.stored.summary.rates,
		ratesAfterCastle: derived.ratesAfterCastle,
		castleUpgrade: derived.castleUpgrade,
		buildingUpgrades: jobs.jobs,
		ratesAfterBuildings: jobs.ratesAfter,
		xpGainPct: env.stored.summary.xpGainPct,
		gapSec: seconds,
		capSec: seconds,
		efficiency: derived.offlineEfficiency,
		minGapSec: 0,
	});
	if (!paid) return { ok: false, message: 'Nothing happens' };
	const shifted: OfflineGrant = { ...paid, gapSec: 0, capped: false };
	const ledger: Ledger = {
		...input,
		granted: { ...addTotals(input.granted, shifted.resources), shiftSec: (input.granted.shiftSec ?? 0) + seconds },
		craft: { ...input.craft, shift: { day, used: used + 1 } },
		inv: { ...inv, bag: removeFromBag(inv.bag, index, 1), ver: inv.ver + 1 },
	};
	return { ok: true, ledger, buffs: input.buffs, shifted };
};
