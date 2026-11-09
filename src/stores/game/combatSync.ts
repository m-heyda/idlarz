// combatSync.ts
// Split out of gameStore.ts (IDL-14); the actions and their behaviour are unchanged.

import { RESOURCE_CAP, XP_CAP } from '@/config/economy';
import { writeCursor } from '@/lib/combatCursor';
import { emitCombat } from '@/lib/combatFx';
import type { CombatView, FightEvent } from '@/lib/offline/fightTypes';
import type { FightReply } from '@/lib/offline/types';
import { type Reply } from '@/lib/rewardsClient';
import { signalNeedClaim } from '@/lib/serverSession';
import { monsterDef } from '@/lib/monsters';
import type { CombatNotice, Monster } from '@/types/game';
import { toast, type GameGet, type GameSet } from './base';
import type { ChestSync } from './chestSync';
import type { InventorySync } from './inventorySync';

export const createCombatSync = (set: GameSet, get: GameGet, inv: InventorySync, map: ChestSync) => {
	const { applyInventory } = inv;
	const { reconcileMap } = map;
	let noticeId = 1;
	const tauntOf = (type: Monster['type']): string | null => {
		const taunts = monsterDef(type).taunts;
		return taunts && taunts.length > 0 ? taunts[Math.floor(Math.random() * taunts.length)] : null;
	};

	/** Shows what the server says happened in a fight, with the numbers flying in the order (and roughly the rhythm) they happened. */
	const playFx = (events: FightEvent[]) => {
		const recent = events.filter((e) => ['hit', 'crit', 'super', 'hurt', 'heal', 'potion', 'stun', 'resist'].includes(e.kind));
		const first = recent[0]?.t ?? 0;
		for (const e of recent.slice(-24)) {
			const delay = Math.min(2500, Math.max(0, (e.t - first) * 1000));
			const fx = () => {
				if (e.kind === 'hit' || e.kind === 'crit' || e.kind === 'super')
					emitCombat({ kind: 'hit', damage: e.amount ?? 0, killed: false, crit: e.kind === 'hit' ? 'none' : e.kind });
				else if (e.kind === 'hurt') emitCombat({ kind: 'hurt', amount: e.amount ?? 0, crit: e.crit });
				else if (e.kind === 'heal' || e.kind === 'potion') emitCombat({ kind: 'heal', amount: e.amount ?? 0 });
				else if (e.kind === 'stun') emitCombat({ kind: 'stun', sec: e.amount ?? 0 });
				else if (e.kind === 'resist') emitCombat({ kind: 'resist' });
			};
			if (delay === 0) fx();
			else setTimeout(fx, delay);
		}
	};

	/**
	 * Takes the server's picture of the player's combat: HP, mana, cooldowns, the open fight and the switches replace what was shown, and
	 * every event the browser has not applied yet is applied once (a potion leaves the bag, a kill's loot goes in, a defeat is announced).
	 * An answer older than one already applied is ignored.
	 */
	const applyCombatView = (view: CombatView, gemsTotal?: number) => {
		const state = get();
		if (view.at < state.combat.at) return;
		// the log numbers start again with a new run (a rebirth): a server log that is behind the browser's cursor is a new one
		const seen = state.combat.eventNo === null ? null : view.eventNo >= state.combat.eventNo ? state.combat.eventNo : 0;
		const fresh = seen === null ? [] : view.events.filter((e) => e.no > seen);
		let notice: CombatNotice | null = state.combat.notice;
		const resources = { ...state.resources };
		for (const e of fresh) {
			if (e.kind === 'won' && e.reward && e.type) {
				// the server has put the drops where they go (the bag comes with the answer as `inv`); the gold of what it sold or could not fit is ours
				const received = {
					stored: e.reward.stored ?? e.reward.items,
					convertedGold: e.reward.convertedGold ?? 0,
					autoSold: e.reward.autoSold ?? { count: 0, gold: 0 },
				};
				resources.gold = Math.min(resources.gold + e.reward.gold + received.convertedGold + received.autoSold.gold, RESOURCE_CAP);
				resources.xp = Math.min(resources.xp + e.reward.xp, XP_CAP);
				resources.hide = Math.min(resources.hide + (e.reward.hide ?? 0), RESOURCE_CAP);
				notice = {
					id: noticeId++,
					kind: 'won',
					type: e.type,
					level: e.level ?? 1,
					summary: {
						gold: e.reward.gold,
						xp: e.reward.xp,
						hide: e.reward.hide,
						items: received.stored,
						convertedGold: received.convertedGold,
						autoSold: received.autoSold,
						lucky: e.reward.lucky,
					},
					taunt: null,
				};
			} else if ((e.kind === 'defeated' || e.kind === 'timeout') && e.type) {
				notice = { id: noticeId++, kind: e.kind, type: e.type, level: e.level ?? 1, summary: null, taunt: tauntOf(e.type) };
			} else if (e.kind === 'retreat') {
				// a fled fight has no result of its own, and the one from before must not come back in its place
				notice = null;
			}
		}
		set({
			resources,
			playerHp: view.hp,
			playerMp: view.mp,
			...(gemsTotal !== undefined ? { gems: gemsTotal } : {}),
			combat: {
				fight: view.fight,
				autoBattle: view.autoBattle,
				autoUse: view.autoUse,
				cd: view.cd,
				maxHp: view.maxHp,
				maxMp: view.maxMp,
				retrySec: view.retrySec,
				autoNote: view.autoNote ?? null,
				at: view.at,
				eventNo: view.eventNo,
				notice,
				// a click waits for the server's answer; once a fight is open (or the answer came) it is over
				pending: view.fight ? null : state.combat.pending,
				queue: view.queue ?? [],
				resting: !!view.resting,
				restSec: view.restSec ?? 0,
				restEndsAt: view.resting ? Date.now() + (view.restSec ?? 0) * 1000 : null,
				queueMax: view.queueMax ?? state.combat.queueMax,
				buffs: view.buffs ?? [],
			},
		});
		writeCursor(view.eventNo);
		playFx(fresh);
	};

	const sinceNow = () => get().combat.eventNo ?? undefined;

	/** What to do with the answer to a combat request: apply it, or say why nothing happened. */
	const settleFight = (reply: Reply<FightReply>, refused?: string) => {
		if (reply.status === 'ok') {
			applyInventory(reply.value.inv);
			applyCombatView(reply.value.combat, reply.value.gemsTotal);
			reconcileMap(reply.value.tickets, reply.value.serverNowSec);
			if (!reply.value.accepted && refused) toast(refused);
			return;
		}
		if (reply.status === 'need_claim') signalNeedClaim();
		toast('Could not reach the server.');
	};

	return { applyCombatView, settleFight, sinceNow };
};

export type CombatSync = ReturnType<typeof createCombatSync>;
