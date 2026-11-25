import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter, clientIp } from '../../src/lib/rateLimit';
import {
	callbackNext,
	hasRecoveryCookie,
	RECOVERY_COOKIE,
	RECOVERY_MAX_AGE_SEC,
	recoveryCookieOptions,
	resetRedirectTo,
	siteOrigin,
} from '../../src/lib/authCallback';
import { checkEmailOnly, checkNewPassword } from '../../src/lib/authValidation';
import { handleResetRequest, liveLimiters, RESET_MESSAGE, type ResetAuth, type ResetDeps } from '../../src/lib/authReset';

// ---- rate limiter ------------------------------------------------------------------------------------------------

test('rate limiter: allows `limit` attempts per window, then refuses until the oldest ages out', () => {
	const limiter = createRateLimiter({ limit: 3, windowMs: 1000 });
	assert.deepEqual(
		[0, 100, 200, 300].map((t) => limiter.take('a', t)),
		[true, true, true, false],
	);
	assert.equal(limiter.take('b', 300), true, 'keys are independent');
	assert.equal(limiter.take('a', 999), false, 'a refused attempt does not slide the window');
	assert.equal(limiter.take('a', 1000), true, 'the first hit (t=0) has left the window');
});

test('rate limiter: memory is bounded and expired keys are dropped', () => {
	const limiter = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 5 });
	for (let i = 0; i < 50; i++) limiter.take(`k${i}`, 0);
	assert.ok(limiter.size() <= 5);
	limiter.take('late', 5000);
	assert.equal(limiter.size(), 1, 'everything older than the window is pruned');
});

test('rate limiter: uses the injected clock when no time is passed', () => {
	let now = 0;
	const limiter = createRateLimiter({ limit: 1, windowMs: 10, clock: () => now });
	assert.equal(limiter.take('x'), true);
	assert.equal(limiter.take('x'), false);
	now = 10;
	assert.equal(limiter.take('x'), true);
});

test('clientIp takes the first x-forwarded-for hop', () => {
	assert.equal(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' })), '1.2.3.4');
	assert.equal(clientIp(new Headers()), 'unknown');
});

// ---- callback `next` ---------------------------------------------------------------------------------------------

test('callbackNext keeps a path on this site and refuses everything else', () => {
	assert.equal(callbackNext('/reset'), '/reset');
	for (const bad of ['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', 'reset', '', '/a\\b', '/x\ny', null, undefined]) {
		assert.equal(callbackNext(bad), '/play', String(bad));
	}
});

test('the site origin prefers the configured address over the request host', () => {
	assert.equal(siteOrigin({ SITE_URL: 'https://idlarz.example/path' }, 'https://evil.example/api/auth/reset'), 'https://idlarz.example');
	const both = { SITE_URL: 'https://idler.site, https://idler-rose.vercel.app' };
	assert.equal(siteOrigin(both, 'https://idler-rose.vercel.app/api/auth/reset'), 'https://idler-rose.vercel.app');
	assert.equal(siteOrigin(both, 'https://idler.site/api/auth/reset'), 'https://idler.site');
	assert.equal(siteOrigin(both, 'https://evil.example/api/auth/reset'), 'https://idler.site');
	assert.equal(siteOrigin({ VERCEL_URL: 'idlarz-abc.vercel.app' }, 'https://evil.example/x'), 'https://idlarz-abc.vercel.app');
	assert.equal(siteOrigin({ SITE_URL: 'javascript:alert(1)' }, 'http://localhost:3000/x'), 'http://localhost:3000');
	assert.equal(resetRedirectTo('https://idlarz.example'), 'https://idlarz.example/auth/callback?next=%2Freset');
});

// ---- validation --------------------------------------------------------------------------------------------------

test('reset validation: email trimmed and lowercased, new password follows the sign-up rules', () => {
	assert.deepEqual(checkEmailOnly({ email: ' Me@Example.COM ' }), { ok: true, value: 'me@example.com' });
	assert.equal(checkEmailOnly({ email: 'nope' }).ok, false);
	assert.equal(checkEmailOnly(null).ok, false);
	assert.equal(checkNewPassword({ password: 'longenough' }).ok, true);
	assert.equal(checkNewPassword({ password: 'short' }).ok, false);
	assert.equal(checkNewPassword({ password: 'x'.repeat(73) }).ok, false);
});

// ---- the route's behaviour with a fake auth client ---------------------------------------------------------------

const request = (email: unknown, ip = '9.9.9.9') =>
	new Request('https://site.example/api/auth/reset', {
		method: 'POST',
		headers: { 'x-forwarded-for': ip, 'Content-Type': 'application/json' },
		body: JSON.stringify({ email }),
	});

const deps = (auth: ResetAuth, over: Partial<ResetDeps> = {}): ResetDeps => ({
	auth: async () => auth,
	...liveLimiters(),
	env: { SITE_URL: 'https://site.example' },
	...over,
});

test('reset route: the answer is identical for a known and an unknown account', async () => {
	const calls: Array<{ email: string; redirectTo: string }> = [];
	const known = new Set(['known@example.com']);
	const auth: ResetAuth = {
		resetPasswordForEmail: async (email, options) => {
			calls.push({ email, redirectTo: options.redirectTo });
			return { error: known.has(email) ? null : { status: 400 } };
		},
	};
	const d = deps(auth);
	const a = await handleResetRequest(request('known@example.com'), d);
	const b = await handleResetRequest(request('Unknown@example.com'), d);
	assert.equal(a.status, 200);
	assert.equal(b.status, 200);
	assert.deepEqual(await a.json(), { ok: true, message: RESET_MESSAGE });
	assert.deepEqual(await b.json(), { ok: true, message: RESET_MESSAGE });
	assert.equal(calls[1].email, 'unknown@example.com');
	assert.equal(calls[0].redirectTo, 'https://site.example/auth/callback?next=%2Freset');
});

test('reset route: a bad email is a 400, an outage is a 503, and limits answer 429 without asking Supabase', async () => {
	let asked = 0;
	const ok: ResetAuth = {
		resetPasswordForEmail: async () => {
			asked++;
			return { error: null };
		},
	};
	assert.equal((await handleResetRequest(request('nope'), deps(ok))).status, 400);
	assert.equal(asked, 0);

	const down: ResetAuth = { resetPasswordForEmail: async () => ({ error: { status: 503 } }) };
	assert.equal((await handleResetRequest(request('a@b.co'), deps(down))).status, 503);

	const d = deps(ok);
	const statuses: number[] = [];
	for (let i = 0; i < 4; i++) statuses.push((await handleResetRequest(request('same@example.com', `1.1.1.${i}`), d)).status);
	assert.deepEqual(statuses, [200, 200, 200, 429], 'per email: 3 per window');
	const askedAfterEmail = asked;
	assert.equal(askedAfterEmail, 3);

	const d2 = deps(ok);
	const ipStatuses: number[] = [];
	for (let i = 0; i < 11; i++) ipStatuses.push((await handleResetRequest(request(`u${i}@example.com`, '2.2.2.2'), d2)).status);
	assert.equal(ipStatuses.filter((s) => s === 200).length, 10, 'per address: 10 per window');
	assert.equal(ipStatuses[10], 429);
	const body = await (await handleResetRequest(request('u0@example.com', '2.2.2.2'), d2)).json();
	assert.ok(!JSON.stringify(body).includes('u0@example.com'), 'the limit answer never echoes the email');
});

test('the landing page owes a notice for an expired link and takes the parameter out of the address, keeping the others (IDL-301)', async () => {
	const { landingNoticeOf, RESET_EXPIRED_MESSAGE, RESET_EXPIRED_PATH } = await import('../../src/lib/authCallback');
	const fromPath = landingNoticeOf(RESET_EXPIRED_PATH.slice(1));
	assert.equal(fromPath?.message, RESET_EXPIRED_MESSAGE);
	assert.equal(fromPath?.rest, '');
	assert.deepEqual(landingNoticeOf('?reset=expired&next=%2Fplay'), { message: RESET_EXPIRED_MESSAGE, rest: '?next=%2Fplay' });
	assert.equal(landingNoticeOf('?next=%2Fplay'), null);
	assert.equal(landingNoticeOf('?reset=ok'), null);
	assert.equal(landingNoticeOf(''), null);
});

// ---- the recovery cookie (IDL-384) -------------------------------------------------------------------------------

test('only a request carrying the recovery cookie counts as a recovery session', () => {
	assert.equal(hasRecoveryCookie(`${RECOVERY_COOKIE}=1`), true);
	assert.equal(hasRecoveryCookie(`sb-token=abc; ${RECOVERY_COOKIE}=1; other=2`), true);
	for (const bad of [null, undefined, '', 'sb-token=abc', `${RECOVERY_COOKIE}=0`, `x${RECOVERY_COOKIE}=1`, `${RECOVERY_COOKIE}x=1`])
		assert.equal(hasRecoveryCookie(bad), false, String(bad));
});

test('the recovery cookie is script-proof, same-site and short-lived', () => {
	assert.deepEqual(recoveryCookieOptions(true), { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: RECOVERY_MAX_AGE_SEC });
	assert.equal(recoveryCookieOptions(false).secure, false);
	assert.equal(RECOVERY_MAX_AGE_SEC, 900);
});
