const LOCK_NAME = 'idlarz-cloud-push';

interface LockManagerLike {
	request: (name: string, callback: () => Promise<unknown>) => Promise<unknown>;
}

const defaultLocks = (): LockManagerLike | null =>
	typeof navigator !== 'undefined' && 'locks' in navigator ? (navigator.locks as unknown as LockManagerLike) : null;

/**
 * One upload at a time per browser. Everything that reads the link, uploads and writes the new link back runs inside this lock, so a second
 * tab (a tab that took the game over from the first, or a browser without the game-owner lock) waits for the upload in flight and then reads the
 * revision it left, instead of sending the one it read before. Without Web Locks the work simply runs (graceful fallback), and a conflict that
 * still happens is resolved by `resolveConflict`. The lock dies with the page, so a closing tab never holds it up.
 *
 * @category Saves & Server/Uploading
 * @order 4
 */
export const withPushLock = <T>(work: () => Promise<T>, locks: LockManagerLike | null = defaultLocks()): Promise<T> => {
	if (!locks) return work();
	let started = false;
	return (locks.request(LOCK_NAME, () => ((started = true), work())) as Promise<T>).catch((error: unknown) => {
		if (started) throw error; // the work itself failed
		return work(); // the lock could not be asked for (insecure context, blocked storage): carry on without it
	});
};
