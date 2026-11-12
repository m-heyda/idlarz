import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, DEEDS, achievementById } from '../../src/catalog/achievements';
import { BATCH2_ACHIEVEMENTS, BATCH2_DEEDS } from '../../src/catalog/achievementsBatch2';
import { conditionHolds, conditionProgress, type DeedFacts } from '../../src/lib/deeds';
import { emptyStats } from '../../src/lib/offline/stats';
import { factsOf } from '../../src/lib/offline/achievements';
import { newLedger } from '../../src/lib/offline/ledger';
import { recordCuriosity } from '../../src/lib/offline/curiosity';
import { readWorldFacts, worldFacts } from '../../src/lib/worldFacts';
import { setTile, EMPTY_WORLD } from '../../src/utils/world';
import { plainItem } from '../../src/lib/itemInstance';
import type { Tile } from '../../src/types/game';

// IDL-305: the second batch of deeds: land, gear, hero, farm, buildings, bosses and one secret.

const tile = (biome: string, extra: Partial<Tile> = {}): Tile => ({ biome, isOwned: true, ...extra }) as Tile;
const facts = (over: Partial<DeedFacts> = {}): DeedFacts => ({ stats: emptyStats(), castleLevel: 1, rebirths: 0, buildings: 0, ...over });

test('batch 2 is appended after the first batch, every tier belongs to one deed, ids are unique, badges exist', async () => {
	const ids = ACHIEVEMENTS.map((a) => a.id);
	assert.equal(new Set(ids).size, ids.length);
	assert.deepEqual(
		ids.slice(-BATCH2_ACHIEVEMENTS.length),
		BATCH2_ACHIEVEMENTS.map((a) => a.id),
	);
	assert.ok(BATCH2_ACHIEVEMENTS.length > 70);
	for (const a of BATCH2_ACHIEVEMENTS) assert.equal(DEEDS.filter((d) => d.tiers.includes(a.id)).length, 1, a.id);
	for (const d of BATCH2_DEEDS) {
		assert.ok(d.category && d.tags.length > 0, `${d.id} has a category and tags`);
		for (const id of d.tiers) assert.ok(achievementById(id), id);
	}
	const { existsSync } = await import('node:fs');
	for (const a of BATCH2_ACHIEVEMENTS) assert.ok(existsSync(`public/pixel/new_assets/achievements/${a.badge}.png`), `${a.id}: ${a.badge}`);
	assert.ok(
		BATCH2_ACHIEVEMENTS.every((a) => a.id.length <= 40),
		'ids fit the ledger reader',
	);
});

test('worldFacts: biomes owned, the largest connected group per biome, animals and buildings', () => {
	let world = EMPTY_WORLD;
	// five forest tiles in a row, one separate forest tile, two plains tiles side by side, the castle
	for (let x = 1; x <= 5; x++) world = setTile(world, x, 0, tile('forest'));
	world = setTile(world, 9, 9, tile('forest'));
	world = setTile(world, 0, 5, tile('plains'));
	world = setTile(world, 1, 5, tile('plains'));
	world = setTile(world, 0, 0, tile('castle'));
	const f = worldFacts(world, { chicken: 12, cow: 0 });
	assert.deepEqual(f.biomes, ['forest', 'plains']);
	assert.deepEqual(f.largestGroup, { forest: 5, plains: 2 });
	assert.deepEqual(f.animals, { chicken: 12 });
	assert.equal(f.buildingsBuilt, 0);
	assert.deepEqual(readWorldFacts(JSON.parse(JSON.stringify(f))), f);
	assert.equal(readWorldFacts(null), null);
	assert.deepEqual(readWorldFacts({ largestGroup: { forest: -3, hills: 4 }, biomes: [1, 'x'] })?.largestGroup, { hills: 4 });
});

test('land deeds read the facts: a new biome, a cluster, animals in total and by kind', () => {
	const world = {
		biomes: ['forest'],
		largestGroup: { forest: 13 },
		animals: { chicken: 30, pig: 25 },
		buildingsBuilt: 4,
		buildingsMaxed: 1,
		buildingsByBiome: { forest: 4 },
	};
	const f = facts({ world });
	assert.equal(conditionHolds({ kind: 'biome', biome: 'forest' }, f), true);
	assert.equal(conditionHolds({ kind: 'biome', biome: 'jungle' }, f), false);
	assert.equal(conditionHolds({ kind: 'cluster', biome: 'forest', min: 12 }, f), true);
	assert.equal(conditionHolds({ kind: 'cluster', biome: 'forest', min: 20 }, f), false);
	assert.equal(conditionProgress({ kind: 'animals', min: 50 }, f).cur, 55);
	assert.equal(conditionProgress({ kind: 'animals', min: 10, animal: 'pig' }, f).cur, 25);
	assert.equal(conditionHolds({ kind: 'buildingsIn', biome: 'forest', min: 3 }, f), true);
	assert.equal(conditionHolds({ kind: 'buildingsMaxed', min: 5 }, f), false);
	assert.equal(conditionHolds({ kind: 'biome', biome: 'forest' }, facts()), false, 'a row from before has no land facts: nothing is earned');
});

test('hero and gear facts come from the server record: attributes, streak, worn level and a full kit', () => {
	const ledger = newLedger(1);
	const slots = ['head', 'shoulder', 'chest', 'hands', 'legs', 'feet', 'neck', 'cape', 'ring1', 'ring2', 'charm', 'belt', 'mainHand', 'offHand'];
	const equipment = Object.fromEntries(slots.map((s) => [s, { ...plainItem('steel_helm'), rarity: 'epic', level: 40 }]));
	const withGear = {
		...ledger,
		attrs: { ver: 1, alloc: { strength: 0, dexterity: 0, intelligence: 0, vitality: 0, charisma: 55 }, freeUsed: false },
		gemShop: { ...ledger.gemShop, daily: { day: 5, streak: 3 } },
		inv: { ...ledger.inv!, equipment },
	} as typeof ledger;
	const f = factsOf(withGear, { castleLevel: 1, rebirths: 0, derived: {} } as never);
	assert.equal(conditionHolds({ kind: 'attribute', stat: 'charisma', min: 50 }, f), true);
	assert.equal(conditionHolds({ kind: 'attribute', stat: 'strength', min: 50 }, f), false);
	assert.equal(conditionHolds({ kind: 'streak', min: 3 }, f), true);
	assert.equal(conditionHolds({ kind: 'streak', min: 7 }, f), false);
	assert.equal(conditionHolds({ kind: 'wornLevel', min: 35 }, f), true);
	assert.equal(conditionHolds({ kind: 'kit', rarity: 'uncommon' }, f), true);
	assert.equal(conditionHolds({ kind: 'kit', rarity: 'epic' }, f), true);
	assert.equal(conditionHolds({ kind: 'kit', rarity: 'legendary' }, f), false);
	const partial = { ...withGear, inv: { ...withGear.inv!, equipment: { head: equipment.head } } } as typeof ledger;
	assert.equal(
		conditionHolds({ kind: 'kit', rarity: 'epic' }, factsOf(partial, { castleLevel: 1, rebirths: 0, derived: {} } as never)),
		false,
		'one slot is not a kit',
	);
});

test('respecs, bosses and the secret read their counters; the secret is recorded once and only from the allowlist', () => {
	assert.equal(conditionHolds({ kind: 'respecs', min: 1 }, facts({ stats: { ...emptyStats(), respecs: 1 } })), true);
	assert.equal(conditionHolds({ kind: 'bosses', min: 5 }, facts({ stats: { ...emptyStats(), bosses: 4 } })), false);
	const ledger = newLedger(1);
	const seen = recordCuriosity(ledger, 'gambling_empty');
	assert.deepEqual(seen.stats.curiosity, ['gambling_empty']);
	assert.equal(recordCuriosity(seen, 'gambling_empty'), seen, 'once');
	assert.equal(recordCuriosity(ledger, 'made_up'), ledger, 'not on the list');
	assert.equal(conditionHolds({ kind: 'curiosity', id: 'gambling_empty' }, facts({ stats: seen.stats })), true);
});
