/**
 * When the game is copied to the account's cloud save. Pure: the clock, the timers and the upload itself are injected,
 * so the cadence is tested without a browser.
 *
 *   first upload     4 s after the game starts
 *   events           a purchase, castle upgrade, rebirth, level up: uploaded after a short settle (5 s) so a burst is ONE
 *                    upload, and never closer than 30 s to the previous attempt
 *   heartbeat        every 5 min (idle income is rebuilt from the rates on the server, so frequent uploads add nothing)
 *   hiding the tab   uploaded at once, unless an upload was tried in the last 11 s (the server accepts one per 10 s)
 *   failure          30 s, 1 min, 2 min, 5 min, then 5 min; back to normal after a success
 */
export const SYNC = {
	firstMs: 4000,
	heartbeatMs: 5 * 60_000,
	eventSettleMs: 5000,
	eventGapMs: 30_000,
	hideGapMs: 11_000,
	backoffMs: [30_000, 60_000, 120_000, 300_000],
	/** Browsers refuse a keepalive request body above 64 KiB (the fetch throws): stay under it. */
	keepaliveMaxBytes: 60_000,
} as const;

export type PushReason = 'first' | 'event' | 'heartbeat' | 'hide' | 'retry';
/** `ok`: nothing to do (also when there was nothing new to send); `retry`: try again with backoff; `stop`: give up for this session. */
export type PushOutcome = 'ok' | 'retry' | 'stop';

export interface SyncDeps {
	now: () => number;
	setTimer: (fn: () => void, ms: number) => unknown;
	clearTimer: (handle: unknown) => void;
	push: (reason: PushReason) => Promise<PushOutcome>;
}

/** A keepalive request must stay small: measured in bytes of the JSON body the client sends. */
export const shouldKeepalive = (text: string): boolean => new TextEncoder().encode(text).length <= SYNC.keepaliveMaxBytes;

export const createSyncScheduler = (deps: SyncDeps) => {
	let started = false;
	let stopped = false;
	let busy = false;
	let startedAt = 0;
	let lastAttemptAt = -Infinity;
	let eventAt: number | null = null; // when the oldest unsent event happened
	let failures = 0;
	let timer: unknown = null;

	const clear = () => {
		if (timer !== null) deps.clearTimer(timer);
		timer = null;
	};

	/** The next moment something is due: the earlier of the heartbeat and the pending event, never before the backoff ends. */
	const dueAt = (): number => {
		const heartbeat = lastAttemptAt === -Infinity ? startedAt + SYNC.firstMs : lastAttemptAt + SYNC.heartbeatMs;
		const event = eventAt === null ? Infinity : Math.max(eventAt + SYNC.eventSettleMs, lastAttemptAt + SYNC.eventGapMs);
		const backoff = failures > 0 ? lastAttemptAt + SYNC.backoffMs[Math.min(failures, SYNC.backoffMs.length) - 1] : 0;
		return Math.max(Math.min(heartbeat, event), backoff);
	};

	const plan = () => {
		clear();
		if (!started || stopped || busy) return;
		timer = deps.setTimer(() => {
			timer = null;
			void run(lastAttemptAt === -Infinity ? 'first' : failures > 0 ? 'retry' : eventAt !== null ? 'event' : 'heartbeat');
		}, Math.max(0, dueAt() - deps.now()));
	};

	const run = async (reason: PushReason) => {
		if (!started || stopped || busy) return;
		clear();
		busy = true;
		lastAttemptAt = deps.now();
		eventAt = null; // whatever happens from here on is a new event
		let outcome: PushOutcome;
		try {
			outcome = await deps.push(reason);
		} catch {
			outcome = 'retry';
		}
		busy = false;
		if (outcome === 'stop') {
			stop();
			return;
		}
		if (outcome === 'retry') {
			failures++;
			eventAt = eventAt ?? lastAttemptAt; // the data is still unsent: retry after the backoff, not after the heartbeat
		} else {
			failures = 0;
		}
		plan();
	};

	const stop = () => {
		stopped = true;
		clear();
	};

	return {
		start: () => {
			if (started) return;
			started = true;
			startedAt = deps.now();
			plan();
		},
		stop,
		/** Something worth saving happened. */
		event: () => {
			if (!started || stopped) return;
			if (eventAt === null) eventAt = deps.now();
			plan();
		},
		/** The tab is being hidden or closed. */
		hide: () => {
			if (!started || stopped || busy) return;
			if (deps.now() - lastAttemptAt < SYNC.hideGapMs) return;
			void run('hide');
		},
	};
};
