import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, store } from './helpers';
import { pickPersisted } from '../src/lib/sanitizeSave';
import { planStart, type CloudInfo } from '../src/lib/startPlan';
import type { SavePeek } from '../src/lib/saveStorage';

const localSave = (playSeconds: number): SavePeek => {
	api().resetGame();
	growTo(10);
	store.setState({ playSeconds } as never);
	return { kind: 'ok', state: structuredClone(pickPersisted(api())), savedAt: 1, fromBackup: false };
};
const cloudAt = (rev: number, playSeconds: number): CloudInfo => ({ rev, serverSavedAt: 1, text: 'IDLZ2.x', summary: { level: 1, tilesOwned: 10, playSeconds, gold: 1 } });
const NONE: SavePeek = { kind: 'none' };

test('nothing anywhere: straight into a new game; nothing in the account: the hub for the local save', () => {
	assert.deepEqual(planStart(NONE, null, null, 'u'), { kind: 'enter' });
	assert.deepEqual(planStart(localSave(500), null, null, 'u'), { kind: 'hub', mode: 'local' });
});

test('the account unreachable never blocks: local carries on, a new player just plays', () => {
	assert.deepEqual(planStart(NONE, 'unavailable', null, 'u'), { kind: 'enter' });
	assert.deepEqual(planStart(localSave(500), 'unavailable', null, 'u'), { kind: 'hub', mode: 'local' });
});

test('a new browser (or an unreadable save) gets the account save, never a silent fresh game', () => {
	assert.deepEqual(planStart(NONE, cloudAt(4, 900), null, 'u'), { kind: 'hub', mode: 'cloud' });
	assert.deepEqual(planStart({ kind: 'unreadable' }, cloudAt(4, 900), null, 'u'), { kind: 'hub', mode: 'cloud' });
});

test('this browser continues the account save: no choice; anything else asks', () => {
	const local = localSave(700);
	assert.deepEqual(planStart(local, cloudAt(4, 600), { userId: 'u', rev: 4 }, 'u'), { kind: 'hub', mode: 'local' });
	assert.deepEqual(planStart(local, cloudAt(5, 600), { userId: 'u', rev: 4 }, 'u'), { kind: 'hub', mode: 'choose' }, 'played elsewhere since');
	assert.deepEqual(planStart(local, cloudAt(4, 600), { userId: 'other', rev: 4 }, 'u'), { kind: 'hub', mode: 'choose' }, 'linked to another account');
	assert.deepEqual(planStart(local, cloudAt(4, 600), null, 'u'), { kind: 'hub', mode: 'choose' }, 'never linked');
});

test('the very same game on both sides is not a choice even if the link was lost', () => {
	assert.deepEqual(planStart(localSave(700), cloudAt(4, 700), null, 'u'), { kind: 'hub', mode: 'local' });
});
