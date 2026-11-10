import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readLastReset, readPlayerReset, writeLastReset, writePlayerReset } from '../../src/lib/offline/season';

// A reset of one account (reset-players --user, reset-test-account) leaves a per-player marker, so that player's browser drops its copy of the old game (no "this browser or the account?" hub)
// without touching the global season marker, which would reset every other player at their next login.

/** A tiny in-memory app_settings table behind the two calls season.ts makes */
const fakeDb = () => {
	const rows = new Map<string, { at?: string }>();
	const db = {
		from: () => ({
			select: () => ({
				eq: (_col: string, key: string) => ({ maybeSingle: async () => ({ data: rows.has(key) ? { value: rows.get(key) } : null, error: null }) }),
			}),
			upsert: async (row: { key: string; value: { at?: string } }) => {
				rows.set(row.key, row.value);
				return { error: null };
			},
		}),
	};
	return { db: db as unknown as SupabaseClient, rows };
};

test('a player reset is stored per player and does not touch the season marker', async () => {
	const { db, rows } = fakeDb();
	assert.equal(await readPlayerReset(db, 'u1'), null);
	await writePlayerReset(db, 'u1', 1_800_000_000_000);
	assert.equal(await readPlayerReset(db, 'u1'), 1_800_000_000_000);
	assert.equal(await readPlayerReset(db, 'u2'), null, 'another player is not reset');
	assert.equal(await readLastReset(db), null, 'no global season marker was written');
	assert.deepEqual([...rows.keys()], ['player_reset:u1']);
	await writeLastReset(db, 5);
	assert.equal(await readLastReset(db), 5);
	assert.equal(await readPlayerReset(db, 'u1'), 1_800_000_000_000);
});
