import { useEffect } from 'react';
import { COMBAT } from '@/config/combatConfig';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { readCursor, setCursorUser } from '@/lib/combatCursor';
import { requestSync } from '@/lib/rewardsClient';
import { runOfflineClaim } from '@/lib/offlineFlow';
import { setNeedClaimHandler, setPollHandler } from '@/lib/serverSession';
import { currentCloudSaver } from '@/lib/manualCloudSave';

const MIN_WAIT_SEC = 20;
const MAX_WAIT_SEC = 600;
const RETRY_SEC = 60;

/**
 * The one poll of the game. The server decides when a chest or a monster has appeared, where the monster stands, and how every fight
 * goes (lazily: each request carries the fight forward to the server's clock), so this asks it: when the game starts, when the next
 * spawn is due, when the tab comes back into view, when an action finds out the server wants an absence claimed first - and while a
 * fight runs, when the server says the fight will be over: it runs the open fight to its end and sends the plan (`CombatView.plan`), which the
 * browser draws in between, so a fight costs one poll and not one every 2 s. Only a fight the server could not plan (it is `behind`) is asked about
 * every few seconds (`COMBAT.poll`: quick with the combat panel open, slow when it is minimized or the tab is hidden).
 * Each answer carries the tickets and the player's combat, and the server says when it would like to be asked again.
 */
export const useSpawnSync = (userId: string, active: boolean) => {
	useEffect(() => {
		if (!active) return;
		// where this browser stopped in the server's combat log (so a fight that ended while the page was away is still paid out, once)
		setCursorUser(userId);
		const cursor = readCursor(userId);
		if (cursor !== null && useGameStore.getState().combat.eventNo === null)
			useGameStore.setState((state) => ({ combat: { ...state.combat, eventNo: cursor } }));
		let stopped = false;
		let running = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let spawnDueAt = Infinity; // when the next spawn is due by this browser's clock (epoch ms)

		const schedule = (sec: number) => {
			clearTimeout(timer);
			if (!stopped) timer = setTimeout(() => void run(), sec * 1000);
		};
		const run = async () => {
			if (running || stopped) return;
			running = true;
			try {
				const reply = await requestSync(useGameStore.getState().combat.eventNo ?? undefined);
				if (stopped) return;
				if (reply.status === 'ok') {
					useGameStore.getState().applyServerTickets(reply.value);
					const { combat, nextInSec } = reply.value;
					const spawnWait = Math.min(MAX_WAIT_SEC, Math.max(MIN_WAIT_SEC, (nextInSec ?? MAX_WAIT_SEC) + 2));
					spawnDueAt = Date.now() + spawnWait * 1000;
					const watching = !useUiStore.getState().combatMinimized && document.visibilityState === 'visible';
					// a running fight is asked about at the pace of the panel; an idle player when something can change
					const combatWait = combat.fight && !combat.plan && !watching ? Math.max(combat.nextPollSec, COMBAT.poll.minimizedSec) : combat.nextPollSec;
					schedule(Math.max(0.5, Math.min(spawnWait, combatWait)));
				} else if (reply.status === 'need_claim') {
					await runOfflineClaim(userId, true);
					schedule(3);
				} else if (reply.status === 'no_save') {
					// the account has no cloud save, so nothing can spawn: upload now instead of waiting for the next scheduled save, then ask again
					const saver = currentCloudSaver();
					if (saver) await saver.run();
					schedule(saver ? 5 : RETRY_SEC);
				} else {
					schedule(RETRY_SEC); // the server is not set up, or an outage: nothing to run until it is back
				}
			} finally {
				running = false;
			}
		};

		setNeedClaimHandler(() => void run());
		// an answer to a click or a hotkey brought a new plan: the poll follows it (but never later than the next spawn is due)
		setPollHandler((sec) => {
			if (running) return;
			schedule(Math.max(0.5, Math.min(sec, (spawnDueAt - Date.now()) / 1000)));
		});
		const onVisible = () => {
			if (document.visibilityState === 'visible') void run();
		};
		document.addEventListener('visibilitychange', onVisible);
		void run();

		return () => {
			stopped = true;
			clearTimeout(timer);
			setNeedClaimHandler(null);
			setPollHandler(null);
			document.removeEventListener('visibilitychange', onVisible);
		};
	}, [userId, active]);
};
