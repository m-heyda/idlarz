import { useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { pickPersisted } from '@/lib/sanitizeSave';
import { exportSaveText } from '@/lib/saveStorage';
import { pushCloud, readLink, writeLink } from '@/lib/cloudClient';

const FIRST_PUSH_MS = 4000;
const PUSH_EVERY_MS = 90_000;

/**
 * Copies the game to the signed-in account's cloud save: shortly after the game starts, every ~90 s while it changes,
 * and when the tab is hidden or closed. The local save stays the primary copy; a failed upload is simply retried.
 * Stops for the session when the account's save moved on elsewhere (409) or the server refuses this save.
 */
export const useCloudSync = (userId: string | null, active: boolean) => {
	useEffect(() => {
		if (!userId || !active) return;
		let stopped = false;
		let busy = false;
		let lastSentPlay = -1;

		const push = async (keepalive = false) => {
			if (stopped || busy) return;
			const link = readLink();
			if (!link || link.userId !== userId) return;
			const state = pickPersisted(useGameStore.getState());
			if (state.playSeconds === lastSentPlay) return; // nothing happened since the last upload
			busy = true;
			try {
				const result = await pushCloud(exportSaveText(state), link.rev, keepalive);
				if (result.status === 'ok') {
					lastSentPlay = state.playSeconds;
					writeLink({ userId, rev: result.rev });
				} else if (result.status === 'conflict') {
					stopped = true;
					useUiStore.getState().showToast('Your account has a newer save from another browser. Reload to choose.');
				} else if (result.status === 'rejected') {
					stopped = true;
					useUiStore.getState().showToast('Cloud save paused: the server refused this save.');
				}
			} finally {
				busy = false;
			}
		};

		const first = setTimeout(() => void push(), FIRST_PUSH_MS);
		const every = setInterval(() => void push(), PUSH_EVERY_MS);
		const onHide = () => {
			if (document.visibilityState === 'hidden') void push(true);
		};
		const onPageHide = () => void push(true);
		document.addEventListener('visibilitychange', onHide);
		window.addEventListener('pagehide', onPageHide);
		return () => {
			stopped = true;
			clearTimeout(first);
			clearInterval(every);
			document.removeEventListener('visibilitychange', onHide);
			window.removeEventListener('pagehide', onPageHide);
		};
	}, [userId, active]);
};
