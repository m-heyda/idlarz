import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { EPOCH_HEADER } from '../../src/config/epoch';
import { epochFetch } from '../../src/lib/epochFetch';

// IDL-300: a tab left open across the new chapter flip gets 412 `staleEpoch` from the server: it reloads once into the epoch guard, and never loops.

const realFetch = globalThis.fetch;
const realWindow = (globalThis as { window?: unknown }).window;
let reloads = 0;
let sent: Headers | null = null;

const browser = () => {
	const session = new Map<string, string>();
	return {
		localStorage: { getItem: () => null },
		sessionStorage: { getItem: (k: string) => session.get(k) ?? null, setItem: (k: string, v: string) => void session.set(k, v) },
		location: { pathname: '/play', search: '', reload: () => void reloads++ },
	};
};
const answer = (status: number, body: unknown) => {
	globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
		sent = new Headers(init?.headers);
		return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
	}) as typeof fetch;
};

beforeEach(() => {
	reloads = 0;
	sent = null;
	(globalThis as { window?: unknown }).window = browser();
});
afterEach(() => {
	globalThis.fetch = realFetch;
	(globalThis as { window?: unknown }).window = realWindow;
});

test('a stale-epoch answer reloads the page once, and a second one within a minute does not reload again', async () => {
	answer(412, { error: 'The game has started a new chapter. Reload to continue.', staleEpoch: true });
	const first = await epochFetch('/api/save', { method: 'POST' });
	assert.equal(first.status, 412, 'the caller still sees the answer');
	assert.equal(reloads, 1);
	await epochFetch('/api/save', { method: 'POST' });
	await epochFetch('/api/fight', { method: 'POST' });
	assert.equal(reloads, 1, 'no reload loop');
});

test('every call carries the epoch header, and a 412 that is not a stale epoch, or any other status, reloads nothing', async () => {
	answer(412, { error: 'something else' });
	await epochFetch('/api/save', { method: 'POST' });
	assert.ok(sent?.get(EPOCH_HEADER), 'the x-game-epoch header is set');
	answer(200, { ok: true });
	await epochFetch('/api/fight');
	answer(500, { error: 'boom' });
	await epochFetch('/api/fight');
	assert.equal(reloads, 0);
});
