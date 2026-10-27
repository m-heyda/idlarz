import { useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { pickPersisted } from '@/lib/sanitizeSave';
import { exportSaveText, flushSaves } from '@/lib/saveStorage';
import { adoptOwnSave, pushCloud, readLink, recordAttempt, writeAttempts, writeLink } from '@/lib/cloudClient';
import { onSaveEvent } from '@/lib/saveEvents';
import { createSyncScheduler, type PushOutcome, type PushReason } from '@/lib/syncPolicy';
import { registerCloudSaver } from '@/lib/manualCloudSave';

/**
 * Copies the game to the signed-in account's cloud save (cadence and limits: syncPolicy.ts): shortly after the game starts,
 * soon after a milestone (purchase, castle upgrade, rebirth, level up), every 5 min while idle, and when the tab is hidden
 * or closed, and on demand from the menu's "Save game" (registered below, at most once per 10 min, lib/manualCloudSave.ts). The local save
 * stays the primary copy; a failed upload is retried with backoff.
 * Stops for the session when the account's save moved on elsewhere (409), the server refuses this save, or the login is gone.
 */
export const useCloudSync = (userId: string | null, active: boolean) => {
	useEffect(() => {
		if (!userId || !active) return;
		let lastSentPlay = -1;

		const push = async (reason: PushReason): Promise<PushOutcome> => {
			const hiding = reason === 'hide';
			const manual = reason === 'manual';
			const link = readLink();
			if (!link || link.userId !== userId) return 'ok';
			const state = pickPersisted(useGameStore.getState());
			if (!manual && state.playSeconds === lastSentPlay) return 'ok'; // the game did not run since the last upload (paused or hidden); a manual save always goes out
			const text = exportSaveText(state);
			recordAttempt({ userId, baseRev: link.rev, playSeconds: state.playSeconds }); // the page may die before the answer comes
			let result = await pushCloud(text, link.rev, hiding);
			if (result.status === 'conflict') {
				// "newer save" can be this browser's own upload whose answer was lost (a reload sends one as the page closes): carry on from it
				const rev = await adoptOwnSave(userId);
				if (rev !== null) {
					recordAttempt({ userId, baseRev: rev, playSeconds: state.playSeconds });
					result = await pushCloud(text, rev, hiding);
				}
			}
			switch (result.status) {
				case 'ok':
					lastSentPlay = state.playSeconds;
					writeLink({ userId, rev: result.rev });
					writeAttempts([]);
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
			push,
		});
		scheduler.start();
		const unregister = registerCloudSaver({ userId, run: () => scheduler.runNow() });

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
			unregister();
			offEvents();
			document.removeEventListener('visibilitychange', onHide);
			window.removeEventListener('pagehide', onPageHide);
		};
	}, [userId, active]);
};
