import test from 'node:test';
import assert from 'node:assert/strict';
import { rockKey, useRockStore } from '../../src/stores/rockStore';
import type { PublicRock } from '../../src/lib/offline/types';

const rock = (over: Partial<PublicRock> = {}): PublicRock => ({ n: 1, x: 3, y: 4, tier: 'common', hits: 0, need: 100, ...over });
const view = () => useRockStore.getState().rocks[rockKey(3, 4)];

test('the rocks the server lists are shown, and a rock it no longer lists is gone', () => {
	useRockStore.getState().reset();
	useRockStore.getState().setFromServer([rock(), rock({ n: 2, x: 5, y: 5, tier: 'epic', need: 1000 })]);
	assert.equal(Object.keys(useRockStore.getState().rocks).length, 2);
	useRockStore.getState().setFromServer([rock({ n: 2, x: 5, y: 5, tier: 'epic', need: 1000 })]);
	assert.equal(view(), undefined);
});

test('a click is counted at once and the server’s answer settles the count', () => {
	useRockStore.getState().reset();
	useRockStore.getState().setFromServer([rock()]);
	for (let i = 0; i < 5; i++) assert.ok(useRockStore.getState().localHit(3, 4));
	assert.equal(view().hits, 5);
	assert.equal(view().pending, 5);
	assert.equal(view().chop, 5);
	// the server let only 3 of the 5 in: its total is 3, the two clicks still unanswered come on top
	useRockStore.getState().localHit(3, 4);
	useRockStore.getState().localHit(3, 4);
	useRockStore.getState().ack(3, 4, 5, 3, false);
	assert.equal(view().pending, 2);
	assert.equal(view().hits, 5, 'the server’s 3 plus the 2 clicks on their way');
});

test('a poll in the middle of mining does not take the clicks back', () => {
	useRockStore.getState().reset();
	useRockStore.getState().setFromServer([rock()]);
	for (let i = 0; i < 8; i++) useRockStore.getState().localHit(3, 4);
	useRockStore.getState().setFromServer([rock({ hits: 2 })]);
	assert.equal(view().hits, 8);
	assert.equal(view().pending, 8);
	// a different rock on the same tile is a new one
	useRockStore.getState().setFromServer([rock({ n: 9, hits: 0 })]);
	assert.equal(view().hits, 0);
	assert.equal(view().pending, 0);
});

test('the last click marks the rock as breaking, and nothing more is counted until the server answers', () => {
	useRockStore.getState().reset();
	useRockStore.getState().setFromServer([rock({ hits: 98 })]);
	useRockStore.getState().localHit(3, 4);
	assert.equal(view().breaking, false);
	useRockStore.getState().localHit(3, 4);
	assert.equal(view().breaking, true);
	assert.equal(useRockStore.getState().localHit(3, 4), null, 'a rock being confirmed takes no more hits');
	// the server let fewer clicks in: the rock is not broken after all
	useRockStore.getState().ack(3, 4, 2, 99, false);
	assert.equal(view().breaking, false);
	assert.equal(view().hits, 99);
	// a broken rock leaves the map
	useRockStore.getState().ack(3, 4, 1, 100, true);
	assert.equal(view(), undefined);
});

test('clicks the server never heard are taken back, and a break plays its effect once', () => {
	useRockStore.getState().reset();
	useRockStore.getState().setFromServer([rock()]);
	for (let i = 0; i < 6; i++) useRockStore.getState().localHit(3, 4);
	useRockStore.getState().lose(3, 4, 6);
	assert.equal(view().hits, 0);
	assert.equal(view().pending, 0);
	useRockStore.getState().pushBurst({ x: 3, y: 4, tier: 'rare', stone: 10, coal: 4, stash: { ing_ember_coal: 2 } });
	assert.equal(useRockStore.getState().bursts.length, 1);
	useRockStore.getState().dropBurst(useRockStore.getState().bursts[0].id);
	assert.equal(useRockStore.getState().bursts.length, 0);
});
