// The guard for every future PR: every frozen fixture in tests/fixtures/saves/ (one per released shape, made from the code of that release by
// `npm run gen-save-fixtures`, made-up data) must still be read by TODAY's code. If this fails, a change is not save-compatible: make it additive
// (a new optional field, a new id, a tolerant reader) or write an upgrade step and a migration (docs/plan/save-compatibility.md). Never edit or delete a fixture to make it pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { acceptSave, type SaveRepo, type StoredSave } from '../../src/lib/cloudSave/pipeline';
import { summarize } from '../../src/lib/cloudSave/summary';
import { SAVE_SCHEMA, decodeSave, encodeSave } from '../../src/lib/saveFormat';
import { ledgerFromRow, ledgerToRow, type LedgerRow } from '../../src/lib/offline/supabaseLedger';
import { memoryLedgers } from '../builders';

const dir = resolve(__dirname, '../fixtures/saves');
const files = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'released-ids.json');
const saves = files.filter((f) => f.startsWith('save-'));
const ledgers = files.filter((f) => f.startsWith('ledger-'));
const read = (name: string) => JSON.parse(readFileSync(resolve(dir, name), 'utf-8'));

test('there is at least one fixture of every kind (a deleted fixture is a failure, not a pass)', () => {
	assert.ok(saves.length >= 3, 'saves');
	assert.ok(ledgers.length >= 2, 'ledgers');
});

for (const name of saves) {
	test(`save fixture ${name} is accepted by today's code and round-trips`, async () => {
		const fixture = read(name) as { schema: number; text: string };
		const decoded = decodeSave(fixture.text);
		assert.equal(decoded.ok, true, decoded.ok ? '' : decoded.reason);
		if (!decoded.ok) return;
		// writing it again and reading that gives the same game: nothing is lost or invented on the way
		const again = decodeSave(encodeSave(decoded.state, 1));
		assert.equal(again.ok, true);
		if (again.ok) assert.deepEqual(again.state, decoded.state);
		// the server side reads it too: summary derived, and the whole save path accepts it as a first save of an account
		assert.ok(Number.isFinite(summarize(decoded.state).rates.gold));
		const outcome = await acceptSave(memorySaves(), 'fixture-user', 'Fixture', fixture.text, 0, 1_800_000_000_000, true, memoryLedgers().ledgerRepo);
		assert.equal(outcome.kind, 'ok', JSON.stringify(outcome));
		assert.ok(fixture.schema <= SAVE_SCHEMA, 'a fixture is never newer than the code');
	});
}

for (const name of ledgers) {
	test(`ledger fixture ${name} is read by today's code, loses nothing and is stable`, () => {
		const { row } = read(name) as { row: LedgerRow };
		const ledger = ledgerFromRow(row);
		const written = ledgerToRow(ledger) as unknown as Record<string, unknown>;
		delete written.updated_at;
		// writing the ledger back and reading it again gives the same ledger (the readers and the writer agree)
		assert.deepEqual(ledgerFromRow(written as unknown as LedgerRow), ledger);
		// nothing the row held was dropped: the inventory kept its version, the fight is still open, the lists are whole
		if (row.inv) assert.equal(ledger.inv?.ver, row.inv.ver, 'the inventory lost a piece');
		if (row.combat) assert.deepEqual(ledger.combat, row.combat);
		assert.equal(ledger.bank.chests.length, row.bank.chests.length);
		assert.equal(ledger.bank.monsters.length, row.bank.monsters.length);
		assert.equal(ledger.ver, row.ver);
	});
}

/** A save store in a Map: enough for the first save of an account. */
const memorySaves = (): SaveRepo => {
	let stored: StoredSave | null = null;
	return {
		load: async () => stored,
		commit: async (_user, baseRev, save: StoredSave) => {
			if ((stored?.rev ?? 0) !== baseRev) return false;
			stored = save;
			return true;
		},
		archive: async () => undefined,
		pin: async () => undefined,
	};
};
