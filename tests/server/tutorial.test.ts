import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, store } from '../helpers';
import { memoryLedgers } from '../builders';
import { pickPersisted, type PersistedGame } from '../../src/lib/sanitizeSave';
import { encodeSave } from '../../src/lib/saveFormat';
import { acceptSave, type SaveRepo, type StatsRow, type StoredSave, type WorldPart } from '../../src/lib/cloudSave/pipeline';
import type { ServiceDeps } from '../../src/lib/offline/service';
import { tutorialStep, type Online } from '../../src/lib/offline/online';
import type { TutorialReply } from '../../src/lib/offline/tutorial';
import { readStats, emptyStats, isEmptyStats } from '../../src/lib/offline/stats';
import { readProgress } from '../../src/lib/tutorial/progress';
import { STARTER_REWARDS } from '../../src/catalog/tutorial';

const memory = () => {
	const rows = new Map<string, StoredSave>();
	const worlds = new Map<string, WorldPart>();
	const saves: SaveRepo = {
		load: async (id, options) => {
			const row = rows.get(id);
			if (!row) return null;
			return options?.world ? { ...row, world: worlds.get(id) } : { ...row };
		},
		commit: async (id, baseRev, save, world) => {
			const current = rows.get(id);
			if (baseRev === 0 ? !!current : current?.rev !== baseRev) return false;
			rows.set(id, save);
			if (world) worlds.set(id, world);
			return true;
		},
		archive: async () => undefined,
		pin: async () => undefined,
	};
	void ({} as StatsRow);
	const { ledgers, ledgerRepo } = memoryLedgers();
	const deps: ServiceDeps = { saves, ledgers: ledgerRepo, secret: 'test-secret-test-secret' };
	return { saves, ledgerRepo, ledgers, deps };
};

const T0 = 1_800_000_000_000;
const ok = (out: Online<TutorialReply>): TutorialReply => {
	assert.equal(out.kind, 'ok', JSON.stringify(out));
	return (out as { kind: 'ok'; value: TutorialReply }).value;
};

/** A save of a player who has bought `tiles` tiles (the count the proof reads), then the first request seeds the ledger. */
const player = async (tiles: number, xp = 5000) => {
	const m = memory();
	api().resetGame();
	growTo(tiles);
	store.setState({ playSeconds: 1000, resources: { ...api().resources, xp } } as never);
	const state: PersistedGame = structuredClone(pickPersisted(api()));
	await acceptSave(m.saves, 'u1', 'Zoe', encodeSave(state), 0, T0, false, m.ledgerRepo);
	return m;
};

test('a step is recorded once and pays its bundle once: a repeat, with the same key or another, pays nothing', async () => {
	const m = await player(8);
	const first = ok(await tutorialStep(m.deps, 'u1', 'tutorial-key-0001', { action: 'done', id: 'buy-tile' }, T0 + 1000));
	assert.equal(first.ok, true);
	assert.deepEqual(first.paid, { gold: STARTER_REWARDS.tile.gold, wood: STARTER_REWARDS.tile.wood });
	const after = m.ledgers.get('u1')!;
	assert.equal(after.granted.gold, STARTER_REWARDS.tile.gold);
	assert.equal(after.granted.wood, STARTER_REWARDS.tile.wood);
	assert.deepEqual(after.stats.tutorial.done, ['buy-tile']);

	const replay = ok(await tutorialStep(m.deps, 'u1', 'tutorial-key-0001', { action: 'done', id: 'buy-tile' }, T0 + 2000));
	assert.deepEqual(replay, first, 'the same key replays the stored answer');
	const again = ok(await tutorialStep(m.deps, 'u1', 'tutorial-key-0002', { action: 'done', id: 'buy-tile' }, T0 + 3000));
	assert.equal(again.paid, undefined, 'another key for a step that is done pays nothing');
	assert.equal(m.ledgers.get('u1')!.granted.gold, STARTER_REWARDS.tile.gold);
});

test('a bundle step needs proof in the last accepted save', async () => {
	const m = await player(0);
	const early = ok(await tutorialStep(m.deps, 'u1', 'tutorial-key-0003', { action: 'done', id: 'buy-tile' }, T0 + 1000));
	assert.equal(early.ok, false);
	assert.equal(early.reason, 'not_yet');
	assert.equal(m.ledgers.get('u1')!.granted.gold, 0);
	const castle = ok(await tutorialStep(m.deps, 'u1', 'tutorial-key-0004', { action: 'done', id: 'castle-upgrade' }, T0 + 2000));
	assert.equal(castle.reason, 'not_yet', 'no castle upgrade is running in that save');
});

test('the last step hands over the potions through the bag', async () => {
	const m = await player(8, 5000);
	const out = ok(await tutorialStep(m.deps, 'u1', 'tutorial-key-0005', { action: 'done', id: 'stat-point' }, T0 + 1000));
	assert.equal(out.ok, true);
	const bag = m.ledgers.get('u1')!.inv!.bag;
	const potions = bag.reduce((sum, slot) => sum + (slot && 'id' in slot && slot.id === 'potion_minor' ? slot.qty : 0), 0);
	assert.ok(potions >= 3, `three minor potions arrived (bag holds ${potions})`);
	const twice = ok(await tutorialStep(m.deps, 'u1', 'tutorial-key-0006', { action: 'done', id: 'stat-point' }, T0 + 2000));
	assert.equal(twice.paid, undefined);
});

test('intro, lessons and skip are recorded; unknown ids are refused; a skipped player is paid nothing more', async () => {
	const m = await player(8);
	assert.equal(ok(await tutorialStep(m.deps, 'u1', 'tutorial-key-0007', { action: 'done', id: 'intro' }, T0 + 1000)).ok, true);
	assert.equal(ok(await tutorialStep(m.deps, 'u1', 'tutorial-key-0008', { action: 'lesson', id: 'res-wood' }, T0 + 2000)).progress.lessons[0], 'res-wood');
	assert.equal(ok(await tutorialStep(m.deps, 'u1', 'tutorial-key-0009', { action: 'done', id: 'nope' }, T0 + 3000)).reason, 'unknown');
	assert.equal(ok(await tutorialStep(m.deps, 'u1', 'tutorial-key-0010', { action: 'lesson', id: 'buy-tile' }, T0 + 4000)).reason, 'unknown');
	const skipped = ok(await tutorialStep(m.deps, 'u1', 'tutorial-key-0011', { action: 'skip' }, T0 + 5000));
	assert.equal(skipped.progress.skipped, true);
	const late = ok(await tutorialStep(m.deps, 'u1', 'tutorial-key-0012', { action: 'done', id: 'buy-tile' }, T0 + 6000));
	assert.equal(late.paid, undefined);
	assert.equal(m.ledgers.get('u1')!.granted.gold, 0);
});

test('sync reads the progress without writing', async () => {
	const m = await player(8);
	ok(await tutorialStep(m.deps, 'u1', null, { action: 'sync' }, T0 + 500)); // the first request seeds the ledger
	const before = m.ledgers.get('u1')!.ver;
	const out = ok(await tutorialStep(m.deps, 'u1', null, { action: 'sync' }, T0 + 1000));
	assert.deepEqual(out.progress, { done: [], lessons: [], skipped: false });
	assert.equal(m.ledgers.get('u1')!.ver, before);
});

test('progress reads back safely from the stored column', () => {
	assert.deepEqual(readProgress(null), { done: [], lessons: [], skipped: false });
	assert.deepEqual(readProgress({ done: ['intro', 'buy-tile', 'buy-tile', 'gone-step', 7], lessons: ['res-wood', 'x'], skipped: 'yes' }), {
		done: ['intro', 'buy-tile'],
		lessons: ['res-wood'],
		skipped: false,
	});
	const stats = readStats({ chests: 2, tutorial: { done: ['intro'], skipped: true } });
	assert.deepEqual(stats.tutorial, { done: ['intro'], lessons: [], skipped: true });
	assert.equal(isEmptyStats(emptyStats()), true);
	assert.equal(isEmptyStats(stats), false);
	assert.equal(isEmptyStats({ ...emptyStats(), tutorial: { done: ['intro'], lessons: [], skipped: false } }), false);
});

test('meeting the farm pays the food for the first chicken once, with no proof needed', async () => {
	const m = await player(0);
	const first = ok(await tutorialStep(m.deps, 'u1', 'tutorial-key-farm-1', { action: 'done', id: 'farm-intro' }, T0 + 1000));
	assert.equal(first.ok, true);
	assert.deepEqual(first.paid, { food: STARTER_REWARDS.farm.food });
	assert.equal(m.ledgers.get('u1')!.granted.food, STARTER_REWARDS.farm.food);
	const again = ok(await tutorialStep(m.deps, 'u1', 'tutorial-key-farm-2', { action: 'done', id: 'farm-intro' }, T0 + 2000));
	assert.equal(again.paid, undefined);
	assert.equal(m.ledgers.get('u1')!.granted.food, STARTER_REWARDS.farm.food);
});
