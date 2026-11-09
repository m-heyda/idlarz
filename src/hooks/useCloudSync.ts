import { useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { pickPersisted } from '@/lib/sanitizeSave';
import { exportSaveText, flushSaves } from '@/lib/saveStorage';
import { noteConflict, pushCloud, readLink, recordAttempt, resolveConflict, writeAttempts, writeLink } from '@/lib/cloudClient';
import { withPushLock } from '@/lib/pushLock';
import { onSaveEvent } from '@/lib/saveEvents';
import { createSyncScheduler, type PushOutcome, type PushReason } from '@/lib/syncPolicy';
import { registerCloudSaver } from '@/lib/manualCloudSave';
import { writeEntered } from '@/lib/authClient';
import { cloudSaveGone } from '@/lib/startPlan';
import { countOwnedTiles } from '@/utils/game/tiles';

/**
 * Copies the game to the signed-in account's cloud save (cadence and limits: syncPolicy.ts): shortly after the game starts,
 * soon after a milestone (purchase, castle upgrade, rebirth, level up), every 5 min while idle, and when the tab is hidden
 * or closed, and on demand from the menu's "Save game" (registered below, at most once per 10 min, lib/manualCloudSave.ts). The local save
 * stays the primary copy; a failed upload is retried with backoff.
 * Stops for the session when the server refuses this save or the login is gone. A 409 (the account's save moved on) is looked at first
 * (`resolveConflict`): our own lost upload, or a save this browser's game is at least as far along as, is taken as the new base and uploaded over;
 * only a save that is ahead of this browser's (or another game) tells the player once and is re-checked with backoff, never given up for good.
 * Uploads run one at a time per browser (`withPushLock`, a Web Lock). A 409 that
 * reports revision 0 means the account has no save at all (reset): the link is dropped and the page reloads so the start check begins a new game.
 */
export const useCloudSync = (userId: string, active: boolean) => {
	useEffect(() => {
		if (!active) return;
		let lastSentPlay = -1;
		let toldDiverged = false;

		const push = (reason: PushReason): Promise<PushOutcome> =>
			// a closing tab must not wait for another tab's upload: its last upload goes out at once, like before
			reason === 'hide' ? pushOnce(reason) : withPushLock(() => pushOnce(reason));

		const pushOnce = async (reason: PushReason): Promise<PushOutcome> => {
			const hiding = reason === 'hide';
			const manual = reason === 'manual';
			const link = readLink();
			if (!link || link.userId !== userId) return 'ok';
			const state = pickPersisted(useGameStore.getState());
			if (!manual && state.playSeconds === lastSentPlay) return 'ok'; // the game did not run since the last upload (paused or hidden); a manual save always goes out
			const text = exportSaveText(state);
			recordAttempt({ userId, baseRev: link.rev, playSeconds: state.playSeconds }); // the page may die before the answer comes
			let result = await pushCloud(text, link.rev, hiding);
			if (result.status === 'conflict' && !cloudSaveGone(result.rev)) {
				// "newer save" is often this browser's own upload whose answer was lost, or a save this game is already ahead of: carry on from it
				const resolution = await resolveConflict(userId, {
					playSeconds: state.playSeconds,
					level: state.level.level,
					tilesOwned: countOwnedTiles(state.tiles),
					rebirths: state.prestige.rebirths,
				});
				noteConflict(resolution.kind);
				if (resolution.kind === 'rebased') {
					recordAttempt({ userId, baseRev: resolution.rev, playSeconds: state.playSeconds });
					result = await pushCloud(text, resolution.rev, hiding);
				}
			}
			switch (result.status) {
				case 'ok':
					// the server can explain less XP than this save held (it clamped it): the game takes the lower number
					if (result.xp !== undefined) useGameStore.getState().applyServerXp(result.xp);
					// ... and the same for Embers and rebirths a rebirth could not have paid
					if (result.prestige) useGameStore.getState().applyServerPrestige(result.prestige);
					lastSentPlay = state.playSeconds;
					writeLink({ userId, rev: result.rev });
					writeAttempts([]);
					return 'ok';
				case 'conflict':
					if (cloudSaveGone(result.rev)) {
						// the account has no save at all (a season reset or New Game removed it): this browser's link is stale, so the start check runs again
						useUiStore.getState().showToast('Your account was reset. Reloading to start a new game.');
						writeLink(null);
						writeAttempts([]);
						writeEntered(null);
						window.location.reload();
						return 'stop';
					}
					// the account's save is ahead of this browser's (or another game): nothing is overwritten. Say so once, look again later: the
					// other browser may stop, or this one may catch up
					if (!toldDiverged) {
						toldDiverged = true;
						useUiStore.getState().showToast('Your account has a newer save from another browser. Reload to choose.');
					}
					return 'retry';
				case 'rejected':
					useUiStore.getState().showToast(`Cloud save paused: the server refused this save (${result.message}).`);
					console.warn('Cloud save refused:', result.message);
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
