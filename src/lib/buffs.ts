import { BUFF_FAMILIES, isBuffFamily, type BuffFamily, type BuffStat, type ConsumableEffect } from '@/catalog/buffs';

/** One running buff as it is stored (the `player_ledger.buffs` column of PR 2): the family, the stat it changes, the additive percent and the second it ends. */
export interface ActiveBuff {
	family: BuffFamily;
	stat: BuffStat;
	amount: number;
	/** Unix seconds; the buff counts while `untilSec > nowSec` */
	untilSec: number;
}

/**
 * How many different buffs can run at once. A sixth family is refused; drinking a family that already runs (a refresh) is always allowed.
 *
 * @category Combat/Consumables
 * @order 3
 */
export const MAX_ACTIVE_BUFFS = 5;

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * Cleans a stored buff list: anything that is not a well-formed buff of a known family is dropped, never an error, so a retired family or a damaged row
 * cannot reject the whole save. Also drops the buffs that have ended, keeps one per family (the one that lasts longest) and at most
 * {@link MAX_ACTIVE_BUFFS}. The stat is taken from the family, not from the stored row.
 *
 * @category Combat/Consumables
 * @order 4
 */
export function readBuffs(raw: unknown, nowSec: number): ActiveBuff[] {
	if (!Array.isArray(raw)) return [];
	const byFamily = new Map<BuffFamily, ActiveBuff>();
	for (const row of raw) {
		if (!row || typeof row !== 'object') continue;
		const { family, amount, untilSec } = row as Record<string, unknown>;
		if (!isBuffFamily(family) || !finite(amount) || amount <= 0 || !finite(untilSec) || untilSec <= nowSec) continue;
		const best = byFamily.get(family);
		if (!best || untilSec > best.untilSec) byFamily.set(family, { family, stat: BUFF_FAMILIES[family].stat, amount, untilSec });
	}
	return [...byFamily.values()].sort((a, b) => b.untilSec - a.untilSec).slice(0, MAX_ACTIVE_BUFFS);
}

/** The buffs still running at `nowSec` (expired ones are dropped). */
export const activeBuffs = (buffs: readonly ActiveBuff[], nowSec: number): ActiveBuff[] => buffs.filter((buff) => buff.untilSec > nowSec);

export type BuffApplyResult = { ok: true; buffs: ActiveBuff[] } | { ok: false; message: string };

/**
 * Adds one buff effect to the running buffs.
 *
 * - **Same family**: no stacking. The buff that lasts longer (more remaining time) wins as a whole, amount and end time; a tie keeps the larger amount.
 *   The potion is still used up when it loses.
 * - **Different family**: it stacks.
 * - **Cap**: with {@link MAX_ACTIVE_BUFFS} different buffs running, a new family is refused with a message and nothing changes.
 *
 * @category Combat/Consumables
 * @formula
 * until = nowSec + durationSec
 * same family:  keep the one with the larger `until` (tie: the larger amount)
 * new family:   refused when 5 other buffs are running
 * @order 5
 */
export function addBuff(buffs: readonly ActiveBuff[], effect: Extract<ConsumableEffect, { kind: 'buff' }>, nowSec: number): BuffApplyResult {
	const running = activeBuffs(buffs, nowSec);
	const fresh: ActiveBuff = { family: effect.family, stat: BUFF_FAMILIES[effect.family].stat, amount: effect.amount, untilSec: nowSec + effect.durationSec };
	const same = running.find((buff) => buff.family === effect.family);
	if (!same) {
		if (running.length >= MAX_ACTIVE_BUFFS) return { ok: false, message: `Only ${MAX_ACTIVE_BUFFS} effects can be active at once` };
		return { ok: true, buffs: [...running, fresh] };
	}
	const wins = fresh.untilSec > same.untilSec || (fresh.untilSec === same.untilSec && fresh.amount > same.amount);
	return { ok: true, buffs: running.map((buff) => (buff === same && wins ? fresh : buff)) };
}

/**
 * The summed bonus per stat of the running buffs: additive percent, so two buffs on one stat add (families differ, the stat may not).
 * An empty list gives `{}`, so a fight with no potions reads no change.
 *
 * @category Combat/Consumables
 * @formula
 * total[stat] = sum of amount over the running buffs that change `stat`
 * @order 6
 */
export function buffTotals(buffs: readonly ActiveBuff[], nowSec: number): Partial<Record<BuffStat, number>> {
	const totals: Partial<Record<BuffStat, number>> = {};
	for (const buff of activeBuffs(buffs, nowSec)) totals[buff.stat] = (totals[buff.stat] ?? 0) + buff.amount;
	return totals;
}

/** A rebirth ends every buff. */
export const clearBuffsOnRebirth = (): ActiveBuff[] => [];

/** What a drinker has: the pools an instant effect fills and the running buffs. */
export interface DrinkState {
	hp: number;
	maxHp: number;
	mp: number;
	maxMp: number;
	buffs: readonly ActiveBuff[];
}

export type DrinkResult =
	| {
			ok: true;
			hp: number;
			mp: number;
			buffs: ActiveBuff[];
			/** A heal over time to start (applied by the fight, not stored as a buff); null when the potion has none */
			regen: { hpPerSec: number; durationSec: number } | null;
	  }
	| { ok: false; message: string };

/**
 * Drinks one potion: every effect applies together or none does, so a refusal means nothing is consumed.
 *
 * Refused when the potion has no effect, when a new buff does not fit ({@link addBuff}), and when it could do nothing: only heals, with HP (or mana)
 * already full for every one of them.
 *
 * @category Combat/Consumables
 * @formula
 * hp' = min(maxHp, hp + healHp)      mp' = min(maxMp, mp + healMp)
 * buffs: each buff effect through addBuff; a refusal by any of them refuses the potion
 * @order 7
 */
export function drink(effects: readonly ConsumableEffect[], state: DrinkState, nowSec: number): DrinkResult {
	if (effects.length === 0) return { ok: false, message: 'Nothing happens' };
	let hp = state.hp;
	let mp = state.mp;
	let buffs = activeBuffs(state.buffs, nowSec);
	let regen: { hpPerSec: number; durationSec: number } | null = null;
	let useful = false;
	let healsHp = false;
	let healsMp = false;
	for (const effect of effects) {
		if (effect.kind === 'healHp') {
			healsHp = true;
			if (hp < state.maxHp) useful = true;
			hp = Math.min(state.maxHp, hp + effect.amount);
		} else if (effect.kind === 'healMp') {
			healsMp = true;
			if (mp < state.maxMp) useful = true;
			mp = Math.min(state.maxMp, mp + effect.amount);
		} else if (effect.kind === 'regen') {
			if (hp < state.maxHp) useful = true;
			regen = { hpPerSec: effect.hpPerSec, durationSec: effect.durationSec };
		} else {
			const added = addBuff(buffs, effect, nowSec);
			if (!added.ok) return added;
			buffs = added.buffs;
			useful = true;
		}
	}
	if (!useful) return { ok: false, message: healsMp && !healsHp ? 'Mana is already full' : healsHp && !healsMp ? 'Already at full health' : 'Already full' };
	return { ok: true, hp, mp, buffs, regen };
}
