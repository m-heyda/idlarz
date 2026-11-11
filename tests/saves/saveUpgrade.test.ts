import test from 'node:test';
import assert from 'node:assert/strict';
import { SAVE_UPGRADES, upgradeBody, type BodyUpgrade } from '../../src/lib/saveUpgrade';
import { SAVE_SCHEMA } from '../../src/lib/saveFormat';
import { LEDGER_ROW_UPGRADES, upgradeLedgerRow, type LedgerRowUpgrade } from '../../src/lib/offline/ledgerUpgrade';
import type { LedgerRow } from '../../src/lib/offline/supabaseLedger';

// the worked example of the JSDoc in saveUpgrade.ts: v7 -> v8 renames playerName to heroName and moves the gems out, then v8 -> v9 adds a default
const chain: Record<number, BodyUpgrade> = {
	7: (body) => {
		if (!('playerName' in body)) return body;
		const { playerName, gems: _gems, ...rest } = body;
		void _gems;
		return { ...rest, heroName: playerName };
	},
	8: (body) => ({ ...body, mood: body.mood ?? 'calm' }),
};

test('the chain runs every step from the save to the target, in order', () => {
	const result = upgradeBody({ playerName: 'Ada', gems: 5, land: [] }, 7, 9, chain);
	assert.deepEqual(result, { ok: true, body: { heroName: 'Ada', mood: 'calm', land: [] }, steps: 2 });
});

test('it is pure: the input is never changed and a step cannot reach it', () => {
	const input = { playerName: 'Ada', nested: { a: [1, 2] } };
	const snapshot = structuredClone(input);
	const sneaky: Record<number, BodyUpgrade> = {
		7: (body) => {
			(body.nested as { a: number[] }).a.push(99); // a step that mutates what it was given
			return body;
		},
	};
	const result = upgradeBody(input, 7, 8, sneaky);
	assert.deepEqual(input, snapshot);
	assert.deepEqual(result.ok && result.body.nested, { a: [1, 2, 99] });
});

test('a body that is already at the target is returned as a copy, untouched', () => {
	const input = { heroName: 'Ada' };
	const result = upgradeBody(input, 8, 8, chain);
	assert.deepEqual(result, { ok: true, body: input, steps: 0 });
	assert.notEqual(result.ok && result.body, input);
});

test('a gap in the chain, a newer save and nonsense versions are refused, never half-upgraded', () => {
	assert.deepEqual(upgradeBody({}, 6, 8, chain), { ok: false, reason: 'no upgrade from schema 6' });
	assert.deepEqual(upgradeBody({}, 9, 8, chain), { ok: false, reason: 'newer schema' });
	assert.deepEqual(upgradeBody({}, 0, 8, chain), { ok: false, reason: 'unknown schema' });
	assert.deepEqual(upgradeBody({}, 1.5, 8, chain), { ok: false, reason: 'unknown schema' });
});

test('the schema-7 step of the worked example run twice gives the same body (an already-new body is returned unchanged)', () => {
	const once = upgradeBody({ playerName: 'Ada', gems: 5 }, 7, 8, chain);
	assert.ok(once.ok);
	assert.deepEqual(once.ok && once.body, { heroName: 'Ada' });
	const twice = once.ok ? chain[7](once.body) : {};
	assert.deepEqual(twice, { heroName: 'Ada' }, 'heroName is not overwritten with undefined');
});

test('running a step twice changes nothing more (idempotent on a body that is already new)', () => {
	const once = upgradeBody({ playerName: 'Ada', mood: 'brave' }, 8, 9, chain);
	assert.ok(once.ok);
	const twice = once.ok ? upgradeBody(once.body, 8, 9, chain) : once;
	assert.deepEqual(twice, once);
});

test('today the chains are empty: schema 7 is the first that stays compatible, older saves are refused as before', () => {
	assert.equal(SAVE_SCHEMA, 7);
	assert.deepEqual(Object.keys(SAVE_UPGRADES), []);
	assert.equal(upgradeBody({}, 6, SAVE_SCHEMA).ok, false);
	assert.equal(upgradeBody({ a: 1 }, SAVE_SCHEMA, SAVE_SCHEMA).ok, true);
	assert.deepEqual(LEDGER_ROW_UPGRADES, []);
});

test('a ledger row step recognises the old shape itself and leaves a new row alone', () => {
	const rename: LedgerRowUpgrade = (row) => {
		const combat = row.combat as unknown as Record<string, unknown> | null;
		if (!combat || !('autoUse' in combat)) return row;
		const { autoUse, ...rest } = combat;
		return { ...row, combat: { ...rest, autoPotion: autoUse } } as unknown as LedgerRow;
	};
	const old = { combat: { autoUse: true, hp: 1 } } as unknown as LedgerRow;
	const upgraded = upgradeLedgerRow(old, [rename]);
	assert.deepEqual(upgraded.combat, { autoPotion: true, hp: 1 });
	assert.deepEqual(upgradeLedgerRow(upgraded, [rename]), upgraded, 'a second run changes nothing');
	assert.deepEqual(old.combat, { autoUse: true, hp: 1 }, 'the input is never changed');
});
