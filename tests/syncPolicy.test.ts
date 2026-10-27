import test from 'node:test';
import assert from 'node:assert/strict';
import { SYNC, createSyncScheduler, shouldKeepalive, type PushOutcome, type PushReason } from '../src/lib/syncPolicy';

/** A fake clock: timers fire in order while time is advanced, and async pushes get to settle between them. */
const harness = (outcomes: PushOutcome[] | ((n: number) => PushOutcome) = () => 'ok') => {
	let now = 1_000_000;
	let nextId = 1;
	const timers = new Map<number, { at: number; fn: () => void }>();
	const pushes: { at: number; reason: PushReason }[] = [];
	const next = typeof outcomes === 'function' ? outcomes : (n: number) => outcomes[Math.min(n, outcomes.length - 1)];
	const scheduler = createSyncScheduler({
		now: () => now,
		setTimer: (fn, ms) => {
			const id = nextId++;
			timers.set(id, { at: now + ms, fn });
			return id;
		},
		clearTimer: (handle) => void timers.delete(handle as number),
		push: async (reason) => {
			pushes.push({ at: now, reason });
			return next(pushes.length - 1);
		},
	});
	const settle = async () => {
		for (let i = 0; i < 5; i++) await Promise.resolve();
	};
	const advance = async (ms: number) => {
		const end = now + ms;
		for (;;) {
			const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
			if (!due) break;
			timers.delete(due[0]);
			now = Math.max(now, due[1].at);
			due[1].fn();
			await settle();
		}
		now = end;
		await settle();
	};
	return { scheduler, advance, pushes, settle, clock: () => now };
};

const MIN = 60_000;

test('the first upload comes shortly after the game starts', async () => {
	const h = harness();
	h.scheduler.start();
	await h.advance(SYNC.firstMs - 1);
	assert.equal(h.pushes.length, 0);
	await h.advance(2);
	assert.deepEqual(h.pushes.map((p) => p.reason), ['first']);
});

test('an idle hour costs a handful of uploads, not forty', async () => {
	const h = harness();
	h.scheduler.start();
	await h.advance(60 * MIN);
	assert.ok(h.pushes.length >= 11 && h.pushes.length <= 13, `got ${h.pushes.length}`);
	for (let i = 1; i < h.pushes.length; i++) assert.ok(h.pushes[i].at - h.pushes[i - 1].at >= SYNC.heartbeatMs - 1);
});

test('events are saved soon, and a burst of them is one upload', async () => {
	const h = harness();
	h.scheduler.start();
	await h.advance(10_000); // the first upload is done
	h.pushes.length = 0;
	await h.advance(SYNC.eventGapMs); // out of the gap: an event is now limited by the settle time only
	for (let i = 0; i < 20; i++) {
		h.scheduler.event();
		await h.advance(100);
	}
	await h.advance(SYNC.eventSettleMs + SYNC.eventGapMs);
	assert.equal(h.pushes.filter((p) => p.reason === 'event').length, 1);
});

test('an event after a quiet spell is uploaded within the settle time', async () => {
	const h = harness();
	h.scheduler.start();
	await h.advance(2 * MIN);
	h.pushes.length = 0;
	h.scheduler.event();
	await h.advance(SYNC.eventSettleMs - 1);
	assert.equal(h.pushes.length, 0, 'waits for more events to settle');
	await h.advance(2);
	assert.deepEqual(h.pushes.map((p) => p.reason), ['event']);
});

test('events never beat the minimum gap, however many arrive', async () => {
	const h = harness();
	h.scheduler.start();
	await h.advance(10_000);
	h.pushes.length = 0;
	for (let i = 0; i < 400; i++) {
		h.scheduler.event();
		await h.advance(1000);
	}
	for (let i = 1; i < h.pushes.length; i++) assert.ok(h.pushes[i].at - h.pushes[i - 1].at >= SYNC.eventGapMs - 1);
	assert.ok(h.pushes.length <= 400 / (SYNC.eventGapMs / 1000) + 1, `got ${h.pushes.length} in 400 s`);
});

test('hiding the tab uploads once, and never inside the server floor', async () => {
	const h = harness();
	h.scheduler.start();
	await h.advance(30_000);
	h.pushes.length = 0;
	h.scheduler.hide();
	h.scheduler.hide();
	await h.settle();
	assert.deepEqual(h.pushes.map((p) => p.reason), ['hide'], 'two hide events at once make one upload');
	await h.advance(5000);
	h.scheduler.hide();
	await h.settle();
	assert.equal(h.pushes.length, 1, 'a second hide 5 s later is skipped');
	await h.advance(SYNC.hideGapMs);
	h.scheduler.hide();
	await h.settle();
	assert.equal(h.pushes.length, 2);
});

test('a failed upload backs off 30 s, 1 min, 2 min, then 5 min, and starts over after a success', async () => {
	let n = 0;
	const h = harness(() => (n++ < 5 ? 'retry' : 'ok'));
	h.scheduler.start();
	await h.advance(30 * MIN);
	const gaps = h.pushes.slice(1, 6).map((p, i) => p.at - h.pushes[i].at);
	assert.deepEqual(gaps.slice(0, 4), [30_000, 60_000, 120_000, 300_000]);
	assert.equal(gaps[4], 300_000, 'capped at the heartbeat');
	// after the first success the cadence is the normal heartbeat again
	const after = h.pushes.slice(5);
	for (let i = 1; i < after.length; i++) assert.ok(after[i].at - after[i - 1].at >= SYNC.heartbeatMs - 1);
});

test('stop means stop: no timers, no events, no hide uploads', async () => {
	const h = harness(['stop']);
	h.scheduler.start();
	await h.advance(10_000);
	assert.equal(h.pushes.length, 1);
	h.scheduler.event();
	h.scheduler.hide();
	await h.advance(30 * MIN);
	assert.equal(h.pushes.length, 1);
});

test('an event during an upload is uploaded after it, not lost and not in parallel', async () => {
	let release: () => void = () => undefined;
	let inFlight = 0;
	let overlap = false;
	let now = 0;
	const timers: { at: number; fn: () => void }[] = [];
	const pushes: number[] = [];
	const scheduler = createSyncScheduler({
		now: () => now,
		setTimer: (fn, ms) => timers.push({ at: now + ms, fn }),
		clearTimer: () => undefined,
		push: () =>
			new Promise<PushOutcome>((resolve) => {
				inFlight++;
				if (inFlight > 1) overlap = true;
				pushes.push(now);
				release = () => {
					inFlight--;
					resolve('ok');
				};
			}),
	});
	scheduler.start();
	now = SYNC.firstMs;
	timers.shift()?.fn(); // the first upload starts and stays in flight
	scheduler.event();
	scheduler.hide();
	assert.equal(pushes.length, 1);
	release();
	await Promise.resolve();
	await Promise.resolve();
	assert.equal(overlap, false);
});

test('keepalive is only asked for when the body fits the browser limit (64 KiB)', () => {
	assert.equal(shouldKeepalive('x'.repeat(1000)), true);
	assert.equal(shouldKeepalive('x'.repeat(SYNC.keepaliveMaxBytes + 1)), false);
	// multi-byte text counts in bytes, not characters
	assert.equal(shouldKeepalive('é'.repeat(SYNC.keepaliveMaxBytes / 2 + 1)), false);
});
