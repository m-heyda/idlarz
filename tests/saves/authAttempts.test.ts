import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AUTH_TOO_MANY, CONFIRM_EMAIL_MESSAGE, liveAuthLimiters, loginFailure, signUpOutcome, takeAuthAttempt } from '@/lib/authAttempts';
import { createRateLimiter } from '@/lib/rateLimit';

// IDL-126: limits in front of login and register, and the sign-up answer for the day Confirm email is switched on.

const from = (ip: string) => new Headers({ 'x-forwarded-for': ip });

test('login: the 11th attempt on one email in a window is refused, whatever the address, and another email is not affected', () => {
	const limiters = liveAuthLimiters();
	for (let i = 0; i < 10; i++) assert.equal(takeAuthAttempt(limiters, 'login', from(`10.0.0.${i}`), 'Player@Example.com'), true, `attempt ${i + 1}`);
	assert.equal(takeAuthAttempt(limiters, 'login', from('10.0.0.99'), 'player@example.com'), false, 'the email is compared lower-cased');
	assert.equal(takeAuthAttempt(limiters, 'login', from('10.0.0.99'), 'someone@else.com'), true);
});

test('login: one address is held to 20 attempts, register to 10 and 5 per email, and the two routes count separately', () => {
	const limiters = liveAuthLimiters();
	for (let i = 0; i < 20; i++) assert.equal(takeAuthAttempt(limiters, 'login', from('1.2.3.4'), `u${i}@x.com`), true);
	assert.equal(takeAuthAttempt(limiters, 'login', from('1.2.3.4'), 'u99@x.com'), false);
	assert.equal(takeAuthAttempt(limiters, 'register', from('1.2.3.4'), 'u99@x.com'), true, 'register has its own books');
	for (let i = 0; i < 5; i++) assert.equal(takeAuthAttempt(limiters, 'register', from('5.6.7.8'), 'same@x.com'), true);
	assert.equal(takeAuthAttempt(limiters, 'register', from('5.6.7.8'), 'same@x.com'), false, 'the 6th sign-up for one email');
	assert.match(AUTH_TOO_MANY, /Too many attempts/);
});

test('the window passes: after 15 minutes the same email may try again (clock injected)', () => {
	let now = 0;
	const limiters = {
		...liveAuthLimiters(),
		loginEmail: createRateLimiter({ limit: 2, windowMs: 15 * 60 * 1000, clock: () => now }),
	};
	assert.equal(takeAuthAttempt(limiters, 'login', from('9.9.9.9'), 'a@b.com'), true);
	assert.equal(takeAuthAttempt(limiters, 'login', from('9.9.9.9'), 'a@b.com'), true);
	assert.equal(takeAuthAttempt(limiters, 'login', from('9.9.9.9'), 'a@b.com'), false);
	now += 15 * 60 * 1000 + 1;
	assert.equal(takeAuthAttempt(limiters, 'login', from('9.9.9.9'), 'a@b.com'), true);
});

test('sign-up answers: a session means signed in, a user without one means "check your email", nothing means failed', () => {
	assert.equal(signUpOutcome({ user: { id: 'u' }, session: { access_token: 't' } }), 'session');
	assert.equal(signUpOutcome({ user: { id: 'u' }, session: null }), 'confirm');
	assert.equal(signUpOutcome({ user: null, session: null }), 'failed');
	assert.equal(signUpOutcome(null), 'failed');
	assert.match(CONFIRM_EMAIL_MESSAGE, /Check your email/);
});

test('a failed login says "wrong email or password" for everything except an unconfirmed email, which is told to confirm', () => {
	assert.deepEqual(loginFailure({ message: 'Invalid login credentials' }), { status: 401, error: 'Wrong email or password.' });
	assert.deepEqual(loginFailure(null), { status: 401, error: 'Wrong email or password.' });
	const unconfirmed = loginFailure({ message: 'Email not confirmed' });
	assert.equal(unconfirmed.status, 403);
	assert.equal(unconfirmed.emailNotConfirmed, true);
});
