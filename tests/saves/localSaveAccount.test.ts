import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveStorage, type KeyValue } from '../../src/lib/saveStorage';
import { encodeSave } from '../../src/lib/saveFormat';
import { pickPersisted } from '../../src/lib/sanitizeSave';
import { api } from '../helpers';
import { epochScoped, epochSuffix } from '../../src/lib/storageScope';
import { isForeignLocal, planStart, type CloudInfo, type CloudLink } from '../../src/lib/startPlan';
import { wipeStaleBrowser } from '../../src/lib/epochGuard';

const fakeKv = (initial: Record<string, string> = {}) => {
	const data = new Map(Object.entries(initial));
	const kv: KeyValue = { get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v), remove: (k) => void data.delete(k) };
	return { kv, data };
};

const gameText = (): string => {
	api().resetGame();
	return encodeSave(structuredClone(pickPersisted(api())), 1_700_000_000_000);
};

const cloud = (rev: number, playSeconds: number): CloudInfo => ({
	rev,
	serverSavedAt: 1,
	text: 'x',
	summary: { level: 1, tilesOwned: 1, playSeconds, gold: 0 },
});
const OLD: CloudLink = { userId: 'old-account', rev: 7 };

test("another account's local game is not adopted by a new account with no cloud save", () => {
	const { kv } = fakeKv({ 'idlarz.save': gameText() });
	const local = createSaveStorage({ kv, epoch: 1 }).peek();
	assert.equal(local.kind, 'ok');
	// the bug: without the owner check a brand new account (no cloud save) was sent into the old account's game
	assert.equal(isForeignLocal(local, OLD, 'new-account'), true);
	assert.deepEqual(planStart(local, null, OLD, 'new-account'), { kind: 'enter' });
	assert.deepEqual(planStart(local, 'unavailable', OLD, 'new-account'), { kind: 'enter' });
	assert.deepEqual(planStart(local, cloud(3, 100), OLD, 'new-account'), { kind: 'hub', mode: 'cloud' });
});

test("the same account's local game (and a legacy save with no link) still loads at epoch 1", () => {
	const { kv } = fakeKv({ 'idlarz.save': gameText() });
	const local = createSaveStorage({ kv, epoch: 1 }).peek();
	assert.equal(isForeignLocal(local, OLD, 'old-account'), false);
	assert.deepEqual(planStart(local, null, OLD, 'old-account'), { kind: 'hub', mode: 'local' });
	assert.equal(isForeignLocal(local, null, 'anyone'), false);
});

test("epoch 1 keeps today's key names; epoch 2 uses different ones and never reads the epoch 1 game", async () => {
	assert.equal(epochSuffix(1), '');
	assert.equal(epochScoped('idlarz.save', 1), 'idlarz.save');
	assert.equal(epochScoped('idlarz.save', 2), 'idlarz.save.e2');
	const { kv, data } = fakeKv({ 'idlarz.save': gameText(), 'idlarz.save.backup': gameText() });
	const v2 = createSaveStorage({ kv, epoch: 2 });
	assert.equal(v2.peek().kind, 'none');
	assert.equal(await v2.storage.getItem('x'), null);
	assert.equal(createSaveStorage({ kv, epoch: 1 }).peek().kind, 'ok');
	assert.ok(data.has('idlarz.save'), 'nothing was touched');
});

test('the epoch 1 game is archived (not lost) when the epoch 2 browser starts over, then its old keys go', async () => {
	const text = gameText();
	const { kv, data } = fakeKv({ 'idlarz.save': text });
	const v2 = createSaveStorage({ kv, epoch: 2 });
	assert.equal(
		await wipeStaleBrowser(2, { archiveLocal: v2.archiveForNewGame, resetLocal: v2.reset, clearKeys: () => undefined, recordEpoch: () => undefined }),
		true,
	);
	assert.equal(data.get('idlarz.save.previous-game'), text);
	assert.equal(data.has('idlarz.save'), false);
});
