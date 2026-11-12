/** Where the daily bonus window remembers "Don't show again today" (per browser). */
export const DAILY_HIDE_KEY = 'idlarz.daily.hide';

/** The UTC day as `YYYY-MM-DD`: the daily bonus rolls over at 00:00 UTC, so "today" is counted the same way here. */
export const utcDay = (nowMs: number = Date.now()): string => new Date(nowMs).toISOString().slice(0, 10);

/** Whether the player ticked "Don't show again today" on this UTC day. Storage that cannot be read counts as not hidden. */
export const dailyHiddenToday = (nowMs: number = Date.now()): boolean => {
	try {
		return localStorage.getItem(DAILY_HIDE_KEY) === utcDay(nowMs);
	} catch {
		return false;
	}
};

/** Remembers (or forgets) "Don't show again today": the window then stays away until the next UTC day. */
export const setDailyHidden = (hidden: boolean, nowMs: number = Date.now()): void => {
	try {
		if (hidden) localStorage.setItem(DAILY_HIDE_KEY, utcDay(nowMs));
		else localStorage.removeItem(DAILY_HIDE_KEY);
	} catch {
		/* private mode or blocked storage: the window just shows again next time */
	}
};

/**
 * Whether the daily bonus window should open now: the start of the game is done, the welcome-back window is closed (it comes first), the window was not asked yet this session,
 * the player did not hide it for today and the server says today's bonus can be claimed. Pure, so the order of windows is tested.
 */
export const shouldOpenDaily = (facts: { ready: boolean; offlineReportOpen: boolean; asked: boolean; hiddenToday: boolean; claimable: boolean }): boolean =>
	facts.ready && !facts.offlineReportOpen && !facts.asked && !facts.hiddenToday && facts.claimable;
