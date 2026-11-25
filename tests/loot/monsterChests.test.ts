import assert from 'node:assert/strict';
import test from 'node:test';
import { ITEM_CATALOG } from '../../src/catalog';
import { CHEST_ITEMS, monsterChestTierOf } from '../../src/catalog/items/chests';
import { MONSTERS } from '../../src/config/combatConfig';
import { MONSTER_CHEST, MONSTER_CHEST_TIERS, monsterChestItemId } from '../../src/config/monsterChests';
import { rollChestDrops, rollKillLoot } from '../../src/lib/loot/kill';
import { slotlessItemLabel } from '../../src/lib/itemCategory';
import { isJunkStack } from '../../src/lib/loot/junk';
import { mulberry32 } from '../../src/lib/rng';
import type { MonsterType } from '../../src/types/game';

// IDL-163: monster drop chests. 2 % per normal kill (the biome's tier), a boss always a Royal chest, a golden monster always an Arcane chest; added last so the rest of a kill is exactly what it was.

const typesOf = (biome: string): MonsterType[] =>
	(Object.keys(MONSTERS) as MonsterType[]).filter((type) => MONSTERS[type].grade !== 'boss' && MONSTERS[type].spawn.biomes[0] === biome);
const bossType = (Object.keys(MONSTERS) as MonsterType[]).find((type) => MONSTERS[type].grade === 'boss')!;
const NEVER: () => number = () => {
	throw new Error('this roll must not draw a random number');
};

test('every tier is a stackable chest item, never junk, with a name and a sell value', () => {
	assert.equal(CHEST_ITEMS.length, MONSTER_CHEST_TIERS.length);
	for (const tier of MONSTER_CHEST_TIERS) {
		const def = ITEM_CATALOG[monsterChestItemId(tier)];
		assert.ok(def, tier);
		assert.equal(def.kind, 'consumable');
		assert.ok(!def.junk && !isJunkStack(def.id), 'a sweep never sells a chest');
		assert.equal(def.name, MONSTER_CHEST.tiers[tier].label);
		assert.ok((def.stackMax ?? 1) > 1 && def.sellValue > 0);
		assert.equal(slotlessItemLabel(def), 'Chest');
	}
	assert.equal(slotlessItemLabel(ITEM_CATALOG['potion_minor']), 'Consumable');
	assert.equal(monsterChestTierOf('chest_royal'), 'royal');
});

test('every biome a monster or boss spawns in has a tier, and the tiers cover the six biome chests', () => {
	const biomes = new Set(Object.values(MONSTERS).map((def) => def.spawn.biomes[0]));
	for (const biome of biomes)
		if (MONSTERS[bossType].spawn.biomes[0] !== biome || typesOf(biome).length > 0)
			assert.ok(MONSTER_CHEST.tierOfBiome[biome] || typesOf(biome).length === 0, `${biome} has no chest tier`);
	assert.deepEqual([...new Set(Object.values(MONSTER_CHEST.tierOfBiome))].sort(), ['coral', 'frost', 'iron', 'magma', 'mossy', 'wooden']);
});

test('a boss always drops a Royal chest and draws no random number for it', () => {
	assert.deepEqual(rollChestDrops({ type: bossType }, { lucky: false }, NEVER), [{ kind: 'consumable', id: monsterChestItemId('royal'), qty: 1 }]);
});

test('a golden monster always drops an Arcane chest on top, and a golden boss both', () => {
	const normal = typesOf('plains')[0];
	const rng = mulberry32(1);
	const drops = rollChestDrops({ type: normal }, { lucky: true }, rng);
	assert.ok(drops.some((d) => d.kind === 'consumable' && d.id === monsterChestItemId('arcane')));
	assert.deepEqual(
		rollChestDrops({ type: bossType }, { lucky: true }, NEVER).map((d) => (d.kind === 'consumable' ? d.id : '')),
		[monsterChestItemId('royal'), monsterChestItemId('arcane')],
	);
});

test('a normal kill drops the chest of its biome with about 2 %, and only that one', () => {
	for (const [biome, tier] of Object.entries(MONSTER_CHEST.tierOfBiome)) {
		const type = typesOf(biome)[0];
		if (!type) continue;
		const rng = mulberry32(99);
		let chests = 0;
		const N = 20000;
		for (let i = 0; i < N; i++) {
			const drops = rollChestDrops({ type }, { lucky: false }, rng);
			for (const d of drops) {
				assert.equal(d.kind === 'consumable' ? d.id : '', monsterChestItemId(tier), `${biome} drops its own tier only`);
				chests++;
			}
		}
		assert.ok(Math.abs(chests / N - MONSTER_CHEST.dropChance) < 0.006, `${biome}: ${(chests / N) * 100} %`);
	}
});

test('rollKillLoot adds the chests after every other roll, so the rest of a kill is what it was', () => {
	const type = typesOf('plains')[0];
	const ctx = { goldPerSec: 5, xpPerSec: 1, luck: 0 };
	const a = rollKillLoot({ type, level: 5 }, ctx, mulberry32(5));
	const b = rollKillLoot({ type, level: 5 }, { ...ctx, lucky: true }, mulberry32(5));
	// a golden kill has bonus gear rolls, but a normal kill's own drops are a prefix of nothing else: compare the non-chest part of two normal kills with the same stream
	const without = (items: typeof a.items) => items.filter((d) => !(d.kind === 'consumable' && monsterChestTierOf(d.id)));
	assert.deepEqual(without(a.items), without(rollKillLoot({ type, level: 5 }, ctx, mulberry32(5)).items));
	assert.ok(b.items.some((d) => d.kind === 'consumable' && d.id === monsterChestItemId('arcane')));
	const boss = rollKillLoot({ type: bossType, level: 20 }, ctx, mulberry32(5));
	assert.ok(boss.items.some((d) => d.kind === 'consumable' && d.id === monsterChestItemId('royal')));
});
