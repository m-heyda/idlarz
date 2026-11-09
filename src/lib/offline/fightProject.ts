import { COMBAT } from '@/config/combatConfig';
import { healingPotionIds, type CombatEnv, type FightCtx } from '@/lib/offline/fightContext';
import { fightStep } from '@/lib/offline/fightSteps';
import { PLAN_FX_KINDS, type CombatState, type FightEvent, type FightPlan } from '@/lib/offline/fightTypes';
import type { Ledger } from '@/lib/offline/ledger';

// SERVER ONLY. Runs the open fight to its end on a throwaway copy, so the browser can be told when it is over instead of asking every 2 s.

const MAX_SAMPLES = 60;
const MAX_FX = 300;
const round1 = (value: number): number => Math.round(value * 10) / 10;
const FX_INDEX: Partial<Record<FightEvent['kind'], number>> = {
	hit: PLAN_FX_KINDS.indexOf('hit'),
	crit: PLAN_FX_KINDS.indexOf('crit'),
	super: PLAN_FX_KINDS.indexOf('super'),
	hurt: PLAN_FX_KINDS.indexOf('hurt'),
	heal: PLAN_FX_KINDS.indexOf('heal'),
	potion: PLAN_FX_KINDS.indexOf('heal'),
	stun: PLAN_FX_KINDS.indexOf('stun'),
	resist: PLAN_FX_KINDS.indexOf('resist'),
};

/**
 * The open fight carried to its end with the same ticks the real request would take (so the real result is the same unless the player
 * commands something first), as the picture the browser animates: HP of both sides and the hero's mana about once a second, and the swings and
 * spells to fly.
 * Nothing of the ledger is written. Returns null with no fight open or one that does not end within `COMBAT.maxFightSec`.
 *
 * @category Combat/A fight
 * @order 10
 */
export const projectFight = (ledger: Ledger, env: CombatEnv, c: CombatState): FightPlan | null => {
	const f = c.fight;
	if (!f) return null;
	const sim: CombatState = { ...c, cd: { ...c.cd }, fight: { ...f }, queue: [...c.queue], retryAt: { ...c.retryAt }, log: [] };
	const ctx: FightCtx = { env, c: sim, ledger, profileNow: f.profile, potionIds: healingPotionIds() };
	const start = c.at;
	const samples: FightPlan['samples'] = [[0, round1(c.hp), round1(f.monsterHp), round1(c.mp)]];
	const fx: FightPlan['fx'] = [];
	let outcome: FightPlan['outcome'] | null = null;
	let lastHp = c.hp;
	let lastMonsterHp = f.monsterHp;
	let lastMp = c.mp;
	let t = start;
	let nextSample = 1;
	const steps = Math.ceil((COMBAT.maxFightSec - f.elapsed + 1) / COMBAT.tickSec);
	for (let i = 0; i < steps && sim.fight; i++) {
		t += COMBAT.tickSec;
		fightStep(ctx, t, COMBAT.tickSec);
		for (const event of sim.log) {
			const index = FX_INDEX[event.kind];
			if (index !== undefined && fx.length < MAX_FX) {
				const kind = event.kind === 'hurt' && event.crit ? PLAN_FX_KINDS.indexOf('hurtCrit') : index;
				fx.push([round1(event.t - start), kind, event.amount ?? 0]);
			}
			if (event.kind === 'won' || event.kind === 'defeated' || event.kind === 'timeout' || event.kind === 'retreat') outcome = event.kind;
		}
		sim.log = []; // the log trims swings away when it grows: read it every tick instead
		if (sim.fight) {
			lastHp = sim.hp;
			lastMonsterHp = sim.fight.monsterHp;
			lastMp = sim.mp;
			if (t - start >= nextSample) {
				samples.push([round1(t - start), round1(lastHp), round1(lastMonsterHp), round1(lastMp)]);
				nextSample += 1;
			}
		}
	}
	if (sim.fight || !outcome) return null;
	const endsInSec = round1(t - start);
	// the last picture: the monster is down on a win; the hero is down on a defeat (the knockout's refill is the next view's business)
	samples.push([endsInSec, outcome === 'defeated' ? 0 : round1(lastHp), outcome === 'won' ? 0 : round1(lastMonsterHp), round1(lastMp)]);
	if (samples.length > MAX_SAMPLES) {
		const every = Math.ceil(samples.length / MAX_SAMPLES);
		const thinned = samples.filter((_, i) => i % every === 0);
		const last = samples[samples.length - 1];
		if (thinned[thinned.length - 1] !== last) thinned.push(last);
		return { endsInSec, outcome, samples: thinned, fx };
	}
	return { endsInSec, outcome, samples, fx };
};
