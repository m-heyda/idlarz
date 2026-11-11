import type { BootSnapshot } from '@/lib/offline/types';

/**
 * The browser's hand-over of the game's first load: `/play` asks `/api/auth/me?game=1` once, puts the answer's `game` part here, and `GameApp` takes it before its first paint
 * (it fills the crafting store and, once the save is read, the bag). Light on purpose (no store imports) so the gate does not pull the game into its bundle. Held per account: a snapshot is only
 * handed to the account it was read for, and `clearBootSnapshot` (sign-out) drops it.
 */
let staged: { userId: string; snapshot: BootSnapshot } | null = null;

export const stageBootSnapshot = (userId: string, snapshot: BootSnapshot | undefined): void => {
	staged = snapshot ? { userId, snapshot } : null;
};

/** The staged snapshot if it belongs to `userId` (taken once: a second call gets nothing). */
export const takeBootSnapshot = (userId: string): BootSnapshot | null => {
	const mine = staged && staged.userId === userId ? staged.snapshot : null;
	staged = null;
	return mine;
};

const resetters: (() => void)[] = [];

/** A store that holds per-account data registers how to empty itself (the crafting store does, at load). */
export const onAccountCleared = (reset: () => void): void => {
	resetters.push(reset);
};

/** Sign-out: nothing of the account that just left may stay in memory for the next one. */
export const clearBootSnapshot = (): void => {
	staged = null;
	resetters.forEach((reset) => reset());
};
