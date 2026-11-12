import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_UNLOCK } from '../../src/catalog/avatars';
import {
	LIVE_BOARD_IDS,
	RANKING_BOARDS,
	RANKING_LIMIT,
	buildRankingRows,
	isLiveBoard,
	movement,
	paragonOf,
	refreshArgs,
	type RankingEntry,
	type RankingProfile,
} from '../../src/lib/rankings';
import { CRAFTING } from '../../src/config/crafting';
import { MAX_LEVEL } from '../../src/config/character';
import { craftCumulativeXp, craftLevelOf } from '../../src/lib/crafting';

// The pure rules of the Rankings: the boards, the daily movement arrows and how a stored place becomes a row with the player's own choices.

const profile = (patch: Partial<RankingProfile> = {}): RankingProfile => ({
	name: 'Insane',
	playerClass: 'warrior',
	avatarId: null,
	badgeId: null,
	titleId: null,
	nameColor: null,
	admin: false,
	...patch,
});
const entry = (patch: Partial<RankingEntry> = {}): RankingEntry => ({ userId: 'u1', rank: 1, previousRank: null, value: 50, xp: 0, ...patch });

test('four boards are live and Quests and Deeds are coming-soon placeholders', () => {
	assert.deepEqual(LIVE_BOARD_IDS, ['level', 'rebirths', 'crafting', 'tiles']);
	assert.deepEqual(
		RANKING_BOARDS.filter((b) => b.soon).map((b) => b.id),
		['quests', 'deeds'],
	);
	assert.equal(isLiveBoard('tiles'), true);
	assert.equal(isLiveBoard('quests'), false, 'a placeholder is not served');
	assert.equal(isLiveBoard('gold'), false);
	assert.equal(isLiveBoard(undefined), false);
	assert.equal(RANKING_LIMIT, 50);
});

test('movement: a smaller rank is up, a larger one is down, no earlier place is new', () => {
	assert.deepEqual(movement(5, 2), { dir: 'up', by: 3 });
	assert.deepEqual(movement(2, 5), { dir: 'down', by: 3 });
	assert.deepEqual(movement(4, 4), { dir: 'same', by: 0 });
	assert.deepEqual(movement(null, 4), { dir: 'new', by: 0 });
	assert.deepEqual(movement(undefined, 1), { dir: 'new', by: 0 });
});

test('the database gets the live caps from the config, never its own copy', () => {
	assert.deepEqual(refreshArgs(), { p_level_cap: MAX_LEVEL, p_craft_max_xp: craftCumulativeXp(CRAFTING.maxLevel) });
	assert.equal(craftLevelOf(refreshArgs().p_craft_max_xp).level, CRAFTING.maxLevel, 'that much crafting XP is exactly the maximum level');
});

test('there is no paragon yet', () => {
	assert.equal(paragonOf(1e12, MAX_LEVEL), 0);
});

test('a row carries the colour the player chose, the move, and no account id', () => {
	const earned = new Map([['u1', ['first_blood']]]);
	const rows = buildRankingRows([entry({ rank: 3, previousRank: 7 })], new Map([['u1', profile({ nameColor: 'rainbow' })]]), earned, 'u1');
	assert.equal(rows.length, 1);
	assert.equal(rows[0].rank, 3);
	assert.deepEqual(rows[0].move, { dir: 'up', by: 4 });
	assert.equal(rows[0].nameColor, 'rainbow');
	assert.equal(rows[0].me, true);
	assert.equal('userId' in rows[0], false);
});

test('what a player no longer holds is not shown: gold without admin, the admin avatar without the unlock', () => {
	const rows = buildRankingRows([entry()], new Map([['u1', profile({ nameColor: 'gold', avatarId: 'admin' })]]), new Map([['u1', []]]), null);
	assert.equal(rows[0].nameColor, null, 'gold is admin only');
	assert.notEqual(rows[0].avatarId, 'admin', 'the admin avatar needs the admin unlock');
	assert.equal(rows[0].me, false);
});

test('the admin keeps the gold name, the admin avatar and the mark', () => {
	const rows = buildRankingRows(
		[entry()],
		new Map([['u1', profile({ nameColor: 'gold', avatarId: 'admin', admin: true })]]),
		new Map([['u1', [ADMIN_UNLOCK]]]),
		null,
	);
	assert.equal(rows[0].nameColor, 'gold');
	assert.equal(rows[0].avatarId, 'admin');
	assert.equal(rows[0].admin, true);
});

test('a player without a profile is dropped and an unknown class falls back to the default', () => {
	const rows = buildRankingRows(
		[entry({ userId: 'gone' }), entry({ userId: 'u2', rank: 2 })],
		new Map([['u2', profile({ playerClass: 'bard' })]]),
		new Map(),
		null,
	);
	assert.deepEqual(
		rows.map((r) => r.rank),
		[2],
	);
	assert.equal(rows[0].playerClass, 'warrior');
});
