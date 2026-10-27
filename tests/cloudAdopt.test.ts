import test from 'node:test';
import assert from 'node:assert/strict';
import { adoptOwnSave, isOwnSave, type AdoptDeps, type FetchCloud, type PushAttempt } from '../src/lib/cloudClient';
import type { CloudLink } from '../src/lib/startPlan';

const cloud = (rev: number, playSeconds: number): FetchCloud => ({
	status: 'ok',
	cloud: { rev, serverSavedAt: 1, text: 'x', summary: { level: 3, tilesOwned: 20, playSeconds, gold: 5 } },
});

const harness = (attempts: PushAttempt[], latest: FetchCloud) => {
	const links: CloudLink[] = [];
	let cleared = 0;
	let fetched = 0;
	const deps: AdoptDeps = {
		fetchCloud: async () => (fetched++, latest),
		readAttempts: () => attempts,
		writeLink: (l) => void links.push(l),
		clearAttempts: () => void cleared++,
	};
	return { deps, links, cleared: () => cleared, fetched: () => fetched };
};

const mine: PushAttempt = { userId: 'u1', baseRev: 7, playSeconds: 1234.5 };

test('the account save is mine when it is the step after my upload and holds my play time', () => {
	assert.equal(isOwnSave([mine], 'u1', { rev: 8, summary: { level: 1, tilesOwned: 1, playSeconds: 1234.5, gold: 0 } }), true);
	assert.equal(isOwnSave([mine], 'u1', { rev: 9, summary: { level: 1, tilesOwned: 1, playSeconds: 1234.5, gold: 0 } }), false, 'another revision');
	assert.equal(isOwnSave([mine], 'u1', { rev: 8, summary: { level: 1, tilesOwned: 1, playSeconds: 1300, gold: 0 } }), false, 'another game');
	assert.equal(isOwnSave([mine], 'u2', { rev: 8, summary: { level: 1, tilesOwned: 1, playSeconds: 1234.5, gold: 0 } }), false, 'another account');
	assert.equal(isOwnSave([], 'u1', { rev: 8, summary: { level: 1, tilesOwned: 1, playSeconds: 1234.5, gold: 0 } }), false);
});

test('a lost answer is recognised: the new revision is adopted and the attempts are cleared', async () => {
	const h = harness([mine], cloud(8, 1234.5));
	assert.equal(await adoptOwnSave('u1', h.deps), 8);
	assert.deepEqual(h.links, [{ userId: 'u1', rev: 8 }]);
	assert.equal(h.cleared(), 1);
});

test('a save that really came from another browser is not adopted (the player still chooses)', async () => {
	const h = harness([mine], cloud(8, 99_999));
	assert.equal(await adoptOwnSave('u1', h.deps), null);
	assert.deepEqual(h.links, []);
	assert.equal(h.cleared(), 0);
});

test('with no remembered upload nothing is fetched, and an unreachable account is not adopted', async () => {
	const none = harness([], cloud(8, 1234.5));
	assert.equal(await adoptOwnSave('u1', none.deps), null);
	assert.equal(none.fetched(), 0);
	const down = harness([mine], { status: 'unavailable' });
	assert.equal(await adoptOwnSave('u1', down.deps), null);
	const empty = harness([mine], { status: 'empty' });
	assert.equal(await adoptOwnSave('u1', empty.deps), null);
});

test('an older remembered upload still matches after a reload made a newer attempt on the same stale revision', async () => {
	const older: PushAttempt = { userId: 'u1', baseRev: 7, playSeconds: 1000 }; // the closing page's upload (the server stored it as rev 8)
	const newer: PushAttempt = { userId: 'u1', baseRev: 7, playSeconds: 1040 }; // the reloaded page's first upload, refused as stale
	const h = harness([older, newer], cloud(8, 1000));
	assert.equal(await adoptOwnSave('u1', h.deps), 8);
});
