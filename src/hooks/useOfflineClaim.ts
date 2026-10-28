import { useEffect, useState } from 'react';
import { runOfflineClaim } from '@/lib/offlineFlow';

export type ClaimState = 'idle' | 'claiming' | 'done';

/** The game waits this long for the server before it starts anyway (a late answer is still applied when it arrives). */
const CLAIM_WAIT_MS = 6000;

/**
 * Asks the server what the player's absence was worth, once per start of the game and before the game loop begins, and applies it
 * (store.applyOfflineClaim) and shows the welcome-back window. The claim carries an
 * idempotency key that survives a reload, so an answer that got lost is replayed by the server instead of paid twice or lost.
 */
export const useOfflineClaim = (userId: string, ready: boolean): ClaimState => {
	const [state, setState] = useState<ClaimState>('idle');

	useEffect(() => {
		if (!ready) return;
		let alive = true;
		const finish = () => {
			if (alive) setState('done');
		};
		setState('claiming');
		const timeout = setTimeout(finish, CLAIM_WAIT_MS);
		void runOfflineClaim(userId).then(() => {
			clearTimeout(timeout);
			finish();
		});
		return () => {
			alive = false;
			clearTimeout(timeout);
		};
	}, [userId, ready]);

	return state;
};
