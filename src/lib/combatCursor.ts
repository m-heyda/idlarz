import { scoped } from '@/lib/storageScope';
// Where this browser is in the server's combat log: the number of the last event it applied (a win's loot, a drunk potion). Kept in
// localStorage next to the game save, so a reload asks for "everything after N" and neither loses the loot of a fight that ended while
// the page was away nor applies a result twice. Every access is guarded (private windows and blocked storage throw).

const KEY = scoped('idlarz.combat.cursor');

let user: string | null = null;

/** Which account the cursor belongs to (a cursor written for another account is ignored). */
export const setCursorUser = (userId: string | null): void => {
	user = userId;
};

export const readCursor = (userId: string): number | null => {
	try {
		const raw = window.localStorage.getItem(KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as { userId?: unknown; no?: unknown };
		return parsed.userId === userId && Number.isInteger(parsed.no) && (parsed.no as number) >= 0 ? (parsed.no as number) : null;
	} catch {
		return null;
	}
};

export const writeCursor = (no: number): void => {
	if (!user) return;
	try {
		window.localStorage.setItem(KEY, JSON.stringify({ userId: user, no }));
	} catch {
		/* storage unavailable: after a reload the log is read from the server's current end */
	}
};
