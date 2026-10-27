import test from 'node:test';
import assert from 'node:assert/strict';
import {
	MANUAL_CLOUD_COOLDOWN_MS,
	cloudHint,
	cooldownLeftMs,
	formatCountdown,
	manualSaveMessage,
	registerCloudSaver,
	saveGameEverywhere,
	type CloudSaver,
	type ManualStore,
} from '../src/lib/manualCloudSave';

const memoryStore = (): ManualStore & { data: Map<string, number> } => {
	const data = new Map<string, number>();
	return { data, read: (u) => data.get(u) ?? null, write: (u, at) => void data.set(u, at) };
};
const MIN = 60_000;

test('the countdown is mm:ss, rounded up so it never reads 0:00 while locked', () => {
	assert.equal(formatCountdown(10 * MIN), '10:00');
	assert.equal(formatCountdown(425_000), '7:05');
	assert.equal(formatCountdown(1), '0:01');
	assert.equal(formatCountdown(59_001), '1:00');
	assert.equal(formatCountdown(0), '0:00');
	assert.equal(formatCountdown(-5), '0:00');
});

test('the limit is ten minutes per account and never longer than that, even if the clock was set back', () => {
	const store = memoryStore();
	assert.equal(MANUAL_CLOUD_COOLDOWN_MS, 10 * MIN);
	assert.equal(cooldownLeftMs('a', 5000, store), 0);
	store.write('a', 1_000_000);
	assert.equal(cooldownLeftMs('a', 1_000_000, store), 10 * MIN);
	assert.equal(cooldownLeftMs('a', 1_000_000 + 4 * MIN, store), 6 * MIN);
	assert.equal(cooldownLeftMs('a', 1_000_000 + 10 * MIN, store), 0);
	assert.equal(cooldownLeftMs('b', 1_000_000, store), 0, 'another account has its own limit');
	assert.equal(cooldownLeftMs('a', 1_000_000 - 3 * 60 * MIN, store), 10 * MIN, 'a clock set far back cannot lock it for hours');
});

const saverReturning = (...outcomes: Awaited<ReturnType<CloudSaver['run']>>[]) => {
	let calls = 0;
	const saver: CloudSaver = { userId: 'u1', run: async () => outcomes[Math.min(calls++, outcomes.length - 1)] };
	return { saver, calls: () => calls };
};

test('without an account it only saves here', async () => {
	const r = await saveGameEverywhere({ saveLocal: async () => true, now: () => 1, saver: null, store: memoryStore() });
	assert.deepEqual(r, { local: true, cloud: 'no_account' });
	assert.equal(manualSaveMessage(r), 'Game saved');
});

test('a failed local save never goes to the cloud', async () => {
	const { saver, calls } = saverReturning('ok');
	const r = await saveGameEverywhere({ saveLocal: async () => false, now: () => 1, saver, store: memoryStore() });
	assert.deepEqual(r, { local: false });
	assert.equal(calls(), 0);
	assert.match(manualSaveMessage(r), /Could not save/);
});

test('one cloud save per ten minutes: the second press only saves here and says when the cloud is next', async () => {
	const store = memoryStore();
	const { saver, calls } = saverReturning('ok');
	let now = 5_000_000;
	const press = () => saveGameEverywhere({ saveLocal: async () => true, now: () => now, saver, store });
	assert.deepEqual(await press(), { local: true, cloud: 'saved' });
	assert.equal(calls(), 1);
	now += 3 * MIN + 30_000;
	const again = await press();
	assert.deepEqual(again, { local: true, cloud: 'cooldown', leftMs: 6 * MIN + 30_000 });
	assert.equal(calls(), 1, 'no second upload');
	assert.equal(manualSaveMessage(again), 'Game saved. Cloud save again in 6:30');
	now += 6 * MIN + 30_000;
	assert.deepEqual(await press(), { local: true, cloud: 'saved' });
	assert.equal(calls(), 2);
});

test('only an upload that went through starts the wait: a failure, a busy scheduler or a paused one can be tried again at once', async () => {
	for (const [outcome, cloud] of [['retry', 'failed'], ['busy', 'busy'], ['stopped', 'stopped'], ['stop', 'stopped']] as const) {
		const store = memoryStore();
		const { saver } = saverReturning(outcome, 'ok');
		const first = await saveGameEverywhere({ saveLocal: async () => true, now: () => 100, saver, store });
		assert.deepEqual(first, { local: true, cloud }, outcome);
		assert.equal(store.read('u1'), null, `${outcome} starts no wait`);
		assert.ok(manualSaveMessage(first).startsWith('Game saved here'), outcome);
	}
	const store = memoryStore();
	const { saver } = saverReturning('retry', 'ok');
	await saveGameEverywhere({ saveLocal: async () => true, now: () => 100, saver, store });
	assert.deepEqual(await saveGameEverywhere({ saveLocal: async () => true, now: () => 200, saver, store }), { local: true, cloud: 'saved' });
});

test('the menu hint is empty without an account and counts down with one', () => {
	const store = memoryStore();
	assert.equal(cloudHint(1000, store), undefined);
	const off = registerCloudSaver({ userId: 'u9', run: async () => 'ok' });
	try {
		assert.equal(cloudHint(1000, store), 'cloud ready');
		store.write('u9', 1000);
		assert.equal(cloudHint(1000 + 2 * MIN + 5_000, store), 'cloud in 7:55');
		assert.equal(cloudHint(1000 + 10 * MIN, store), 'cloud ready');
	} finally {
		off();
	}
	assert.equal(cloudHint(1000, store), undefined, 'removed when cloud saving stops');
});
