import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, store } from './helpers';
import { pickPersisted, type PersistedGame } from '../src/lib/sanitizeSave';
import { encodeSave } from '../src/lib/saveFormat';
import { acceptSave, type SaveRepo, type StoredSave, type WorldPart } from '../src/lib/cloudSave/pipeline';
import { newLedger } from '../src/lib/offline/ledger';
import { addLedger, addSave, addTransition, formatReport, judgeSave, judgeTransition, newReport } from '../scripts/liveSavesReport';

const T0 = 1_800_000_000_000;

const game = (patch: Partial<PersistedGame> = {}): PersistedGame => {
	api().resetGame();
	growTo(12);
	store.setState({ playSeconds: 1000, resources: { ...api().resources, gold: 100, wood: 0, stone: 0, coal: 0, food: 0, hide: 0 }, ...patch } as never);
	return structuredClone(pickPersisted(api()));
};

/** What the database would hold after this player's save was accepted: the same code path, an in-memory store. */
const stored = async (state: PersistedGame, at = T0): Promise<StoredSave> => {
	let row: StoredSave | null = null;
	let world: WorldPart | null = null;
	const repo: SaveRepo = {
		load: async (_id, options) => (row ? (options?.world ? { ...row, world: world ?? undefined } : { ...row }) : null),
		commit: async (_id, _base, save, w) => {
			row = save;
			world = w ?? world;
			return true;
		},
		archive: async () => undefined,
		pin: async () => undefined,
	};
	const outcome = await acceptSave(repo, 'u', 'Zoë', encodeSave(state), 0, at);
	assert.equal(outcome.kind, 'ok');
	return { ...(row as unknown as StoredSave), world: world as unknown as WorldPart };
};

test('an honest stored save is accepted without flags and counted', async () => {
	const row = await stored(game());
	const verdict = await judgeSave(row, null);
	assert.equal(verdict.outcome, 'accepted');
	assert.deepEqual(verdict.flags, []);
	assert.equal(verdict.midCastleUpgrade, false);
	assert.equal(verdict.hasLedger, false);
});

test('a save from an older season is counted as rejected, with its reason', async () => {
	const row = await stored(game());
	const verdict = await judgeSave({ ...row, schema: row.schema - 1 }, null);
	assert.equal(verdict.outcome, 'invalid');
	assert.match(verdict.reason ?? '', /older season/);
});

test("a map that today's rules refuse is counted as rejected, with the reason", async () => {
	const row = await stored(game());
	const land = (row.world?.land as { x: number; y: number }[]).slice();
	land.push({ ...land[1] }); // two tiles on one position
	const verdict = await judgeSave({ ...row, world: { ...(row.world as WorldPart), land } }, null);
	assert.equal(verdict.outcome, 'invalid');
	assert.match(verdict.reason ?? '', /impossible data/);
});

test('a save without a map is unreadable, not a crash', async () => {
	const row = await stored(game());
	const verdict = await judgeSave({ ...row, world: undefined }, null);
	assert.equal(verdict.outcome, 'unreadable');
});

test('a first save richer than its income explains is flagged, and the ledger row is taken into account', async () => {
	const row = await stored(game());
	row.summary = { ...row.summary, gold: 1e15 };
	const rich = await judgeSave({ ...row, core: { ...row.core, resources: { ...(row.core.resources as object), gold: 1e15 } } }, newLedger(T0));
	assert.equal(rich.outcome, 'accepted');
	assert.ok(rich.flags.includes('baseline_rich'));
	assert.equal(rich.hasLedger, true);
});

test('a running castle upgrade is counted as a number, nothing more', async () => {
	const row = await stored(game());
	row.summary = {
		...row.summary,
		derived: { ...row.summary.derived, castleUpgrade: { toLevel: 2, remainingSec: 100, totalSec: 200 } as never },
	};
	const verdict = await judgeSave(row, null);
	assert.equal(verdict.midCastleUpgrade, true);
});

test('the dry run never writes: the ledger it was handed is untouched', async () => {
	const row = await stored(game());
	const ledger = newLedger(T0);
	const copy = structuredClone(ledger);
	await judgeSave(row, ledger);
	assert.deepEqual(ledger, copy);
});

test('the report counts reasons and flags and holds no row data', async () => {
	const report = newReport();
	const ok = await judgeSave(await stored(game()), newLedger(T0));
	const old = await judgeSave({ ...(await stored(game())), schema: 1 }, null);
	addSave(report, ok);
	addSave(report, ok);
	addSave(report, old);
	addSave(report, { ...ok, flags: ['gold_jump', 'xp_jump'], xpClamped: true, midCastleUpgrade: true });
	addTransition(report, ['gold_jump', 'xp_jump', 'gems_increase']);
	addTransition(report, []);
	addTransition(report, ['castle_jump', 'playtime_fast']);
	addLedger(report, true, true);
	addLedger(report, false, false);

	assert.equal(report.saves, 4);
	assert.equal(report.accepted, 3);
	assert.equal(
		Object.values(report.invalid).reduce((a, b) => a + b, 0),
		1,
	);
	assert.deepEqual(report.flagged, { gold_jump: 1, xp_jump: 1 });
	assert.equal(report.wouldReject, 1); // gold_jump is on the enforcement allowlist, xp_jump is only clamped
	assert.equal(report.xpClamped, 1);
	assert.equal(report.midCastleUpgrade, 1);
	assert.equal(report.withoutLedger, 1);
	assert.equal(report.transitions, 3);
	// grant-dependent flags (gold, XP, gems) are expected on history copies: counted apart, never as "would be refused"
	assert.deepEqual(report.transitionFlagged, { castle_jump: 1, playtime_fast: 1 });
	assert.deepEqual(report.transitionUnjudged, { gold_jump: 1, xp_jump: 1, gems_increase: 1 });
	assert.equal(report.transitionWouldReject, 1); // playtime_fast is on the allowlist and needs no grants
	assert.equal(report.ledgers, 2);
	assert.equal(report.ledgersWithoutSave, 1);
	assert.equal(report.ledgersWithoutInventory, 1);

	const text = formatReport(report);
	assert.match(text, /Saves checked: 4/);
	assert.match(text, /gold_jump: 1/);
	assert.match(text, /mid castle upgrade right now: 1/);
	assert.doesNotMatch(text, /Zoë|dry-run/);
});

test('two consecutive saves of an honest account raise no transition flag', async () => {
	const older = await stored(game(), T0);
	const newer = await stored(game({ playSeconds: 1060 }), T0 + 60_000);
	assert.deepEqual(
		judgeTransition({ summary: older.summary, serverSavedAt: older.serverSavedAt }, { summary: newer.summary, serverSavedAt: newer.serverSavedAt }),
		[],
	);
});

test('the new chapter report counts affected accounts, saves, name collisions and ledger rows missing the new columns', async () => {
	const { buildChapterReport, formatChapterReport } = await import('../scripts/liveSavesReport');
	const profiles = [
		{ characterName: 'Anna', epoch: null, hasSave: true },
		{ characterName: 'anna', epoch: null, hasSave: false },
		{ characterName: 'ANNA', epoch: null, hasSave: true },
		{ characterName: 'Bob', epoch: 1, hasSave: true },
		{ characterName: 'Cleo', epoch: 99, hasSave: true },
	];
	const report = buildChapterReport(profiles, [{ stats: null, legacy: null }, { stats: { kills: 1 }, legacy: null }, {}], { stats: true, legacy: true }, 1);
	assert.equal(report.profiles, 5);
	assert.equal(report.profilesWithoutEpoch, 3);
	assert.equal(report.nameCollisionGroups, 1);
	assert.equal(report.accountsToRename, 2, 'the oldest of three keeps the name');
	assert.equal(report.affectedWithSave <= report.affected, true);
	assert.equal(report.ledgerRows, 3);
	assert.equal(report.ledgerRowsWithoutStats, 2);
	assert.equal(report.ledgerRowsWithoutLegacy, 3);
	const text = formatChapterReport(report);
	assert.match(text, /names that collide ignoring case: 1 \(2 accounts/);
	assert.doesNotMatch(text, /Anna|Bob|Cleo/i, 'counts only, no names');

	const missing = formatChapterReport(buildChapterReport([], [], { stats: false, legacy: false }, 1));
	assert.match(missing, /stats: COLUMN MISSING/);
	assert.match(missing, /legacy: COLUMN MISSING/);
});
