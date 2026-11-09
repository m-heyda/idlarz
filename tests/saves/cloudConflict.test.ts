import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveConflict, type FetchCloud, type PushAttempt, type ResolveDeps } from '../../src/lib/cloudClient';
import { canRebase, type Progress } from '../../src/lib/cloudRecovery';
import { withPushLock } from '../../src/lib/pushLock';
import { encodeSave } from '../../src/lib/saveFormat';
import { createSyncScheduler, SYNC, type PushOutcome } from '../../src/lib/syncPolicy';
import { api, store } from '../helpers';
import { pickPersisted } from '../../src/lib/sanitizeSave';
import type { CloudLink } from '../../src/lib/startPlan';

const local: Progress = { playSeconds: 5000, level: 10, tilesOwned: 40, rebirths: 1 };

const stateOf = (p: Progress) => {
	api().resetGame();
	store.setState({
		playSeconds: p.playSeconds,
		prestige: { ...api().prestige, rebirths: p.rebirths, legacyEarned: p.rebirths * 10, legacyPoints: p.rebirths * 10 },
	} as never);
	return structuredClone(pickPersisted(api()));
};

const cloudAt = (rev: number, over: Partial<Progress> = {}, text?: string): FetchCloud => {
	const p = { ...local, ...over };
	return {
		status: 'ok',
		cloud: {
			rev,
			serverSavedAt: 1,
			text: text ?? encodeSave(stateOf(p)),
			summary: { level: p.level, tilesOwned: p.tilesOwned, playSeconds: p.playSeconds, gold: 1 },
		},
	};
};

const harness = (latest: FetchCloud, link: CloudLink | null, attempts: PushAttempt[] = []) => {
	const links: CloudLink[] = [];
	let cleared = 0;
	const deps: ResolveDeps = {
		fetchCloud: async () => latest,
		readAttempts: () => attempts,
		readLink: () => link,
		writeLink: (l) => void links.push(l),
		clearAttempts: () => void cleared++,
	};
	return { deps, links, cleared: () => cleared };
};

const link: CloudLink = { userId: 'u1', rev: 416 };

test('another writer saved twice between uploads: the game that is ahead re-bases on the new revision (adoptOwnSave could not)', async () => {
	// rev 416 -> 418: not "base + 1", so the old own-upload rule failed here and the sync stopped for the session
	const h = harness(cloudAt(418, { playSeconds: 4990 }), link);
	assert.deepEqual(await resolveConflict('u1', local, h.deps), { kind: 'rebased', rev: 418, via: 'ahead' });
	assert.deepEqual(h.links, [{ userId: 'u1', rev: 418 }]);
	assert.equal(h.cleared(), 1);
});

test('a cloud save that is ahead in play time, level or tiles is never overwritten', async () => {
	for (const over of [{ playSeconds: 5001 }, { level: 11 }, { tilesOwned: 41 }]) {
		const h = harness(cloudAt(418, over), link);
		assert.deepEqual(await resolveConflict('u1', local, h.deps), { kind: 'diverged', rev: 418 }, JSON.stringify(over));
		assert.deepEqual(h.links, []);
	}
});

test('another rebirth count is another run: the player chooses', async () => {
	assert.equal((await resolveConflict('u1', local, harness(cloudAt(418, { rebirths: 0 }), link).deps)).kind, 'diverged');
	assert.equal((await resolveConflict('u1', local, harness(cloudAt(418, { rebirths: 2 }), link).deps)).kind, 'diverged');
});

test('a New Game on another device (revisions start again) is not continued, even when the old game is further along', async () => {
	const h = harness(cloudAt(3, { playSeconds: 10, level: 1, tilesOwned: 1, rebirths: 1 }), link);
	assert.equal((await resolveConflict('u1', local, h.deps)).kind, 'diverged');
	assert.equal(canRebase({ rev: 416 }, local, { ...local, playSeconds: 10 }, 416), false, 'the same revision is not newer');
});

test('without a link of this account, or with an unreadable cloud text, nothing is re-based', async () => {
	assert.equal((await resolveConflict('u1', local, harness(cloudAt(418), null).deps)).kind, 'diverged');
	assert.equal((await resolveConflict('u1', local, harness(cloudAt(418), { userId: 'u2', rev: 416 }).deps)).kind, 'diverged');
	assert.equal((await resolveConflict('u1', local, harness(cloudAt(418, {}, 'garbage'), link).deps)).kind, 'diverged');
});

test('the old cases still hold: own lost upload adopted, empty account is gone, outage is unknown', async () => {
	const own: PushAttempt = { userId: 'u1', baseRev: 416, playSeconds: 99_999 };
	assert.deepEqual(await resolveConflict('u1', local, harness(cloudAt(417, { playSeconds: 99_999 }), link, [own]).deps), {
		kind: 'rebased',
		rev: 417,
		via: 'own',
	});
	assert.equal((await resolveConflict('u1', local, harness({ status: 'empty' }, link).deps)).kind, 'gone');
	assert.equal((await resolveConflict('u1', local, harness({ status: 'unavailable' }, link).deps)).kind, 'unknown');
});

test('a conflict is retried with backoff, never stopped: the sync resumes once the account stops being ahead', async () => {
	let now = 0;
	const timers: { at: number; fn: () => void }[] = [];
	const outcomes: PushOutcome[] = ['retry', 'retry', 'ok'];
	let n = 0;
	const scheduler = createSyncScheduler({
		now: () => now,
		setTimer: (fn, ms) => timers.push({ at: now + ms, fn }),
		clearTimer: () => timers.splice(0, timers.length),
		push: async () => outcomes[n++] ?? 'ok',
	});
	scheduler.start();
	for (let i = 0; i < 12 && n < 3; i++) {
		const next = timers.splice(0, timers.length).sort((a, b) => a.at - b.at)[0];
		if (!next) break;
		now = Math.max(now, next.at);
		next.fn();
		await new Promise((r) => setImmediate(r));
	}
	assert.equal(n, 3, 'two refused uploads did not end the sync');
	assert.ok(SYNC.backoffMs.length > 0);
});

test('uploads of one browser run one after another under the push lock, and without Web Locks they just run', async () => {
	let held = false;
	const queue: (() => void)[] = [];
	const locks = {
		request: (_name: string, cb: () => Promise<unknown>) =>
			new Promise<unknown>((resolve, reject) => {
				const go = () => {
					held = true;
					cb()
						.then(resolve, reject)
						.finally(() => {
							held = false;
							queue.shift()?.();
						});
				};
				if (held) queue.push(go);
				else go();
			}),
	};
	const order: string[] = [];
	const job = (name: string) => async () => {
		assert.equal(held, true);
		order.push(`${name}:start`);
		await new Promise((r) => setImmediate(r));
		order.push(`${name}:end`);
		return name;
	};
	const both = await Promise.all([withPushLock(job('a'), locks), withPushLock(job('b'), locks)]);
	assert.deepEqual(both, ['a', 'b']);
	assert.deepEqual(order, ['a:start', 'a:end', 'b:start', 'b:end']);
	assert.equal(await withPushLock(async () => 'x', null), 'x');
	const broken = { request: () => Promise.reject(new Error('SecurityError')) };
	assert.equal(await withPushLock(async () => 'y', broken), 'y');
});
