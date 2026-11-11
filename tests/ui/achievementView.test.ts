import test from 'node:test';
import assert from 'node:assert/strict';
import { achievementRowState, claimableIds, formatAchievementDate } from '../../src/lib/achievementView';

const NOV12 = Date.UTC(2026, 10, 12, 10);
const NOV13 = Date.UTC(2026, 10, 13, 10);

test('dates read like 12 Nov 2026 and are empty without a time', () => {
	assert.equal(formatAchievementDate(NOV12), '12 Nov 2026');
	assert.equal(formatAchievementDate(undefined), null);
	assert.equal(formatAchievementDate(0), null);
	assert.equal(formatAchievementDate(Number.NaN), null);
});

test('a locked row has no state and no log', () => {
	const s = achievementRowState({ earned: ['a'], claimed: ['a'] }, 'b');
	assert.deepEqual(s, { earned: false, claimed: false, canClaim: false, earnedText: null, claimedText: null });
});

test('earned and not claimed: the Claim button shows, with the earned date only', () => {
	const s = achievementRowState({ earned: ['a'], claimed: [], earnedAt: { a: NOV12 } }, 'a');
	assert.deepEqual(s, { earned: true, claimed: false, canClaim: true, earnedText: 'Earned 12 Nov 2026', claimedText: null });
});

test('claimed: both dates, no button', () => {
	const s = achievementRowState({ earned: ['a'], claimed: ['a'], earnedAt: { a: NOV12 }, claimedAt: { a: NOV13 } }, 'a');
	assert.deepEqual(s, { earned: true, claimed: true, canClaim: false, earnedText: 'Earned 12 Nov 2026', claimedText: 'Claimed 13 Nov 2026' });
});

test('a legacy report without times shows no date text', () => {
	const s = achievementRowState({ earned: ['a'], claimed: ['a'] }, 'a');
	assert.equal(s.earnedText, null);
	assert.equal(s.claimedText, null);
	assert.equal(s.claimed, true);
});

test('a missing claimed list counts every earned id as claimed', () => {
	const input = { earned: ['a', 'b'] };
	assert.equal(achievementRowState(input, 'a').canClaim, false);
	assert.deepEqual(claimableIds(input, ['a', 'b', 'c']), []);
});

test('claimableIds lists the earned unclaimed ids in the given order', () => {
	assert.deepEqual(claimableIds({ earned: ['a', 'b', 'c'], claimed: ['b'] }, ['c', 'b', 'a', 'z']), ['c', 'a']);
});
