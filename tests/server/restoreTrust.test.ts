// The way back for a false-positive flag (IDL-209) and proof that the save path is unchanged while enforcement is off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { honestGame, T0 } from '../audit/cheats';
import { encodeSave } from '../../src/lib/saveFormat';
import { acceptSave, type SaveRepo, type StoredSave, type WorldPart } from '../../src/lib/cloudSave/pipeline';
import { restoreTrust } from '../../src/lib/cloudSave/restoreTrust';
import { ENFORCEMENT } from '../../src/lib/cloudSave/verify';
import type { PersistedGame } from '../../src/lib/sanitizeSave';

/** An in-memory store that keeps the map too (restoreTrust re-reads the stored game) and records what was pinned. */
const store = () => {
	let row: StoredSave | null = null;
	let world: WorldPart | null = null;
	const pinned: StoredSave[] = [];
	const repo: SaveRepo = {
		load: async (_id, options) => (row ? (options?.world ? { ...row, world: world ?? undefined } : { ...row }) : null),
		commit: async (_id, baseRev, save, w) => {
			if (baseRev === 0 ? !!row : row?.rev !== baseRev) return false;
			row = save;
			world = w ?? world;
			return true;
		},
		archive: async () => undefined,
		pin: async (_id, save) => void pinned.push(save),
	};
	return {
		repo,
		pinned,
		get row() {
			return row!;
		},
	};
};

const accept = (repo: SaveRepo, state: PersistedGame, baseRev: number, at: number) => acceptSave(repo, 'u', 'Z', encodeSave(state), baseRev, at);
const cheated = (base: PersistedGame): PersistedGame => ({
	...base,
	playSeconds: base.playSeconds + 60,
	merchantUpgrades: { foreman: 10, haggler: 10, tithe: 10, bulk: 8 },
});

test('enforcement is off as shipped, and a flagged save is stored and paid from the trusted economy exactly as before IDL-209', async () => {
	assert.equal(ENFORCEMENT.enabled, false);
	const s = store();
	const base = honestGame();
	await accept(s.repo, base, 0, T0);
	const honestRate = s.row.summary.rates.gold;
	const outcome = await accept(s.repo, cheated(base), 1, T0 + 60_000);
	assert.ok(outcome.kind === 'ok' && outcome.flags.includes('networth_exceeds') && outcome.economy === 'trusted');
	assert.equal(s.row.everFlagged, true);
	assert.ok(s.row.summary.rates.gold <= honestRate * 1.0001, 'income stays frozen at the last trusted rates');
	assert.equal(s.pinned.length, 0, 'the save path does not call restoreTrust');
});

test('a false-positive flag is lifted: the account is trusted again, the old save is pinned, and an honest save after it is accepted clean', async () => {
	const s = store();
	const base = honestGame();
	await accept(s.repo, base, 0, T0);
	const frozen = s.row.summary.rates.gold;
	// the "cheat" here is a stand-in for any false positive: the stored game claims merchant levels the baseline did not pay for
	await accept(s.repo, cheated(base), 1, T0 + 60_000);
	assert.equal(s.row.everFlagged, true);
	assert.ok(s.row.flags.includes('networth_exceeds'));

	const result = await restoreTrust(s.repo, 'u', 'Z');
	assert.equal(result.kind, 'restored');
	assert.ok(result.kind === 'restored' && result.fromRev === 2 && result.rev === 3 && result.flagsCleared.includes('networth_exceeds') && !result.wasRanked);
	assert.deepEqual(s.row.flags, []);
	assert.equal(s.row.everFlagged, false);
	assert.equal(s.row.rev, 3);
	assert.equal(s.pinned.length, 1, 'the flagged save is kept in the history');
	assert.equal(s.pinned[0].rev, 2);
	assert.ok(s.row.summary.rates.gold >= frozen, 'the rates are the stored game own again');

	// an honest follow-up from the restored baseline raises no flag and is paid from its own economy
	const next = await accept(s.repo, { ...base, playSeconds: base.playSeconds + 120 }, 3, T0 + 120_000);
	assert.ok(next.kind === 'ok' && next.flags.length === 0 && next.economy === undefined, JSON.stringify(next));
	assert.equal(s.row.everFlagged, false);
});

test('restoring is idempotent: a trusted account is left alone, and a missing one is reported', async () => {
	const s = store();
	assert.equal((await restoreTrust(s.repo, 'u', 'Z')).kind, 'no_save');
	const base = honestGame();
	await accept(s.repo, base, 0, T0);
	await accept(s.repo, cheated(base), 1, T0 + 60_000);
	assert.equal((await restoreTrust(s.repo, 'u', 'Z')).kind, 'restored');
	const rev = s.row.rev;
	assert.equal((await restoreTrust(s.repo, 'u', 'Z')).kind, 'already_trusted');
	assert.equal(s.row.rev, rev, 'the second run wrote nothing');
	assert.equal(s.pinned.length, 1);
});

test('a save that lands between the read and the write wins: restore answers conflict and changes nothing', async () => {
	const s = store();
	const base = honestGame();
	await accept(s.repo, base, 0, T0);
	await accept(s.repo, cheated(base), 1, T0 + 60_000);
	const racing: SaveRepo = { ...s.repo, commit: async () => false };
	assert.equal((await restoreTrust(racing, 'u', 'Z')).kind, 'conflict');
	assert.equal(s.row.rev, 2);
	assert.equal(s.row.everFlagged, true);
});
