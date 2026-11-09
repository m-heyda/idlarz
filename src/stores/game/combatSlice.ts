// combatSlice.ts
// Split out of gameStore.ts (IDL-14); the actions and their behaviour are unchanged.

import { autoBattleUnlocked } from '@/lib/combat';
import type { SkillId } from '@/catalog/skills';
import type { FightReply } from '@/lib/offline/types';
import { newClaimId } from '@/lib/offlineClient';
import { requestAuto, requestDismiss, requestUse } from '@/lib/rewardsClient';
import { signalSyncNow } from '@/lib/serverSession';
import { useUiStore } from '@/stores/uiStore';
import { ITEM_CATALOG } from '@/catalog';
import { healHpOf } from '@/catalog/buffs';
import { toast, type GameGet, type GameSet } from './base';
import type { CombatSync } from './combatSync';
import type { InventorySync } from './inventorySync';
import type { ChestSync } from './chestSync';

export const createCombatSlice = (set: GameSet, get: GameGet, inv: InventorySync, map: ChestSync, combat: CombatSync) => {
	const { applyInventory } = inv;
	const { reconcileMap } = map;
	const { applyCombatView, settleFight, sinceNow } = combat;

	return {
		// Combat is the server's: it engages the monsters, swings both ways at each side's attack speed and pays the kills (src/lib/offline/fight.ts).
		// Nothing here hits anything. These are the few things a player may still ask for - a hotkey, a switch, a dismissal - and each is sent
		// to the server, whose answer (not a guess made here) changes the picture.
		requestPotion: (id: string) => {
			if (!healHpOf(ITEM_CATALOG[id])) return false;
			void requestUse(newClaimId(), { kind: 'potion', id }, sinceNow()).then((reply) => settleFight(reply, 'No potion was drunk.'));
			return true;
		},

		requestSkill: (id: SkillId) => {
			void requestUse(newClaimId(), { kind: 'skill', id }, sinceNow()).then((reply) => settleFight(reply, 'The skill is not ready.'));
			return true;
		},

		// A click on a monster: the server opens the fight against it (auto-battle on or off) and swings both ways from then on.
		startFight: (id: number) => {
			const state = get();
			const monster = state.monsters.find((m) => m.id === id);
			if (!monster?.ticket || state.combat.pending || state.combat.maxHp <= 0) return false;
			// a fight is open (or the hero is resting before the next queued one): the click joins the line, or leaves it when the monster is in it
			if (state.combat.fight || state.combat.queue.length > 0) {
				void requestUse(newClaimId(), { kind: 'fight', n: monster.ticket }, sinceNow()).then((reply) => {
					settleFight(reply);
					if (reply.status !== 'ok') return;
					const { queued } = reply.value;
					const queue = get().combat;
					if (queued === 'queued') toast(`Added to the queue (${queue.queue.length}/${queue.queueMax}).`);
					else if (queued === 'removed') toast('Removed from the queue.');
					else if (queued === 'full') toast(`The queue is full (${queue.queueMax}).`);
					signalSyncNow();
				});
				return true;
			}
			// the window opens at once (maximized, loading) instead of after the server's answer; the answer fills it in or closes it
			useUiStore.getState().setPref('combatMinimized', false);
			set({ combat: { ...state.combat, pending: { type: monster.type, level: monster.level } } });
			const settled = () => set((s) => (s.combat.pending ? { combat: { ...s.combat, pending: null } } : {}));
			const giveUp = setTimeout(settled, 10_000);
			void requestUse(newClaimId(), { kind: 'fight', n: monster.ticket }, sinceNow()).then((reply) => {
				clearTimeout(giveUp);
				settleFight(reply, 'The fight could not start.');
				settled();
				signalSyncNow();
			});
			return true;
		},

		// Takes a monster out of the battle queue (the x in the fight window)
		unqueueMonster: (n: number) => {
			set((state) => ({ combat: { ...state.combat, queue: state.combat.queue.filter((q) => q.n !== n) } })); // at once; the answer is the truth
			void requestUse(newClaimId(), { kind: 'unqueue', n }, sinceNow()).then((reply) => settleFight(reply));
		},

		// Auto-battle (the server picks the next monster itself, one after the other; off by default, a click always starts a fight) and
		// auto-use (it drinks, heals and stuns for you with fixed rules; on by default)
		setAutoBattle: (on: boolean) => {
			if (on && !autoBattleUnlocked(get().prestige.rebirths)) {
				toast('Auto-battle unlocks after your first rebirth.');
				return;
			}
			set((state) => ({ combat: { ...state.combat, autoBattle: on } }));
			void requestAuto({ autoBattle: on }, sinceNow()).then((reply) => {
				settleFight(reply);
				if (on) signalSyncNow();
			});
		},

		// Flee: the server ends the fight as a retreat (no reward, no penalty, the monster stays full), which is what switching auto-battle
		// off does; with it on the next fight would start at once, so fleeing turns it off. The window closes at once, the answer confirms.
		flee: () => {
			if (!get().combat.fight) return;
			set((state) => ({ combat: { ...state.combat, fight: null, pending: null, notice: null, autoBattle: false } }));
			void requestAuto({ autoBattle: false }, sinceNow()).then((reply) => settleFight(reply));
		},

		setAutoUse: (on: boolean) => {
			set((state) => ({ combat: { ...state.combat, autoUse: on } }));
			void requestAuto({ autoUse: on }, sinceNow()).then((reply) => settleFight(reply));
		},

		// The server's picture of combat arrived with a sync (polling, a hotkey): see applyCombatView
		applyFightReply: (reply: FightReply) => {
			applyInventory(reply.inv);
			applyCombatView(reply.combat, reply.gemsTotal);
			reconcileMap(reply.tickets, reply.serverNowSec);
		},

		// The win or defeat notice has been read
		clearCombatNotice: () => set((state) => (state.combat.notice ? { combat: { ...state.combat, notice: null } } : {})),

		// Takes a monster off the map without a fight or loot (for a rat too strong to beat); ends the fight against it
		dismissMonster: (id: number) => {
			const monster = get().monsters.find((m) => m.id === id);
			if (!monster) return false;
			set((state) => ({ monsters: state.monsters.filter((m) => m.id !== id) }));
			if (monster.ticket !== undefined) void requestDismiss(newClaimId(), monster.ticket, sinceNow()).then((reply) => settleFight(reply));
			return true;
		},
	};
};
