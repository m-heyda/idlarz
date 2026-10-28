import { useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { requestSync } from '@/lib/rewardsClient';
import { runOfflineClaim } from '@/lib/offlineFlow';
import { setNeedClaimHandler } from '@/lib/serverSession';

const MIN_WAIT_SEC = 20;
const MAX_WAIT_SEC = 600;
const RETRY_SEC = 60;

/**
 * For a signed-in player the server decides when a chest or a monster has appeared. This asks it: when the game starts, when the next one
 * is due (the answer says when), when the tab comes back into view, and when an action finds out the server wants an absence claimed first.
 * It also tells the store that spawns are the server's (`serverSpawns`), so the local spawn timers stand still.
 */
export const useSpawnSync = (userId: string | null, active: boolean) => {
	useEffect(() => {
		if (!userId || !active) return;
		const store = useGameStore.getState();
		store.setServerSpawns(true);
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
				const reply = await requestSync();
				if (stopped) return;
				if (reply.status === 'ok') {
					useGameStore.getState().applyServerTickets(reply.value);
					schedule(Math.min(MAX_WAIT_SEC, Math.max(MIN_WAIT_SEC, (reply.value.nextInSec ?? MAX_WAIT_SEC) + 2)));
				} else if (reply.status === 'not_configured') {
					// the server cannot seal rolls (no LOOT_SECRET): play with the local spawns, as a guest would
					useGameStore.getState().setServerSpawns(false);
					stopped = true;
				} else if (reply.status === 'need_claim') {
					await runOfflineClaim(userId, true);
					schedule(3);
				} else {
					schedule(RETRY_SEC);
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
			useGameStore.getState().setServerSpawns(false);
		};
	}, [userId, active]);
};
