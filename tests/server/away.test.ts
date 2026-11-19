import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { awayBlockOf, loadAway } from '../../src/lib/offline/away';

const NOW = Date.UTC(2026, 10, 11, 12, 0, 0);
const H = 3600_000;
const derived = { offlineCapSec: 9 * 3600, offlineEfficiency: 0.6 };

test('the away block measures from the later of the save and the ledger anchor', () => {
	const block = awayBlockOf({ serverSavedAt: NOW - 5 * H, derived }, NOW - 2 * H, NOW);
	assert.deepEqual(block, { gapSec: 2 * 3600, capSec: 9 * 3600, efficiency: 0.6 });
	assert.deepEqual(awayBlockOf({ serverSavedAt: NOW - H, derived }, NOW - 3 * H, NOW)?.gapSec, 3600);
	assert.equal(awayBlockOf({ serverSavedAt: NOW - H, derived }, null, NOW)?.gapSec, 3600);
});

test('no block without a save or under the minimum gap', () => {
	assert.equal(awayBlockOf(null, NOW - H, NOW), null);
	assert.equal(awayBlockOf({ serverSavedAt: NOW - 299_000, derived }, null, NOW), null);
	assert.notEqual(awayBlockOf({ serverSavedAt: NOW - 300_000, derived }, null, NOW), null);
	assert.equal(awayBlockOf({ serverSavedAt: Number.NaN, derived }, null, NOW), null);
});

test('an older row without the stored cap falls back to the base limits, and a gap past the cap is reported whole', () => {
	const block = awayBlockOf({ serverSavedAt: NOW - 20 * H, derived: {} }, null, NOW);
	assert.equal(block?.capSec, 8 * 3600);
	assert.equal(block?.efficiency, 0.5);
	assert.equal(block?.gapSec, 20 * 3600);
	assert.notEqual(awayBlockOf({ serverSavedAt: NOW - H, derived: 'junk' }, null, NOW), null);
});

/** A stand-in for the Supabase client: `table.select().eq().maybeSingle()` answers with `rows[table]`, or with the permission error the browser's token gets on `player_ledger`. */
const fakeDb = (rows: Record<string, unknown>, denied: string[] = []) =>
	({
		from: (table: string) => ({
			select: () => ({
				eq: () => ({
					maybeSingle: async () => (denied.includes(table) ? { data: null, error: { code: '42501' } } : { data: rows[table] ?? null, error: null }),
				}),
			}),
		}),
	}) as unknown as SupabaseClient;

test('the ledger anchor is read with the client given for it: the player token may not read that column, so the away gap used to ignore the anchor', async () => {
	const saved = { server_saved_at: new Date(NOW - 5 * H).toISOString(), derived };
	const ledger = { anchor_at: new Date(NOW - 2 * H).toISOString() };
	const user = fakeDb({ player_saves: saved }, ['player_ledger']);
	const server = fakeDb({ player_ledger: ledger });
	assert.equal((await loadAway(user, 'u1', NOW))?.gapSec, 5 * 3600, 'with only the player token the ledger read is refused and the save time counts');
	assert.equal((await loadAway(user, 'u1', NOW, server))?.gapSec, 2 * 3600, 'read with the server client, the later anchor counts');
});
