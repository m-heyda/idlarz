import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { newClaimId, readPendingClaim, requestClaim, writePendingClaim } from '@/lib/offlineClient';

// Claims what an absence was worth and applies it. Used at the start of the game (useOfflineClaim) and again whenever the server says an
// absence has to be claimed before anything else (a laptop that slept with the tab open).

const RETRIES = 3;
const RETRY_MS = 1500;

// A claim answer is applied once, even when the effect runs twice (React strict mode in development, a tab taking the game over)
const applied = new Set<string>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 'done': answered (paid or nothing due, nothing more to do); 'failed': the server could not be reached (the key is kept: the next try repeats it). */
export const runOfflineClaim = async (userId: string, fresh = false): Promise<'done' | 'failed'> => {
	const id = (!fresh && readPendingClaim(userId)) || newClaimId();
	writePendingClaim(userId, id);
	for (let attempt = 0; attempt < RETRIES; attempt++) {
		const response = await requestClaim(id);
		if (response.status === 'ok') {
			if (!applied.has(id)) {
				applied.add(id);
				const report = useGameStore.getState().applyOfflineClaim(response.result);
				if (report) useUiStore.getState().showOfflineReport(report);
			}
			writePendingClaim(userId, null);
			return 'done';
		}
		if (response.status === 'no_save') {
			writePendingClaim(userId, null);
			return 'done';
		}
		await sleep(RETRY_MS);
	}
	return 'failed';
};
