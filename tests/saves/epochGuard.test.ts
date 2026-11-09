import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { BASELINE_EPOCH, epochVerdict, wipeStaleBrowser, type WipeDeps } from '../../src/lib/epochGuard';
import { canResumeTab, cloudSaveGone, planStart, type CloudLink } from '../../src/lib/startPlan';
import { fetchMe } from '../../src/lib/authClient';

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

test('the verdict: no epoch from the server does nothing, a newer one wipes, the baseline is only recorded', () => {
	assert.equal(epochVerdict(null, undefined), 'none'); // the server does not send an epoch yet
	assert.equal(epochVerdict(3, undefined), 'none');
	assert.equal(epochVerdict(null, BASELINE_EPOCH), 'record'); // a new browser, or one from before the guard, on the current epoch
	assert.equal(epochVerdict(BASELINE_EPOCH, BASELINE_EPOCH), 'none');
	assert.equal(epochVerdict(null, BASELINE_EPOCH + 1), 'wipe'); // a browser from before the guard meets the flip
	assert.equal(epochVerdict(BASELINE_EPOCH, BASELINE_EPOCH + 1), 'wipe');
	assert.equal(epochVerdict(5, 4), 'none'); // the constant was rolled back: never wipe on that
});

test('fetchMe passes the epoch through only when it is a sound number', async () => {
	const answer = (body: unknown) => {
		globalThis.fetch = (async () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
	};
	const user = { id: 'u1' };
	answer({ user, profile: null, epoch: 2, needsReset: true });
	assert.deepEqual(await fetchMe(), { status: 'ok', userId: 'u1', profile: null, epoch: 2, needsReset: true });
	answer({ user, profile: null, epoch: 'two' });
	assert.deepEqual(await fetchMe(), { status: 'ok', userId: 'u1', profile: null });
	answer({ user, profile: null, epoch: 0, needsReset: false });
	assert.deepEqual(await fetchMe(), { status: 'ok', userId: 'u1', profile: null });
});

/** A fake browser: the keys the wipe must clear, as one in-memory map. */
const fakeBrowser = (keys: Record<string, string>) => {
	const log: string[] = [];
	const deps: WipeDeps & { archiveOk: boolean } = {
		archiveOk: true,
		archiveLocal() {
			log.push('archive');
			return this.archiveOk;
		},
		resetLocal: async () => {
			log.push('reset');
			delete keys.save;
		},
		clearKeys: () => {
			log.push('clear');
			for (const k of ['link', 'attempts', 'cursor', 'pending', 'manual', 'conflicts', 'entered']) delete keys[k];
		},
		recordEpoch: (epoch) => {
			log.push('record');
			keys.epoch = String(epoch);
		},
	};
	return { log, deps };
};

test('flip scenario: a stale link and a stale save end in a fresh start with a link the server accepts (no 409 loop, no no_save)', async () => {
	const keys: Record<string, string> = {
		save: 'old game',
		link: JSON.stringify({ userId: 'u1', rev: 416 }),
		attempts: '[...]',
		cursor: '57',
		pending: 'abc',
		manual: '1',
		conflicts: '{}',
		entered: 'account',
		epoch: '1',
	};
	const { log, deps } = fakeBrowser(keys);
	assert.equal(epochVerdict(Number(keys.epoch), 2), 'wipe');
	assert.equal(await wipeStaleBrowser(2, deps), true);
	assert.deepEqual(log, ['archive', 'reset', 'clear', 'record']); // the epoch is recorded last
	assert.deepEqual(Object.keys(keys), ['epoch']);
	assert.equal(keys.epoch, '2');
	// after the reload: the account has no save (the server reset it), this browser has no link and no game
	const link: CloudLink | null = keys.link ? JSON.parse(keys.link) : null;
	assert.equal(link, null);
	assert.equal(canResumeTab(link, 'u1'), false); // the start check runs: the tab does not skip it on the strength of the "entered" flag
	assert.deepEqual(planStart({ kind: 'none' }, null, link, 'u1'), { kind: 'enter' }); // a fresh game; the page then writes link rev 0
	// the first upload is based on rev 0, which is what the server answers for an account with no row, so no conflict can follow
	assert.equal(cloudSaveGone(0), true);
	assert.equal(epochVerdict(Number(keys.epoch), 2), 'none'); // and the guard does not fire again
});

test('a wipe that cannot keep a copy of the old game changes nothing and does not record the epoch (tried again on the next load)', async () => {
	const keys: Record<string, string> = { save: 'old game', link: JSON.stringify({ userId: 'u1', rev: 3 }), epoch: '1' };
	const { log, deps } = fakeBrowser(keys);
	deps.archiveOk = false;
	assert.equal(await wipeStaleBrowser(2, deps), false);
	assert.deepEqual(log, ['archive']);
	assert.deepEqual(Object.keys(keys).sort(), ['epoch', 'link', 'save']);
	assert.equal(keys.epoch, '1');
	assert.equal(epochVerdict(Number(keys.epoch), 2), 'wipe');
});
