import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, store } from '../helpers';
import { createGuestTransport } from '../../src/lib/guest/dispatch';
import { forgetGuestLedger } from '../../src/lib/guest/localRepos';
import { guestFetch, setGuestTransport } from '../../src/lib/guestMode';
import type { PublicTickets, SyncResult } from '../../src/lib/offline/types';

// Guest mode: the game's /api calls answered in the browser by the same engine the server runs. These tests drive it the way the browser does (claim, spawn, chest, fight) against the real game store, with the clock moved by hand
// and every network call trapped.

const T0 = 1_800_000_000_000;
const MIN = 60_000;
let keyCounter = 0;
const newKey = () => `guest-test-key-${++keyCounter}-abcdef`;

const start = () => {
	forgetGuestLedger();
	api().resetGame();
	growTo(60);
	store.setState({ playSeconds: 1000 } as never);
	// helpers wipe localStorage; the engine keeps its own state in memory in node
	const transport = createGuestTransport(() => api());
	setGuestTransport(transport);
	return transport;
};

test('a guest plays spawn, chest and fight without any network call', async (t) => {
	mock.timers.enable({ apis: ['Date'], now: T0 });
	const fetchTrap = mock.method(globalThis, 'fetch', async () => {
		throw new Error('the guest game must not use the network');
	});
	t.after(() => {
		mock.timers.reset();
		fetchTrap.mock.restore();
		setGuestTransport(null);
	});
	const post = start();

	// the first claim of a brand-new guest pays nothing (no absence), but answers
	const claim = await post('/api/offline', { claimId: 'guest-claim-0001' });
	assert.equal(claim.status, 200, JSON.stringify(claim.body));

	// the browser polls as time goes by; 45 minutes later chests and monsters have appeared (the engine mints them from its clock)
	let spawn = await post('/api/spawn', {});
	for (let minute = 10; minute <= 45; minute += 10) {
		mock.timers.setTime(T0 + minute * MIN);
		spawn = await post('/api/spawn', {});
		assert.equal(spawn.status, 200, JSON.stringify(spawn.body));
	}
	const tickets = (spawn.body as SyncResult).tickets as PublicTickets;
	assert.ok(tickets.chests.length > 0, 'a chest is waiting');

	const chest = tickets.chests[0];
	const opened = await post('/api/chest', { key: newKey(), x: chest.x, y: chest.y });
	assert.equal(opened.status, 200, JSON.stringify(opened.body));

	if (tickets.monsters.length > 0) {
		const fight = await post('/api/fight', { action: 'use', key: newKey(), command: { kind: 'fight', n: tickets.monsters[0].n } });
		assert.equal(fight.status, 200, JSON.stringify(fight.body));
	}
	assert.equal(fetchTrap.mock.callCount(), 0);
});

test('a guest that was away is paid the real offline claim', async (t) => {
	mock.timers.enable({ apis: ['Date'], now: T0 });
	t.after(() => {
		mock.timers.reset();
		setGuestTransport(null);
	});
	const post = start();
	await post('/api/offline', { claimId: 'guest-claim-0001' });
	await post('/api/spawn', {});

	mock.timers.setTime(T0 + 3 * 60 * MIN);
	const need = await post('/api/spawn', {});
	assert.equal(need.status, 409, 'an absence has to be claimed first');
	const back = await post('/api/offline', { claimId: 'guest-claim-0002' });
	assert.equal(back.status, 200);
	const grant = (back.body as { grant: { elapsedSec: number } | null }).grant;
	assert.ok(grant && grant.elapsedSec > 0, 'the absence was paid');
});

test('everything that belongs to an account is refused, never sent', async (t) => {
	const fetchTrap = mock.method(globalThis, 'fetch', async () => {
		throw new Error('network');
	});
	t.after(() => {
		fetchTrap.mock.restore();
		setGuestTransport(null);
	});
	const post = start();
	for (const path of ['/api/save', '/api/auth/me', '/api/rankings']) assert.equal((await post(path, {})).status, 404, path);
	// without a transport the guest door answers 503 and still does not touch the network
	setGuestTransport(null);
	assert.equal((await guestFetch('/api/spawn', { method: 'POST', body: '{}' })).status, 503);
	assert.equal(fetchTrap.mock.callCount(), 0);
});
