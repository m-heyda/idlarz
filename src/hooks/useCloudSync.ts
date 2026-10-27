import { useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { pickPersisted } from '@/lib/sanitizeSave';
import { exportSaveText, flushSaves } from '@/lib/saveStorage';
import { pushCloud, readLink, writeLink } from '@/lib/cloudClient';
import { onSaveEvent } from '@/lib/saveEvents';
import { createSyncScheduler, type PushOutcome } from '@/lib/syncPolicy';

/**
 * Copies the game to the signed-in account's cloud save (cadence and limits: syncPolicy.ts): shortly after the game starts,
 * soon after a milestone (purchase, castle upgrade, rebirth, level up), every 5 min while idle, and when the tab is hidden
 * or closed. The local save stays the primary copy; a failed upload is retried with backoff.
 * Stops for the session when the account's save moved on elsewhere (409), the server refuses this save, or the login is gone.
 */
export const useCloudSync = (userId: string | null, active: boolean) => {
	useEffect(() => {
		if (!userId || !active) return;
		let lastSentPlay = -1;

		const push = async (hiding: boolean): Promise<PushOutcome> => {
			const link = readLink();
			if (!link || link.userId !== userId) return 'ok';
			const state = pickPersisted(useGameStore.getState());
			if (state.playSeconds === lastSentPlay) return 'ok'; // the game did not run since the last upload (paused or hidden)
			const result = await pushCloud(exportSaveText(state), link.rev, hiding);
			switch (result.status) {
				case 'ok':
					lastSentPlay = state.playSeconds;
					writeLink({ userId, rev: result.rev });
					return 'ok';
				case 'conflict':
					useUiStore.getState().showToast('Your account has a newer save from another browser. Reload to choose.');
					return 'stop';
				case 'rejected':
					useUiStore.getState().showToast('Cloud save paused: the server refused this save.');
					return 'stop';
				case 'signed_out':
					useUiStore.getState().showToast('Cloud save paused: you are signed out. Reload to log in again.');
					return 'stop';
				default:
					return 'retry';
			}
		};

		const scheduler = createSyncScheduler({
			now: () => Date.now(),
			setTimer: (fn, ms) => setTimeout(fn, ms),
			clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
			push: (reason) => push(reason === 'hide'),
		});
		scheduler.start();

		const offEvents = onSaveEvent(() => {
			flushSaves(); // the milestone is on disk now, the cloud copy follows after a short settle
			scheduler.event();
		});
		const onHide = () => {
			if (document.visibilityState === 'hidden') scheduler.hide();
		};
		const onPageHide = () => scheduler.hide();
		document.addEventListener('visibilitychange', onHide);
		window.addEventListener('pagehide', onPageHide);
		return () => {
			scheduler.stop();
			offEvents();
			document.removeEventListener('visibilitychange', onHide);
			window.removeEventListener('pagehide', onPageHide);
		};
	}, [userId, active]);
};
