import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { setSavePaused } from '@/lib/saveStorage';

const LOCK_NAME = 'idlarz-game-owner';

export type TabStatus = 'checking' | 'owner' | 'blocked';

/**
 * Only one tab may run the game. Two tabs would each tick and overwrite each other's save.
 * The owning tab holds a Web Lock; another tab sees 'blocked' and can take over (the previous owner is
 * demoted and stops writing). Browsers without Web Locks simply run as owner.
 */
export const useSingleTab = () => {
	const [status, setStatus] = useState<TabStatus>('checking');
	const release = useRef<(() => void) | null>(null);

	const acquire = useCallback((steal: boolean) => {
		if (typeof navigator === 'undefined' || !('locks' in navigator)) {
			setStatus('owner');
			return;
		}
		navigator.locks
			.request(LOCK_NAME, steal ? { steal: true } : { ifAvailable: true }, (lock) => {
				if (!lock) {
					setSavePaused(true);
					setStatus('blocked');
					return undefined;
				}
				if (steal) {
					// The previous owner saved up to a moment ago: continue from its save, not from this stale tab
					void useGameStore.persist.rehydrate();
				}
				setSavePaused(false);
				setStatus('owner');
				return new Promise<void>((resolve) => {
					release.current = resolve;
				});
			})
			.catch(() => {
				// Our lock was stolen by another tab
				setSavePaused(true);
				setStatus('blocked');
			});
	}, []);

	useEffect(() => {
		acquire(false);
		return () => release.current?.();
	}, [acquire]);

	return { status, takeOver: () => acquire(true) };
};
