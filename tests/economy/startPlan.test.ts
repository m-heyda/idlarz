import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, store } from '../helpers';
import { pickPersisted } from '../../src/lib/sanitizeSave';
import { canResumeTab, cloudSaveGone, SAME_GAME_SLACK_SEC, planStart, savedGameSummary, skipsHub, type CloudInfo } from '../../src/lib/startPlan';
import { countOwnedTiles } from '../../src/utils/game/tiles';
import type { SavePeek } from '../../src/lib/saveStorage';

const localSave = (playSeconds: number): SavePeek => {
	api().resetGame();
	growTo(10);
	store.setState({ playSeconds } as never);
	return { kind: 'ok', state: structuredClone(pickPersisted(api())), savedAt: 1, fromBackup: false };
};
/** The account's save of the game that `localSave` just built (same level and tiles), at `playSeconds`. */
const cloudAt = (rev: number, playSeconds: number): CloudInfo => {
	const state = pickPersisted(api());
	return { rev, serverSavedAt: 1, text: 'IDLZ2.x', summary: { level: state.level.level, tilesOwned: countOwnedTiles(state.tiles), playSeconds, gold: 1 } };
};
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
	assert.deepEqual(planStart(local, cloudAt(5, 1500), { userId: 'u', rev: 4 }, 'u'), { kind: 'hub', mode: 'choose' }, 'played elsewhere since');
	assert.deepEqual(
		planStart(local, cloudAt(4, 600), { userId: 'other', rev: 4 }, 'u'),
		{ kind: 'hub', mode: 'cloud' },
		'linked to another account: that game is not offered (/play puts it aside)',
	);
	assert.deepEqual(planStart(local, cloudAt(4, 1500), null, 'u'), { kind: 'hub', mode: 'choose' }, 'never linked');
});

test("a tab already playing skips the start check only while it holds this account's link", () => {
	assert.equal(canResumeTab({ userId: 'u', rev: 3 }, 'u'), true);
	assert.equal(canResumeTab(null, 'u'), false, 'link cleared after a reset: no upload would ever happen');
	assert.equal(canResumeTab({ userId: 'other', rev: 3 }, 'u'), false);
});

test('a refused upload that reports revision 0 means the account has no save (reset), not another browser', () => {
	assert.equal(cloudSaveGone(0), true);
	assert.equal(cloudSaveGone(4), false);
});

test('the very same game on both sides is not a choice even if the link was lost', () => {
	assert.deepEqual(planStart(localSave(700), cloudAt(4, 700), null, 'u'), { kind: 'hub', mode: 'local' });
});

test('the hub is skipped only when there is nothing to decide', () => {
	const local = localSave(500);
	assert.equal(skipsHub(planStart(NONE, null, null, 'u'), NONE), true, 'a new player');
	assert.equal(skipsHub(planStart(local, null, null, 'u'), local), true, 'one game here, none in the account');
	assert.equal(skipsHub(planStart(local, cloudAt(3, 500), { userId: 'u', rev: 3 }, 'u'), local), true, 'the same game on both sides');
	assert.equal(skipsHub(planStart(local, cloudAt(3, 9000), null, 'u'), local), false, 'two different games: the player chooses');
	assert.equal(skipsHub(planStart(NONE, cloudAt(3, 500), null, 'u'), NONE), false, 'only the account has a save: restoring it is a choice');
	assert.equal(skipsHub(planStart({ kind: 'unreadable' }, null, null, 'u'), { kind: 'unreadable' }), false, 'an unreadable save needs a word');
	const backup: SavePeek = { ...(local as Extract<SavePeek, { kind: 'ok' }>), fromBackup: true };
	assert.equal(skipsHub(planStart(backup, null, null, 'u'), backup), false, 'a backup is announced');
});

test('the landing summary is the more played game', () => {
	const local = localSave(500);
	assert.equal(savedGameSummary(NONE, null), null);
	assert.equal(savedGameSummary(local, null)?.playSeconds, 500);
	assert.equal(savedGameSummary(NONE, cloudAt(1, 900))?.playSeconds, 900);
	assert.equal(savedGameSummary(local, cloudAt(1, 900))?.playSeconds, 900);
	assert.equal(savedGameSummary(local, cloudAt(1, 100))?.playSeconds, 500);
	assert.equal(savedGameSummary(local, 'unavailable')?.playSeconds, 500);
});

test('two saves a minute apart are the same game: no choice; a real difference still asks', () => {
	const local = localSave(700);
	assert.deepEqual(planStart(local, cloudAt(4, 640), null, 'u'), { kind: 'hub', mode: 'local' }, 'a minute behind');
	assert.deepEqual(planStart(local, cloudAt(4, 700 + SAME_GAME_SLACK_SEC), null, 'u'), { kind: 'hub', mode: 'local' }, 'at the edge');
	assert.deepEqual(planStart(local, cloudAt(4, 700 + SAME_GAME_SLACK_SEC + 1), null, 'u'), { kind: 'hub', mode: 'choose' }, 'past the edge');
	const behind = { ...cloudAt(4, 700), summary: { ...cloudAt(4, 700).summary, level: 3 } };
	assert.deepEqual(planStart(local, behind, null, 'u'), { kind: 'hub', mode: 'choose' }, 'a different level is a different game');
});

test('the daily bonus window waits for the welcome-back window, honours "not today" and needs a claimable bonus', async () => {
	const { shouldOpenDaily, utcDay } = await import('../../src/lib/dailyPrompt');
	const base = { ready: true, offlineReportOpen: false, asked: false, hiddenToday: false, claimable: true };
	assert.equal(shouldOpenDaily(base), true);
	assert.equal(shouldOpenDaily({ ...base, offlineReportOpen: true }), false, 'the welcome-back window comes first');
	assert.equal(shouldOpenDaily({ ...base, ready: false }), false, 'the start of the game is not done');
	assert.equal(shouldOpenDaily({ ...base, asked: true }), false, 'once per start');
	assert.equal(shouldOpenDaily({ ...base, hiddenToday: true }), false, 'ticked: do not show again today');
	assert.equal(shouldOpenDaily({ ...base, claimable: false }), false, 'already claimed');
	assert.equal(utcDay(Date.UTC(2026, 10, 12, 0, 30)), '2026-11-12');
	assert.equal(utcDay(Date.UTC(2026, 10, 11, 23, 59)), '2026-11-11');
});
