import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchMe } from '../src/lib/authClient';
import { guardConfigured, unavailable } from '../src/lib/authRoute';

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

const answer = (status: number, body: unknown) => {
	globalThis.fetch = (async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
};

test('the server says why accounts are unavailable: no setup, or an outage', async () => {
	const missing = unavailable('not_configured');
	assert.equal(missing.status, 503);
	assert.deepEqual(await missing.json(), { error: 'Accounts are unavailable right now.', unavailable: true, reason: 'not_configured' });
	assert.equal((await unavailable().json()).reason, 'outage');
	const savedUrl = process.env.SUPABASE_URL;
	const savedKey = process.env.SUPABASE_ANON_KEY;
	try {
		delete process.env.SUPABASE_URL;
		delete process.env.SUPABASE_ANON_KEY;
		assert.equal((await guardConfigured()!.json()).reason, 'not_configured');
		process.env.SUPABASE_URL = 'https://example.supabase.co';
		process.env.SUPABASE_ANON_KEY = 'anon';
		assert.equal(guardConfigured(), null);
	} finally {
		if (savedUrl === undefined) delete process.env.SUPABASE_URL;
		else process.env.SUPABASE_URL = savedUrl;
		if (savedKey === undefined) delete process.env.SUPABASE_ANON_KEY;
		else process.env.SUPABASE_ANON_KEY = savedKey;
	}
});

test('the client keeps "not set up" and "outage" apart, and never reads either as logged out', async () => {
	answer(503, { error: 'x', unavailable: true, reason: 'not_configured' });
	assert.deepEqual(await fetchMe(), { status: 'unavailable', reason: 'not_configured' });
	answer(503, { error: 'x', unavailable: true, reason: 'outage' });
	assert.deepEqual(await fetchMe(), { status: 'unavailable', reason: 'outage' });
	answer(503, { error: 'x', unavailable: true }); // an older server without a reason
	assert.deepEqual(await fetchMe(), { status: 'unavailable', reason: 'outage' });
	answer(502, {});
	assert.deepEqual(await fetchMe(), { status: 'unavailable', reason: 'outage' });
});

test('a network failure or a hung request is an outage; a clean 401 is a guest; a 200 is a player', async () => {
	globalThis.fetch = (async () => {
		throw new TypeError('network down');
	}) as typeof fetch;
	assert.deepEqual(await fetchMe(), { status: 'unavailable', reason: 'outage' });
	globalThis.fetch = (async () => {
		throw Object.assign(new Error('timed out'), { name: 'TimeoutError' });
	}) as typeof fetch;
	assert.deepEqual(await fetchMe(), { status: 'unavailable', reason: 'outage' });
	answer(401, { error: 'Not signed in.' });
	assert.deepEqual(await fetchMe(), { status: 'guest' });
	answer(200, { user: { id: 'u1', email: 'a@b.c' }, profile: { characterName: 'Zoe', playerClass: 'warrior' } });
	assert.deepEqual(await fetchMe(), { status: 'ok', userId: 'u1', profile: { characterName: 'Zoe', playerClass: 'warrior' } });
});
