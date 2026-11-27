import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER_RATE_LIMIT, PLAYER_RATE_WINDOW_MS, playerLimiter, takePlayerRequest } from '../../src/lib/playerRate';

test('an account may make PLAYER_RATE_LIMIT requests per window and the next one is refused', () => {
	const limiter = playerLimiter();
	for (let i = 0; i < PLAYER_RATE_LIMIT; i++) assert.equal(takePlayerRequest('a', limiter), true);
	assert.equal(takePlayerRequest('a', limiter), false);
});

test('the limit is per account: one account over it does not slow another', () => {
	const limiter = playerLimiter();
	for (let i = 0; i < PLAYER_RATE_LIMIT; i++) takePlayerRequest('busy', limiter);
	assert.equal(takePlayerRequest('busy', limiter), false);
	assert.equal(takePlayerRequest('quiet', limiter), true);
});

test('the window slides: a minute later the account may play again', () => {
	const limiter = playerLimiter();
	for (let i = 0; i < PLAYER_RATE_LIMIT; i++) limiter.take('a', 1000);
	assert.equal(limiter.take('a', 1000 + PLAYER_RATE_WINDOW_MS - 1), false);
	assert.equal(limiter.take('a', 1000 + PLAYER_RATE_WINDOW_MS), true);
});

test('normal play stays far under the limit, mining rocks included (one batch every 2 s, FLUSH_MS)', () => {
	const rocks = 60; // a batch every 2 s is 30 a minute; 60 with a send at every break
	assert.ok(rocks + 6 + 20 + 60 < PLAYER_RATE_LIMIT / 2, 'even all at once the total is under half of the limit');
});
