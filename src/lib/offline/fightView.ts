import { activeBuffs } from '@/lib/buffs';
import { COMBAT } from '@/config/combatConfig';
import { limitOf } from '@/lib/limits';
import { combatOf, type CombatEnv } from '@/lib/offline/fightContext';
import { potionsForEstimate, resumeHpOf, winnableBy, winPctBy } from '@/lib/offline/fightProfile';
import { nextRetry, pickTarget, placedTarget, queueView } from '@/lib/offline/fightTargets';
import { projectFight } from '@/lib/offline/fightProject';
import type { CombatView, FightPlan } from '@/lib/offline/fightTypes';
import { inventoryFromCore } from '@/lib/offline/inventory';
import type { Ledger } from '@/lib/offline/ledger';
import { profileWithBuffs } from '@/lib/offline/profile';

// SERVER ONLY. The picture of the player's combat the browser is given (and when it should ask again). Reads the ledger, changes nothing.

/** The picture the browser is given: vitals, cooldowns, the open fight and the events it has not seen. */
export const combatView = (ledger: Ledger, env: CombatEnv, since: number, behind: boolean, nextSpawnSec: number | null): CombatView => {
	const c = combatOf(ledger, env);
	const p = c.fight ? c.fight.profile : profileWithBuffs(env.stored.core, ledger.buffs, c.at);
	const f = c.fight;
	let nextPollSec: number = COMBAT.poll.minimizedSec;
	let plan: FightPlan | undefined;
	let waiting = false;
	let resting = false;
	let restSec = 0;
	if (behind) nextPollSec = 0.5;
	else if (f) {
		// the fight is run to its end here: the browser animates it and asks again when it is over (a command it sends meanwhile gets a new plan)
		plan = projectFight(ledger, env, c) ?? undefined;
		nextPollSec = plan ? Math.max(0.5, Math.min(600, plan.endsInSec + COMBAT.poll.afterEndSec)) : COMBAT.poll.fightSec;
	} else {
		// idle: ask again when something can change
		const winnable = winnableBy(p, c.hp, potionsForEstimate(ledger.inv ?? inventoryFromCore(env.stored.core), c, ledger.rebirths));
		waiting = pickTarget(ledger, c, c.at, winnable) !== null;
		const resume = resumeHpOf(p);
		const retry = nextRetry(ledger, c, c.at);
		// a queued monster starts by itself once the hero is back above the resume line, with auto-battle on or off: ask again when that is
		// (without this the idle wait below, up to ten minutes, applied and the queue looked stuck after a fight)
		const regen = Math.max(0.1, COMBAT.regenPerSec + p.hpRegen);
		const queuedWaiting = (c.queue ?? []).some((n) => placedTarget(ledger, n) !== null);
		if (queuedWaiting) {
			resting = c.hp < resume;
			restSec = resting ? Math.ceil((resume - c.hp) / regen) : 0;
			nextPollSec = resting ? Math.min(600, restSec + 1) : COMBAT.poll.fightSec;
		} else if (!c.autoBattle) nextPollSec = 600;
		else if (waiting && c.hp < resume) nextPollSec = Math.min(600, Math.ceil((resume - c.hp) / Math.max(0.1, COMBAT.regenPerSec + p.hpRegen)) + 1);
		else if (!waiting && Number.isFinite(retry)) nextPollSec = Math.min(nextSpawnSec ?? 600, Math.min(600, Math.ceil(retry - c.at) + 1));
		else if (!waiting) nextPollSec = Math.min(600, Math.max(COMBAT.poll.minimizedSec, Math.ceil(nextSpawnSec ?? 600) + 1));
	}
	const potions = potionsForEstimate(ledger.inv ?? inventoryFromCore(env.stored.core), c, ledger.rebirths);
	const runningBuffs = activeBuffs(ledger.buffs, c.at);
	return {
		hp: c.hp,
		mp: c.mp,
		maxHp: p.maxHp,
		maxMp: p.maxMp,
		cd: c.cd,
		fight: f
			? {
					n: f.n,
					type: f.type,
					level: f.level,
					lucky: f.lucky,
					monsterHp: f.monsterHp,
					monsterMaxHp: f.monsterMaxHp,
					stunLeft: f.stunLeft,
					timeLeftSec: f.timeLeftSec,
					x: f.x,
					y: f.y,
				}
			: null,
		...(plan ? { plan } : {}),
		queue: queueView(ledger, c, winPctBy(p, c.hp, potions)),
		queueMax: limitOf('battleQueue'),
		autoBattle: c.autoBattle,
		autoUse: c.autoUse,
		retrySec: Number.isFinite(nextRetry(ledger, c, c.at)) ? Math.max(0, Math.ceil(nextRetry(ledger, c, c.at) - c.at)) : 0,
		at: c.at,
		eventNo: c.eventNo,
		events: c.log.filter((event) => event.no > since),
		behind,
		nextPollSec,
		resting,
		...(resting ? { restSec } : {}),
		// auto-battle is idle with monsters standing around: they are all beyond the player (or still waiting out a retry, which has its own line)
		...(runningBuffs.length > 0 ? { buffs: runningBuffs } : {}),
		autoNote: c.autoBattle && !f && !waiting && pickTarget(ledger, c, c.at) !== null ? 'no_winnable' : null,
	};
};
