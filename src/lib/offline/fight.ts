import { COMBAT } from '@/config/combatConfig';
import { autoBattleUnlocked } from '@/lib/combat';
import { combatOf, EPS, healingPotionIds, type CombatEnv, type FightCtx } from '@/lib/offline/fightContext';
import { engage, queueHasTarget } from '@/lib/offline/fightTargets';
import { applyCommand, endFight, fightStep, idleStep } from '@/lib/offline/fightSteps';
import { COSMETIC_EVENTS, freshCooldowns, type CombatCommand, type CombatState, type PlayerProfile, type QueueResult } from '@/lib/offline/fightTypes';
import type { Ledger } from '@/lib/offline/ledger';
import { buffTotals } from '@/lib/buffs';
import { playerProfile, profileWithBuffs, withBuffs } from '@/lib/offline/profile';
import { inventoryFromCore } from '@/lib/offline/inventory';
import { takeMonster } from '@/lib/offline/tickets';

// SERVER ONLY. The fight engine. Combat is a pure function of the player's saved strength, the monster's ticket and a sealed random
// stream, stepped in fixed ticks (COMBAT.tickSec): the player swings at the weapon's attack speed, the monster at its own, and
// cooldowns, mana and stun run on the same clock. There is no server process ticking in the background: every request fast-forwards
// the player's combat from where it stopped to the server clock (at most COMBAT.maxCatchUpSec of fighting), so a missed poll loses nothing
// and nobody can speed a fight up by asking more often.
//
// This file is the orchestrator and the public face; the parts live next to it (IDL-16), each importing only the ones before it:
//   fightContext  the request's environment and working state, the event log, the sealed random stream
//   fightProfile  the numbers a fight is judged on: the player's profile, the resume line, the win estimate, how a fight starts
//   fightTargets  who is fought next: placed monsters, auto-battle's pick, the battle queue, the wait between fights
//   fightSteps    what happens in a fight, tick by tick: swings, skills, potions, the end of a fight, commands
//   fightView     the picture the browser is given
// tests/combat/goldenFight.test.ts pins the whole engine to recorded fights: a change to any of them that moves a number there changes the game.

export type { CombatEnv } from '@/lib/offline/fightContext';
export { combatView } from '@/lib/offline/fightView';

export interface CombatTotals {
	ledger: Ledger;
	behind: boolean;
	/** What the last `fight` or `unqueue` command did to the queue (left out when there was none) */
	queued?: QueueResult;
}

/**
 * Brings the player's combat up to `env.nowSec`, then applies what the player asked for (switches, hotkeys) and starts the next fight when
 * auto-battle allows. Returns the new ledger. All events are in `ledger.combat.log`.
 *
 * A fight. `runCombat` fast-forwards the player's combat to the server clock in 0.1 s ticks (`COMBAT.tickSec`) on every request; at most 120 s of fighting per request
 * (`maxCatchUpSec`), then it reports `behind`.
 *
 * Per tick ({@link fightStep}):
 *
 * 1. HP and mana regenerate, cooldowns run, the boss clock runs, auto-use may act.
 * 2. The player swings every `1 / attacks per second`. A swing rolls crit, then super crit ({@link swing}; two random numbers at most). Damage to the monster is `max(1, round1(hit x (1 - armorReduction(monster armor))))`.
 *    Life leech heals `damage x leech%`.
 * 3. If the monster is dead the kill is paid ({@link payKill}) and the fight closes.
 * 4. The monster swings every `1 / attackSpeed` (a stunned monster's timer does not advance). Dodge is rolled first; a monster crit uses its `critChance` and `critMult` (1.5).
 * 5. At 0 HP the fight ends `defeated`: HP is set to 30% of max (`knockoutHpFraction`). If the boss clock reaches 0, or a fight lasts 180 s (`maxFightSec`), it ends `timeout`.
 *    Neither costs anything; the monster stays. `retreat` (switching auto-battle off) also keeps it.
 *
 * The random stream is sealed per swing ({@link rngFor}), so a fight is a pure function of profile, ticket and secret. `tests/combat/goldenFight.test.ts` pins the engine to recorded fights;
 * `tests/combat/fightBalance.test.ts` pins the plains boss tuning; `npm run fight-sim` and `npm run monster-ladder` print which gear beats which monster (`docs/generated/`).
 *
 * @category Combat/A fight
 * @order 1
 * @see fightStep, estimateWin, restThrough
 */
export const runCombat = (
	input: Ledger,
	env: CombatEnv,
	ask: { commands?: CombatCommand[]; autoBattle?: boolean; autoUse?: boolean; ack?: number } = {},
): CombatTotals => {
	// the bag is the ledger's (the engine tests and the sim build a ledger from a core: the inventory is read from it then)
	const ledger: Ledger = input.inv ? input : { ...input, inv: inventoryFromCore(env.stored.core) };
	const base = combatOf(ledger, env);
	// what the browser has told us it applied (its `since`) is not kept: only cosmetic events are ever dropped unacknowledged
	const log = ask.ack === undefined ? [...base.log] : base.log.filter((event) => COSMETIC_EVENTS.has(event.kind) || event.no > ask.ack!);
	const c: CombatState = { ...base, cd: { ...base.cd }, log, fight: base.fight ? { ...base.fight } : null, queue: [...(base.queue ?? [])] };
	// the potion buffs ride on the profile: it is worked out once, again only when a buff ends (`buffsEndAt`), and a fight freezes whatever it is when the fight starts
	const baseProfile = playerProfile(env.stored.core);
	let buffsEndAt = Infinity;
	const profileAt = (t: number): PlayerProfile => {
		const running = ledger.buffs.filter((buff) => buff.untilSec > t);
		buffsEndAt = running.reduce((soonest, buff) => Math.min(soonest, buff.untilSec), Infinity);
		return withBuffs(baseProfile, buffTotals(running, t));
	};
	const ctx: FightCtx = {
		env,
		c,
		ledger,
		profileNow: profileAt(Math.min(c.at, env.nowSec)),
		potionIds: healingPotionIds(),
	};
	let queued: QueueResult | undefined;
	// auto-battle is locked until the first rebirth: a save that has it on from before (or a request for it) does not get it
	const autoAllowed = autoBattleUnlocked(ledger.rebirths);
	if (!autoAllowed) c.autoBattle = false;

	// ---- fast-forward to now ----
	const now = env.nowSec;
	let t = Math.min(c.at, now);
	let budget = COMBAT.maxCatchUpSec;
	let behind = false;
	for (let guard = 0; t < now - EPS && guard < 200000; guard++) {
		if (!c.fight) {
			if (t >= buffsEndAt) ctx.profileNow = profileAt(t);
			if (engage(ctx, t)) continue;
			// nothing to fight yet: rest until something can change
			t += idleStep(ctx, t, now);
			continue;
		}
		const dt = Math.min(COMBAT.tickSec, now - t);
		t += dt;
		fightStep(ctx, t, dt);
		budget -= dt;
		if (budget <= 0 && t < now - EPS) {
			behind = true;
			break;
		}
	}
	c.at = t;

	// ---- what the player asked for, at the clock's time ----
	if (!c.fight && t >= buffsEndAt) ctx.profileNow = profileAt(t);
	if (ask.autoUse !== undefined) c.autoUse = ask.autoUse;
	if (ask.autoBattle !== undefined) {
		c.autoBattle = ask.autoBattle && autoAllowed;
		if (!ask.autoBattle && c.fight) endFight(ctx, t, 'retreat');
	}
	for (const command of ask.commands ?? []) {
		const result = applyCommand(ctx, t, command, behind);
		if (result) queued = result;
	}
	if (!behind && !c.fight) engage(ctx, t);

	// a retry time only matters for a monster that is still there
	const standing = new Set(ctx.ledger.bank.monsters.map((ticket) => String(ticket.n)));
	c.retryAt = Object.fromEntries(Object.entries(c.retryAt).filter(([n]) => standing.has(n)));

	// a queued monster must still be there
	queueHasTarget(ctx);

	return { ledger: { ...ctx.ledger, combat: c }, behind, ...(queued ? { queued } : {}) };
};

/**
 * Takes a monster off the map without a fight (a monster that cannot be beaten, or that is in the way). Ends the fight against it.
 *
 * @category Combat/A fight
 * @order 9
 */
export const dismissTicket = (ledger: Ledger, env: CombatEnv, n: number): { ledger: Ledger; ok: boolean } => {
	const taken = takeMonster(ledger.bank, n);
	if (!taken) return { ledger, ok: false };
	const base = combatOf(ledger, env);
	const combat = { ...base, fight: base.fight?.n === n ? null : base.fight, queue: (base.queue ?? []).filter((queuedN) => queuedN !== n) };
	return { ledger: { ...ledger, bank: taken.bank, combat }, ok: true };
};

/**
 * After an absence the player is back on their feet: HP and mana refilled by resting for `gapSec`, no fight open, cooldowns over.
 *
 * Results and rest. After a win the fight closes and the result stays in the event log until the browser acknowledges it; the window shows it `victoryToastSec` = 15 s.
 * A real absence (the gap since the server last saw the player is more than `UNCLAIMED_SEC` = 900 s, {@link UNCLAIMED_SEC}) rests the hero: HP and mana regenerated by the gap, cooldowns cleared, no fight open, queue cleared.
 * The ledger's `combat` record holds HP, mana, cooldowns, the open fight, switches, retry times and the numbered event log (`CombatState` in `src/lib/offline/fightTypes.ts`).
 * With a fight open the server runs it to its end on a copy ({@link projectFight}) and sends the plan: the browser draws HP and swings from it and asks again 0.4 s after the end (`COMBAT.poll.afterEndSec`), or whatever `nextPollSec` the server says. A fight it could not plan (`behind`) is polled every 0.5 s, then 2 s with the panel open, 8 s minimised or hidden (`COMBAT.poll`).
 *
 * @category Combat/Results and rest
 * @order 1
 */
export const restThrough = (ledger: Ledger, env: CombatEnv, gapSec: number): Ledger => {
	const base = combatOf(ledger, env);
	const p = profileWithBuffs(env.stored.core, ledger.buffs, env.nowSec);
	const rest = Math.max(0, gapSec);
	const combat: CombatState = {
		...base,
		at: env.nowSec,
		hp: Math.min(p.maxHp, base.hp + (COMBAT.regenPerSec + p.hpRegen) * rest),
		mp: Math.min(p.maxMp, base.mp + p.mpRegen * rest),
		cd: freshCooldowns(),
		fight: null,
		queue: [],
	};
	return { ...ledger, combat };
};
