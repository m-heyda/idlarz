import { useEffect } from 'react';
import { COMBAT } from '@/config/combatConfig';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { readCursor, setCursorUser } from '@/lib/combatCursor';
import { requestSync } from '@/lib/rewardsClient';
import { runOfflineClaim } from '@/lib/offlineFlow';
import { setNeedClaimHandler } from '@/lib/serverSession';

const MIN_WAIT_SEC = 20;
const MAX_WAIT_SEC = 600;
const RETRY_SEC = 60;

/**
 * The one poll of the game. The server decides when a chest or a monster has appeared, where the monster stands, and how every fight
 * goes (lazily: each request carries the fight forward to the server's clock), so this asks it: when the game starts, when the next
 * spawn is due, when the tab comes back into view, when an action finds out the server wants an absence claimed first - and while a
 * fight runs, every few seconds (`COMBAT.poll`: quick with the combat panel open, slow when it is minimized or the tab is hidden).
 * Each answer carries the tickets and the player's combat, and the server says when it would like to be asked again.
 */
export const useSpawnSync = (userId: string, active: boolean) => {
	useEffect(() => {
		if (!active) return;
		// where this browser stopped in the server's combat log (so a fight that ended while the page was away is still paid out, once)
		setCursorUser(userId);
		const cursor = readCursor(userId);
		if (cursor !== null && useGameStore.getState().combat.eventNo === null) useGameStore.setState((state) => ({ combat: { ...state.combat, eventNo: cursor } }));
		let stopped = false;
		let running = false;
		let timer: ReturnType<typeof setTimeout> | undefined;

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
					const watching = !useUiStore.getState().combatMinimized && document.visibilityState === 'visible';
					// a running fight is asked about at the pace of the panel; an idle player when something can change
					const combatWait = combat.fight && !watching ? Math.max(combat.nextPollSec, COMBAT.poll.minimizedSec) : combat.nextPollSec;
					schedule(Math.max(0.5, Math.min(spawnWait, combatWait)));
				} else if (reply.status === 'need_claim') {
					await runOfflineClaim(userId, true);
					schedule(3);
				} else {
					schedule(RETRY_SEC); // no cloud save yet, the server is not set up, or an outage: nothing to run until it is back
				}
			} finally {
				running = false;
			}
		};

		setNeedClaimHandler(() => void run());
		const onVisible = () => {
			if (document.visibilityState === 'visible') void run();
		};
		document.addEventListener('visibilitychange', onVisible);
		void run();

		return () => {
			stopped = true;
			clearTimeout(timer);
			setNeedClaimHandler(null);
			document.removeEventListener('visibilitychange', onVisible);
		};
	}, [userId, active]);
};
