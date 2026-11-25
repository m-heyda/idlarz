import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, store } from '../helpers';
import { memoryLedgers } from '../builders';
import { pickPersisted, type PersistedGame } from '../../src/lib/sanitizeSave';
import { encodeSave } from '../../src/lib/saveFormat';
import { acceptSave, type SaveRepo, type StatsRow, type StoredSave, type WorldPart } from '../../src/lib/cloudSave/pipeline';
import type { ServiceDeps } from '../../src/lib/offline/service';
import { inventoryStep, type Online } from '../../src/lib/offline/online';
import { bagCountOf, parseOp } from '../../src/lib/offline/inventory';
import { emptyBag } from '../../src/lib/inventory';
import { monsterChestItemId, MONSTER_CHEST, MONSTER_CHEST_TIERS } from '../../src/config/monsterChests';
import { monsterChestTierOf } from '../../src/catalog/items/chests';
import { rollMonsterChest } from '../../src/lib/offline/openChest';
import { mulberry32 } from '../../src/lib/rng';
import { zeroResources } from '../../src/catalog/resourceKeys';
import type { BagSlot } from '../../src/types/game';

// IDL-163: opening a monster chest on the server. One chest leaves the bag, the roll is sealed (a replayed request never rolls again) and what it paid is recorded as granted.

const memory = () => {
	const rows = new Map<string, StoredSave>();
	const worlds = new Map<string, WorldPart>();
	const stats = new Map<string, StatsRow>();
	const saves: SaveRepo = {
		load: async (id, options) => {
			const row = rows.get(id);
			if (!row) return null;
			return options?.world ? { ...row, world: worlds.get(id) } : { ...row };
		},
		commit: async (id, baseRev, save, world, st) => {
			const current = rows.get(id);
			if (baseRev === 0 ? !!current : current?.rev !== baseRev) return false;
			rows.set(id, save);
			if (world) worlds.set(id, world);
			stats.set(id, st);
			return true;
		},
		archive: async () => undefined,
		pin: async () => undefined,
	};
	const { ledgers, ledgerRepo } = memoryLedgers();
	const deps: ServiceDeps = { saves, ledgers: ledgerRepo, secret: 'test-secret-test-secret' };
	return { saves, ledgerRepo, ledgers, rows, deps };
};

const game = (): PersistedGame => {
	api().resetGame();
	growTo(60);
	api().tick(1000);
	store.setState({ playSeconds: 1000, resources: { ...api().resources, gold: 100, wood: 0, stone: 0, coal: 0, food: 0, hide: 0 } } as never);
	return structuredClone(pickPersisted(api()));
};
const T0 = 1_800_000_000_000;
const MIN = 60_000;
const ok = <T>(out: Online<T>): T => {
	assert.equal(out.kind, 'ok', JSON.stringify(out));
	return (out as { kind: 'ok'; value: T }).value;
};
const player = async () => {
	const m = memory();
	await acceptSave(m.saves, 'u1', 'Zoë', encodeSave(game()), 0, T0, false, m.ledgerRepo);
	return { m, id: 'u1', inv: () => m.ledgers.get('u1')!.inv! };
};
const bag = (...slots: BagSlot[]): BagSlot[] => {
	const out = emptyBag();
	slots.forEach((slot, i) => (out[i] = slot));
	return out;
};
const withBag = (p: Awaited<ReturnType<typeof player>>, ...slots: BagSlot[]) =>
	p.m.ledgers.set(p.id, { ...p.m.ledgers.get(p.id)!, inv: { ...p.inv(), bag: bag(...slots) } });
let keyNo = 0;
const key = () => `open-key-${String(++keyNo).padStart(6, '0')}`;

test('parseOp reads open and refuses a bad index', () => {
	assert.deepEqual(parseOp({ action: 'open', index: 3 }), { action: 'open', index: 3 });
	assert.equal(parseOp({ action: 'open' }), null);
	assert.equal(parseOp({ action: 'open', index: 1.5 }), null);
});

test('open: one chest leaves the bag, what it paid is recorded as granted, and a replayed key opens once', async () => {
	const p = await player();
	withBag(p, { id: monsterChestItemId('mossy'), qty: 3 });
	const sameKey = key();
	const parsed = parseOp({ action: 'open', index: 0 })!;
	const before = p.m.ledgers.get(p.id)!;
	const first = ok(await inventoryStep(p.m.deps, p.id, sameKey, parsed, T0 + MIN));
	assert.equal(first.ok, true);
	assert.equal(first.opened?.tier, 'mossy');
	assert.equal(bagCountOf(p.inv(), monsterChestItemId('mossy')), 2, 'one chest consumed');
	const paid = first.opened!.grant.resources;
	const total = Object.entries(paid).reduce((sum, [, v]) => sum + v, 0);
	assert.ok(total > 0, 'it paid something');
	const after = p.m.ledgers.get(p.id)!;
	for (const [k, v] of Object.entries(paid))
		assert.equal((after.granted as Record<string, number>)[k] ?? 0, ((before.granted as Record<string, number>)[k] ?? 0) + v, `${k} is in granted`);
	const replay = ok(await inventoryStep(p.m.deps, p.id, sameKey, parsed, T0 + 2 * MIN));
	assert.deepEqual(replay, first, 'the stored answer comes back');
	assert.equal(bagCountOf(p.inv(), monsterChestItemId('mossy')), 2, 'opened once');
});

test('open: a slot that is not a chest is refused and nothing changes', async () => {
	const p = await player();
	withBag(p, { id: 'potion_minor', qty: 2 });
	const refused = ok(await inventoryStep(p.m.deps, p.id, key(), parseOp({ action: 'open', index: 0 })!, T0 + MIN));
	assert.equal(refused.ok, false);
	assert.equal(refused.message, 'That is not a chest');
	assert.equal(bagCountOf(p.inv(), 'potion_minor'), 2);
	const empty = ok(await inventoryStep(p.m.deps, p.id, key(), parseOp({ action: 'open', index: 5 })!, T0 + MIN));
	assert.equal(empty.ok, false);
});

test('the roll is sealed on the server state, not on the request: the same ledger rolls the same whatever key asks, and the chests of one run differ', async () => {
	const p = await player();
	withBag(p, { id: monsterChestItemId('wooden'), qty: 8 });
	const snapshot = structuredClone(p.m.ledgers.get(p.id)!);
	const first = ok(await inventoryStep(p.m.deps, p.id, key(), parseOp({ action: 'open', index: 0 })!, T0 + MIN));
	// put the ledger back and ask again with another key: the roll is the same, so a reload cannot reroll for a better chest
	p.m.ledgers.set(p.id, structuredClone(snapshot));
	const again = ok(await inventoryStep(p.m.deps, p.id, key(), parseOp({ action: 'open', index: 0 })!, T0 + MIN));
	assert.deepEqual(again.opened?.grant.resources, first.opened?.grant.resources);
	// but the next chest of the same run is a new roll (the inventory version moved on)
	const rolls = [JSON.stringify(first.opened?.grant.resources), JSON.stringify(again.opened?.grant.resources)];
	for (let i = 0; i < 5; i++) {
		const next = ok(await inventoryStep(p.m.deps, p.id, key(), parseOp({ action: 'open', index: 0 })!, T0 + MIN + i));
		rolls.push(JSON.stringify(next.opened?.grant.resources));
	}
	assert.ok(new Set(rolls).size > 1, 'the chests of one run are not all the same');
});

test("rollMonsterChest: pays one kind of the player's income, with the floors, and a potion half the time", () => {
	const rates = { ...zeroResources(), gold: 10, wood: 4, stone: 4, coal: 4, food: 4, xp: 0.001 };
	const rng = mulberry32(7);
	const seen = { gold: 0, resource: 0, xp: 0, potion: 0 };
	const N = 4000;
	for (let i = 0; i < N; i++) {
		const { resources, potion } = rollMonsterChest('coral', { rates, xpGainPct: 10 }, rng);
		const paid = Object.entries(resources).filter(([, v]) => v > 0);
		assert.equal(paid.length, 1, 'exactly one kind');
		const [kind, amount] = paid[0];
		const [lo, hi] = MONSTER_CHEST.tiers.coral.minutes;
		if (kind === 'gold') {
			seen.gold++;
			assert.ok(amount >= Math.floor(10 * lo * 60) && amount <= Math.floor(10 * hi * 60));
		} else if (kind === 'xp') {
			seen.xp++;
			assert.ok(amount >= MONSTER_CHEST.floor.xp, 'the XP floor');
		} else {
			seen.resource++;
			assert.ok(amount >= Math.floor(4 * lo * 60) && amount <= Math.floor(4 * hi * 60));
		}
		if (potion) {
			seen.potion++;
			assert.equal(potion.id, MONSTER_CHEST.tiers.coral.potion);
		}
	}
	const share = (n: number) => n / N;
	assert.ok(
		Math.abs(share(seen.gold) - 0.45) < 0.04 && Math.abs(share(seen.resource) - 0.3) < 0.04 && Math.abs(share(seen.xp) - 0.25) < 0.04,
		JSON.stringify(seen),
	);
	assert.ok(Math.abs(share(seen.potion) - MONSTER_CHEST.potionChance) < 0.04);
});

test('every tier is a chest item the bag can name', () => {
	for (const tier of MONSTER_CHEST_TIERS) assert.equal(monsterChestTierOf(monsterChestItemId(tier)), tier);
	assert.equal(monsterChestTierOf('potion_minor'), undefined);
	assert.equal(monsterChestTierOf(undefined), undefined);
});
