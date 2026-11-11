import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryLedgers } from '../builders';
import { ACHIEVEMENTS } from '../../src/catalog/achievements';
import { BUILDINGS_FLAG } from '../../src/config/buildings';
import { acceptSave, type SaveRepo, type StoredSave, type WorldPart } from '../../src/lib/cloudSave/pipeline';
import { settleIdols } from '../../src/lib/cloudSave/idolTrust';
import { readStats } from '../../src/lib/offline/stats';
import { ledgerFromRow, ledgerToRow } from '../../src/lib/offline/supabaseLedger';
import { decodeSave } from '../../src/lib/saveFormat';
import { standingIdols } from '../../src/lib/idolEconomy';
import { judgeAccount, buildSeedGame, applySeed, REHEARSAL_SEED, type AccountFacts, type SeedRepos } from '../../scripts/lib/rehearsalSeed';
import type { RebirthRecord } from '../../src/lib/cloudSave/rebirthHistory';

const NOW = 1_800_000_000_000;

const memoryRepos = () => {
	const saves = new Map<string, StoredSave>();
	const worlds = new Map<string, WorldPart>();
	const rebirths: RebirthRecord[] = [];
	const achievements: string[] = [];
	const repo: SaveRepo = {
		load: async (id, options) => {
			const row = saves.get(id);
			return row ? { ...row, ...(options?.world ? { world: worlds.get(id) } : {}) } : null;
		},
		commit: async (id, baseRev, save, world) => {
			const current = saves.get(id);
			if (baseRev === 0 ? !!current : current?.rev !== baseRev) return false;
			saves.set(id, save);
			if (world) worlds.set(id, world);
			return true;
		},
		archive: async () => undefined,
		pin: async () => undefined,
		recordRebirth: async (_id, record) => {
			rebirths.push(record);
		},
	};
	const { ledgers, ledgerRepo } = memoryLedgers();
	const repos: SeedRepos = {
		saves: repo,
		ledgers: ledgerRepo,
		achievements: {
			record: async (_id, ids) => {
				achievements.push(...ids);
			},
		},
	};
	return { repos, saves, worlds, ledgers, rebirths, achievements };
};

// the maps the game grows are random; a fixed seed keeps the build below on the same land
let seed = 4242;
Math.random = () => {
	seed = (seed * 1664525 + 1013904223) % 4294967296;
	return seed / 4294967296;
};

test('the seeded account is accepted by the real save path with a consistent revision, hash, ledger and no flags', async () => {
	assert.ok(BUILDINGS_FLAG.enabled);
	const plan = buildSeedGame(NOW);
	const mem = memoryRepos();
	const { outcome, rebirthLogged } = await applySeed(mem.repos, 'throwaway', 'Rehearsal', plan, NOW);
	assert.equal(outcome.kind, 'ok', JSON.stringify(outcome));
	if (outcome.kind !== 'ok') return;
	assert.equal(outcome.rev, 1);
	assert.deepEqual(outcome.flags, []);
	assert.equal(rebirthLogged, true);
	assert.deepEqual(
		mem.rebirths.map((r) => r.rebirthNo),
		[1],
	);

	// the save row and its map agree
	const stored = mem.saves.get('throwaway')!;
	assert.equal(stored.worldHash, mem.worlds.get('throwaway')!.hash);
	assert.equal(stored.summary.rebirths, REHEARSAL_SEED.rebirths);
	assert.ok(stored.summary.tilesOwned >= REHEARSAL_SEED.tiles);
	assert.ok(stored.summary.legacyEarned >= 1);
	// the server did not cut the seeded Embers or XP back
	assert.equal(outcome.xp, undefined);
	assert.equal(outcome.prestige, undefined);

	// the ledger: the server's record of Idols, the gems, the run, the counters (and it was kept, not reset, by the save)
	const ledger = mem.ledgers.get('throwaway')!;
	assert.deepEqual(ledger.legacy.idols, REHEARSAL_SEED.idols);
	assert.equal(ledger.gems, REHEARSAL_SEED.gems);
	assert.equal(stored.core.gems, REHEARSAL_SEED.gems);
	assert.equal(ledger.rebirths, 1);
	assert.ok(ledger.runId >= 2);
	assert.equal(ledger.stats.tutorial.skipped, false);
	assert.ok(ledger.stats.tutorial.done.length > 0);
	assert.ok(Object.keys(ledger.stats.seen).length >= 3);
	assert.ok(Object.values(ledger.stats.kills).reduce((a, b) => a + b, 0) >= 3);
	assert.equal(ledger.stats.achievements.length, 2);
	assert.deepEqual(mem.achievements, REHEARSAL_SEED.achievements);
	for (const id of mem.achievements) assert.ok(ACHIEVEMENTS.some((a) => a.id === id));
	assert.equal(ledger.resetAt, NOW);

	// the stored game still reads back through the tolerant readers, and its Idols stand and survive the server's own settling
	const row = JSON.parse(JSON.stringify(ledgerToRow(ledger)));
	const readBack = ledgerFromRow(row);
	assert.deepEqual(readBack.legacy.idols, REHEARSAL_SEED.idols);
	assert.deepEqual(readStats(row.stats).seen, ledger.stats.seen);
	const decoded = decodeSave(plan.saveText);
	assert.equal(decoded.ok, true);
	if (!decoded.ok) return;
	assert.deepEqual(standingIdols(decoded.state.tiles), REHEARSAL_SEED.idols);
	assert.deepEqual(settleIdols(REHEARSAL_SEED.idols, decoded.state, false), REHEARSAL_SEED.idols);
});

test('the seed is the pre-flip state: it never touches the profile epoch and an existing ledger row is taken over, not duplicated', async () => {
	const plan = buildSeedGame(NOW);
	const mem = memoryRepos();
	// a ledger created by a first login: version 3, run 1
	await mem.repos.ledgers.commit('throwaway', 0, { ...plan.ledger, ver: 3, runId: 1, gems: 1000, legacy: { idols: {} } });
	const { outcome } = await applySeed(mem.repos, 'throwaway', 'Rehearsal', plan, NOW);
	assert.equal(outcome.kind, 'ok');
	assert.ok(mem.ledgers.get('throwaway')!.ver > 3);
	assert.equal(mem.ledgers.get('throwaway')!.gems, REHEARSAL_SEED.gems);
	// seeding the same account twice is refused: a save exists now
	await assert.rejects(() => applySeed(mem.repos, 'throwaway', 'Rehearsal', plan, NOW + 60_000), /already has a save/);
});

test('the server accepts a normal follow-up save on top of the seed (revision 2)', async () => {
	const plan = buildSeedGame(NOW);
	const mem = memoryRepos();
	await applySeed(mem.repos, 'throwaway', 'Rehearsal', plan, NOW);
	const next = await acceptSave(mem.repos.saves, 'throwaway', 'Rehearsal', plan.saveText, 1, NOW + 120_000, false, mem.repos.ledgers);
	assert.equal(next.kind, 'ok', JSON.stringify(next));
	if (next.kind === 'ok') assert.equal(next.rev, 2);
	assert.deepEqual(mem.ledgers.get('throwaway')!.legacy.idols, REHEARSAL_SEED.idols);
});

const facts = (patch: Partial<AccountFacts> = {}): AccountFacts => ({
	emailMatches: true,
	hasProfile: true,
	profileEpoch: null,
	save: null,
	rank: null,
	ledgerUsed: false,
	historyRows: 0,
	rebirthRows: 0,
	achievementRows: 0,
	...patch,
});

test('the throwaway check: only an empty, pre-flip account with the expected e-mail passes', () => {
	assert.deepEqual(judgeAccount(facts(), false), { ok: true, needsWipe: false, reasons: [] });
	assert.equal(judgeAccount(facts({ emailMatches: false }), true).ok, false, 'a wrong e-mail is never forced');
	assert.equal(judgeAccount(facts({ profileEpoch: 2 }), true).ok, false, 'an epoch is never forced');
	assert.equal(judgeAccount(facts({ hasProfile: false }), true).ok, false);
});

test('the throwaway check: an account with game data needs --force-fresh, a real-looking one is called out', () => {
	const small = facts({ save: { rebirths: 0, tilesOwned: 12, level: 3 } });
	const refused = judgeAccount(small, false);
	assert.equal(refused.ok, false);
	assert.equal(refused.needsWipe, true);
	assert.match(refused.reasons.join(' '), /--force-fresh/);
	assert.deepEqual(judgeAccount(small, true).ok, true);

	const real = facts({ save: { rebirths: 5, tilesOwned: 900, level: 150 }, rank: { rebirths: 5, tilesOwned: 900, level: 150, trusted: true } });
	const verdict = judgeAccount(real, false);
	assert.equal(verdict.ok, false);
	assert.match(verdict.reasons.join(' '), /real player/);
	// the reasons carry counts and words only
	assert.doesNotMatch(verdict.reasons.join(' '), /900|150/);
});
