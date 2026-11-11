import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveStorage, type KeyValue } from '../../src/lib/saveStorage';
import { encodeSave } from '../../src/lib/saveFormat';
import { pickPersisted } from '../../src/lib/sanitizeSave';
import { wipeStaleBrowser } from '../../src/lib/epochGuard';
import { isForeignLocal, planStart, skipsHub, type CloudInfo, type CloudLink } from '../../src/lib/startPlan';
import { api, growTo, store } from '../helpers';

// The start hub (components/auth/SaveHub: "Your kingdom awaits" / "Which game to continue?") is a data-loss decision: it must only show where a real choice exists.

const fakeKv = (initial: Record<string, string> = {}) => {
	const data = new Map(Object.entries(initial));
	const kv: KeyValue = { get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v), remove: (k) => void data.delete(k) };
	return { kv, data };
};
const played = (playSeconds: number): string => {
	api().resetGame();
	growTo(10);
	store.setState({ playSeconds } as never);
	return encodeSave(structuredClone(pickPersisted(api())), 1_700_000_000_000);
};
const cloud = (rev: number, playSeconds: number): CloudInfo => ({
	rev,
	serverSavedAt: 1,
	text: 'x',
	summary: { level: 1, tilesOwned: 10, playSeconds, gold: 0 },
});
const OLD: CloudLink = { userId: 'old-account', rev: 7 };

/** Whether the hub would be shown the way /play decides it: another account's game is archived first (never offered), then the plan. */
const hubShown = (kv: KeyValue, epoch: number, cloudInfo: CloudInfo | null, link: CloudLink | null, userId: string): boolean => {
	const local = createSaveStorage({ kv, epoch }).peek();
	const plan = planStart(local, cloudInfo, link, userId);
	return !skipsHub(plan, isForeignLocal(local, link, userId) ? { kind: 'none' } : local);
};

test("(a) a brand-new account with no cloud save goes straight in, even beside another account's local game", () => {
	assert.equal(hubShown(fakeKv().kv, 1, null, null, 'new'), false);
	assert.equal(hubShown(fakeKv({ 'idlarz.save': played(5000) }).kv, 1, null, OLD, 'new'), false);
});

test("(b) another account's game, or an older epoch's, never reaches the hub", () => {
	assert.equal(hubShown(fakeKv({ 'idlarz.save': played(5000) }).kv, 1, null, OLD, 'new'), false, 'other account');
	assert.equal(hubShown(fakeKv({ 'idlarz.save': played(5000) }).kv, 2, null, null, 'u'), false, 'epoch 1 game, epoch 2 browser');
});

test('(c) after the chapter reset nothing is left to ask about, and the old game is kept aside', async () => {
	const text = played(5000);
	const { kv, data } = fakeKv({ 'idlarz.save': text });
	const s = createSaveStorage({ kv, epoch: 2 });
	assert.equal(
		await wipeStaleBrowser(2, { archiveLocal: s.archiveForNewGame, resetLocal: s.reset, clearKeys: () => undefined, recordEpoch: () => undefined }),
		true,
	);
	assert.equal(data.get('idlarz.save.previous-game'), text);
	assert.equal(hubShown(kv, 2, null, null, 'u'), false);
});

test("the hub still shows for the same account's genuinely different local and cloud games", () => {
	const { kv } = fakeKv({ 'idlarz.save': played(700) });
	const mine: CloudLink = { userId: 'u', rev: 4 };
	assert.equal(hubShown(kv, 1, cloud(5, 5000), mine, 'u'), true, 'played elsewhere since');
	assert.equal(planStart(createSaveStorage({ kv, epoch: 1 }).peek(), cloud(5, 5000), mine, 'u').kind, 'hub');
	assert.equal(hubShown(kv, 1, cloud(4, 600), mine, 'u'), false, 'linked and in step: no question');
});
