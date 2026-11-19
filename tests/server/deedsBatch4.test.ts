import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, DEEDS, deedById } from '../../src/catalog/achievements';
import { conditionProgress, conditionHolds, TOTAL_DEED_POINTS, type DeedFacts } from '../../src/lib/deeds';
import { CURIOSITIES, RANK_CURIOSITIES, recordCuriosity, recordRankPlace } from '../../src/lib/offline/curiosity';
import { craftedGearAdded } from '../../src/lib/offline/craft';
import { newLedger } from '../../src/lib/offline/ledger';
import { emptyStats, isEmptyStats, readStats, recordCraftedRare, statsToJson } from '../../src/lib/offline/stats';
import type { Inventory } from '../../src/lib/offline/types';
import type { ItemInstance } from '../../src/types/game';

// IDL-321: the deeds of batch 4 and the counters they read.

const facts = (over: Partial<DeedFacts['stats']> = {}, rest: Partial<Omit<DeedFacts, 'stats'>> = {}): DeedFacts => ({
	stats: { ...emptyStats(), ...over },
	castleLevel: 1,
	rebirths: 0,
	buildings: 0,
	...rest,
});

test('lost fights add up over every monster', () => {
	const when = { kind: 'deaths', min: 10 } as const;
	assert.equal(conditionHolds(when, facts({ deaths: { thistleBoar: 6, winterWyrm: 3 } })), false);
	assert.equal(conditionHolds(when, facts({ deaths: { thistleBoar: 6, winterWyrm: 4 } })), true);
});

test('the crafting level, the Embers and the income of a resource come from their own numbers', () => {
	assert.deepEqual(conditionProgress({ kind: 'craftLevel', min: 20 }, facts({}, { craftLevel: 12 })), { cur: 12, goal: 20 });
	assert.deepEqual(conditionProgress({ kind: 'embers', min: 500 }, facts({}, { embers: 640 })), { cur: 640, goal: 500 });
	assert.deepEqual(conditionProgress({ kind: 'income', resource: 'wood', min: 10_000 }, facts({ income: { wood: 4_000, stone: 99 } })), {
		cur: 4_000,
		goal: 10_000,
	});
	assert.equal(conditionProgress({ kind: 'income', resource: 'herbs', min: 100 }, facts()).cur, 0, 'a resource never earned reads 0');
});

test('crafted rarity counts the rarity asked and every better one; worn rarity reads the kit', () => {
	const stats = { craftedRare: { epic: 3, legendary: 2, common: 40 } };
	assert.equal(conditionProgress({ kind: 'craftedRarity', rarity: 'epic', min: 10 }, facts(stats)).cur, 5, 'epic or better');
	assert.equal(conditionProgress({ kind: 'craftedRarity', rarity: 'legendary', min: 5 }, facts(stats)).cur, 2);
	const kit = { uncommon: 14, epic: 6, legendary: 2 };
	assert.equal(conditionProgress({ kind: 'wornRarity', rarity: 'epic', min: 4 }, facts({}, { kit })).cur, 6);
	assert.equal(conditionHolds({ kind: 'wornRarity', rarity: 'legendary', min: 3 }, facts({}, { kit })), false);
});

const gear = (rarity: string, crafted?: true): ItemInstance => ({ base: 'x', level: 1, rarity, quality: 50, affixes: [], ...(crafted ? { crafted } : {}) });
const bagOf = (...items: ItemInstance[]) => ({ bag: items.map((item) => ({ item })) }) as unknown as Inventory;

test('a delivery counts the crafted pieces it added to the bag, by rarity, and nothing else', () => {
	const before = bagOf(gear('epic', true), gear('legendary'));
	const after = bagOf(gear('epic', true), gear('legendary'), gear('epic', true), gear('legendary', true), gear('rare', true));
	assert.deepEqual(craftedGearAdded(before, after), { epic: 1, legendary: 1, rare: 1 }, 'a dropped legendary is not a crafted one');
	assert.deepEqual(craftedGearAdded(after, after), {});
	const stats = recordCraftedRare(emptyStats(), { epic: 1, legendary: 1 });
	assert.deepEqual(stats.craftedRare, { epic: 1, legendary: 1 });
	assert.equal(recordCraftedRare(stats, {}), stats, 'nothing added: the same counters come back');
});

test('the new counters stay out of the stored form while empty and read back tolerantly', () => {
	assert.equal('craftedRare' in statsToJson(emptyStats()), false);
	assert.equal(isEmptyStats(emptyStats()), true);
	const counted = recordCraftedRare(emptyStats(), { legendary: 2 });
	assert.equal(isEmptyStats(counted), false);
	assert.deepEqual(readStats(statsToJson(counted)).craftedRare, { legendary: 2 });
	assert.deepEqual(readStats({ craftedRare: 'nope' }).craftedRare, {}, 'malformed reads as none');
});

test('podium places are recorded by the server only: the visit allowlist refuses them', () => {
	const ledger = newLedger(1_700_000_000_000);
	for (const id of RANK_CURIOSITIES) assert.equal(recordCuriosity(ledger, id), ledger, `${id} is not accepted from the browser`);
	const third = recordRankPlace(ledger, 3);
	assert.deepEqual(third.stats.curiosity, ['rank_3']);
	assert.equal(recordRankPlace(third, 3), third, 'once');
	assert.equal(recordRankPlace(ledger, 4), ledger, 'only the top three count');
	assert.equal(recordRankPlace(ledger, 0), ledger);
});

test('the browser may report the secret events, each once', () => {
	const ledger = newLedger(1_700_000_000_000);
	for (const id of ['window_min', 'map_zoom_max', 'map_zoom_min', 'boss_window', 'castle_skin', 'gambling_empty', 'dock_shuffle', 'night_owl', 'konami']) {
		assert.ok(CURIOSITIES.includes(id), id);
		const once = recordCuriosity(ledger, id);
		assert.deepEqual(once.stats.curiosity, [id]);
		assert.equal(recordCuriosity(once, id), once);
	}
	assert.equal(recordCuriosity(ledger, 'made_up'), ledger);
});

test('every curiosity a deed waits for is one the server can record', () => {
	const known = new Set([...CURIOSITIES, ...RANK_CURIOSITIES]);
	for (const a of ACHIEVEMENTS) if (a.when.kind === 'curiosity') assert.ok(known.has(a.when.id), `${a.id} waits for ${a.when.id}`);
});

test('the ladders reach big numbers and the top milestone is reachable', () => {
	const goal = (id: string) => conditionProgress(ACHIEVEMENTS.find((a) => a.id === id)!.when, facts()).goal;
	assert.ok(goal('income_gold_10000000000000') >= 1e13);
	assert.ok(goal('hoarder_1000000000000') >= 1e12);
	assert.ok(deedById('golden_touch')!.tiers.length >= 5);
	assert.ok(deedById('bossbane')!.tiers.length >= 6);
	assert.ok(TOTAL_DEED_POINTS > 6000, 'the top milestone (6,000) can be reached');
});

test('every deed has a unique id, a title, lore and at least one tier, and every tier id exists once', () => {
	const seen = new Set<string>();
	for (const d of DEEDS) {
		assert.ok(d.title && d.lore && d.how && d.tiers.length > 0, d.id);
		for (const id of d.tiers) {
			assert.equal(seen.has(id), false, `${id} belongs to one deed`);
			seen.add(id);
		}
	}
	assert.equal(seen.size, ACHIEVEMENTS.length, 'every achievement is a tier of a deed');
});
