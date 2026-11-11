// The pure part of `npm run migrate-saves` (scripts/migrateSaves.ts), run on the frozen fixtures. No network: the script feeds the same functions with database rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { countLedger, countSave, formatCounts, migrateLedger, migrateSave, newCounts, writes } from '../../scripts/migrateSaves';
import { splitBody } from '../../src/lib/cloudSave/pipeline';
import { SAVE_SCHEMA, decodeSave, packBody } from '../../src/lib/saveFormat';
import type { BodyUpgrade } from '../../src/lib/saveUpgrade';
import type { LedgerRowUpgrade } from '../../src/lib/offline/ledgerUpgrade';
import type { LedgerRow } from '../../src/lib/offline/supabaseLedger';

const dir = resolve(__dirname, '../fixtures/saves');
const names = readdirSync(dir);
const read = (name: string) => JSON.parse(readFileSync(resolve(dir, name), 'utf-8'));

/** A stored row as the database holds it: `core` and the map apart, as `splitBody` writes them. */
const storedRow = (name: string) => {
	const decoded = decodeSave((read(name) as { text: string }).text);
	assert.ok(decoded.ok);
	const { core, world } = splitBody(packBody(decoded.ok ? decoded.state : (null as never)), 1);
	return { row: { schema: SAVE_SCHEMA, core }, world };
};

// a release that bumps the schema to 8 and renames playerName
const rename: BodyUpgrade = (body) => {
	const { playerName, ...rest } = body;
	return { ...rest, heroName: playerName, playerName };
};

for (const name of names.filter((n) => n.startsWith('save-'))) {
	test(`${name}: every current row is left alone`, () => {
		const { row, world } = storedRow(name);
		assert.deepEqual(migrateSave(row, world), { outcome: 'current' });
	});
}

test('a save of the previous schema is upgraded by the chain, and a second run finds nothing to do (idempotent)', () => {
	const { row, world } = storedRow('save-v7-mid-game.json');
	const first = migrateSave(row, world, 8, { 7: rename });
	assert.equal(first.outcome, 'upgraded');
	assert.equal(first.schema, 8);
	assert.equal(first.body?.heroName, row.core.playerName);
	// what the script stores: the upgraded body, split again, at the new schema
	const { core, world: nextWorld } = splitBody(first.body ?? {}, 1);
	assert.equal(core.heroName, row.core.playerName);
	const second = migrateSave({ schema: 8, core }, nextWorld, 8, { 7: rename });
	assert.deepEqual(second, { outcome: 'current' });
});

test('a row from a newer schema is never touched; a row with no path up, or that does not load, is reported and never written', () => {
	const { row, world } = storedRow('save-v7-new-game.json');
	assert.deepEqual(migrateSave({ ...row, schema: SAVE_SCHEMA + 1 }, world), { outcome: 'newer' });
	assert.equal(migrateSave({ ...row, schema: 6 }, world).outcome, 'unreadable');
	const broken = migrateSave(row, { land: 'nonsense', extra: [] });
	assert.equal(broken.outcome, 'unreadable');
	assert.ok(broken.reason && broken.body === undefined);
});

test("a ledger row in today's shape is current; one that holds something the readers drop is repaired; a row step is an upgrade", () => {
	const { row } = read('ledger-v1-played.json') as { row: LedgerRow };
	assert.deepEqual(migrateLedger(row), { outcome: 'current' });

	const damaged = structuredClone(row);
	damaged.inv = { ...(damaged.inv as NonNullable<LedgerRow['inv']>), bag: [{ id: 'removed_potion', qty: 3 }, null] };
	const repaired = migrateLedger(damaged);
	assert.equal(repaired.outcome, 'repaired');
	assert.deepEqual(repaired.row?.inv?.bag, [null, null]);
	assert.equal(repaired.row?.ver, row.ver, "ver is the caller's compare-and-swap, the script writes ver + 1");
	// and the repaired row is itself current: a second run changes nothing
	assert.deepEqual(migrateLedger(repaired.row as LedgerRow), { outcome: 'current' });

	const step: LedgerRowUpgrade = (r) => (r.gems === row.gems ? { ...r, gems: r.gems + 1 } : r);
	assert.equal(migrateLedger(row, [step]).outcome, 'upgraded');
});

test('the printed report has counts and fixed reasons only', () => {
	const counts = newCounts();
	const { row, world } = storedRow('save-v7-new-game.json');
	countSave(counts, migrateSave(row, world));
	countSave(counts, migrateSave(row, { land: 'x', extra: [] }));
	countLedger(counts, 'unreadable');
	countLedger(counts, migrateLedger((read('ledger-v1-new.json') as { row: LedgerRow }).row));
	const text = formatCounts(counts, false);
	assert.match(text, /saves: {3}1 current, 0 upgraded \(would be written\)/);
	assert.match(text, /1 unreadable/);
	assert.equal(writes(counts), 0);
	assert.doesNotMatch(text, /fixture|Fixture|[0-9a-f]{8}-[0-9a-f]{4}/i, 'no name and no id');
});
