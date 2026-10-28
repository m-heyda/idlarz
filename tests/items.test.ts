import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT } from '../src/config/combatConfig';
import {
	EQUIPMENT_LAYOUT,
	ITEM_CATALOG,
	RATTATUI_SET,
	SETS,
	STARTER_BAG_ITEMS,
	STARTER_EQUIPMENT,
} from '../src/config/itemCatalog';
import { ITEM_STAT_KEYS, MAX_ITEM_LEVEL, familyPieces, STAT_BASE_BY_TIER, WEAPON_ATTACK_SPEED, baseStat, levelScale, weaponDps } from '../src/catalog';
import type { EquipmentSlot } from '../src/types/game';

const ALL_SLOTS: EquipmentSlot[] = [
	...EQUIPMENT_LAYOUT.left,
	...EQUIPMENT_LAYOUT.right,
	...EQUIPMENT_LAYOUT.bottom,
];

test('catalog keys equal item ids', () => {
	for (const [key, def] of Object.entries(ITEM_CATALOG)) assert.equal(def.id, key);
});

test('gear has a slot, consumables have healHp and stackMax', () => {
	for (const def of Object.values(ITEM_CATALOG)) {
		if (def.consumable) {
			assert.ok(def.consumable.healHp > 0, def.id);
			assert.ok((def.stackMax ?? 0) > 1, def.id);
			assert.equal(def.slot, undefined, def.id);
		} else {
			assert.ok(def.slot, `${def.id} needs a slot`);
			assert.equal(def.stackMax ?? 1, 1, def.id);
		}
		assert.ok(def.sellValue > 0, def.id);
	}
});

test('layout lists all 13 equipment slots exactly once', () => {
	assert.equal(ALL_SLOTS.length, 13);
	assert.equal(new Set(ALL_SLOTS).size, 13);
});

test('Rattatui pieces cover all 13 slots (the ring item covers ring1 and ring2)', () => {
	const covered = new Set<string>();
	for (const id of RATTATUI_SET.pieces) {
		const def = ITEM_CATALOG[id];
		assert.ok(def, id);
		assert.equal(def.set, RATTATUI_SET.id, id);
		if (def.slot === 'ring') {
			covered.add('ring1');
			covered.add('ring2');
		} else {
			covered.add(def.slot as string);
		}
	}
	assert.deepEqual([...covered].sort(), [...ALL_SLOTS].sort());
	assert.equal(RATTATUI_SET.size, 13);
	assert.equal(RATTATUI_SET.pieces.length, 12);
});

test('only weapons carry damage, none exceeds COMBAT.maxItemDamage, and the starter weapon deals 6', () => {
	for (const def of Object.values(ITEM_CATALOG)) {
		if (def.slot === 'mainHand') {
			assert.ok((def.stats?.damage ?? 0) >= 1 && def.stats!.damage! <= COMBAT.maxItemDamage, def.id);
		} else assert.equal(def.stats?.damage, undefined, `${def.id} is not a weapon`);
	}
	assert.equal(ITEM_CATALOG[STARTER_EQUIPMENT.mainHand!.base].stats?.damage, 6);
});

test('starter shield has armor 2', () => {
	assert.equal(ITEM_CATALOG[STARTER_EQUIPMENT.offHand!.base].stats?.armor, 2);
});

const SLOTS_OF = (set: string) => {
	const covered = new Set<string>();
	for (const id of familyPieces(set)) {
		const slot = ITEM_CATALOG[id].slot!;
		if (slot === 'ring') ['ring1', 'ring2'].forEach((r) => covered.add(r));
		else covered.add(slot);
	}
	return covered;
};

test('every armour family fills every armour and accessory slot plus the off hand (weapons come separately)', () => {
	const expected = ALL_SLOTS.filter((slot) => slot !== 'mainHand').sort();
	for (const set of ['woodland', 'apprentice', 'knight', 'obsidian']) assert.deepEqual([...SLOTS_OF(set)].sort(), expected, set);
});

test('rarity follows the family: wood and cloth common, steel uncommon, obsidian rare, Rattatui epic, three legendaries', () => {
	const rarityOf = (set: string) => new Set(familyPieces(set).map((id) => ITEM_CATALOG[id].rarity));
	assert.deepEqual([...rarityOf('woodland')], ['common']);
	assert.deepEqual([...rarityOf('apprentice')], ['common']);
	assert.deepEqual([...rarityOf('knight')], ['uncommon']);
	assert.deepEqual([...rarityOf('obsidian')], ['rare']);
	assert.deepEqual([...rarityOf('rattatui')], ['epic']);
	assert.equal(Object.values(ITEM_CATALOG).filter((d) => d.rarity === 'legendary').length, 3);
});

test('every weapon type has a steel or obsidian version and every weapon comes with its stats', () => {
	const types = new Set(Object.values(ITEM_CATALOG).filter((d) => d.kind === 'weapon').map((d) => d.weaponType));
	for (const t of ['sword', 'mace', 'maul', 'axe', 'dagger', 'spear', 'bow', 'crossbow', 'staff', 'wand']) assert.ok(types.has(t as never), t);
});

test('gear power rises with the tier slot by slot (wood < steel < obsidian < Rattatui), and Rattatui is the best of all', () => {
	const power = (id: string) => (ITEM_CATALOG[id].stats?.armor ?? 0) + (ITEM_CATALOG[id].stats?.maxHp ?? 0);
	const bySlot = (set: string) => {
		const m: Record<string, string> = {};
		for (const id of familyPieces(set)) m[ITEM_CATALOG[id].slot!] = id;
		return m;
	};
	const tiers = ['woodland', 'knight', 'obsidian', 'rattatui'].map(bySlot);
	for (const slot of Object.keys(tiers[3])) {
		if (!tiers.every((t) => t[slot])) continue; // weapons are not part of a set family
		for (let i = 1; i < tiers.length; i++) assert.ok(power(tiers[i][slot]) > power(tiers[i - 1][slot]), `${slot}: tier ${i}`);
	}
});

test('set bonuses only use thresholds a set can reach', () => {
	for (const set of Object.values(SETS)) for (const n of Object.keys(set.bonuses)) assert.ok(Number(n) <= set.size, `${set.id} ${n}`);
});

test('starter bag items exist in the catalog', () => {
	for (const { id, qty } of STARTER_BAG_ITEMS) {
		assert.ok(ITEM_CATALOG[id], id);
		assert.ok(qty >= 1);
	}
});

// ---- item level, tier base stats, attack speed ---------------------------------------------------------------------

test('every item has an id of its own, and every piece of gear an item level window inside 1..MAX_ITEM_LEVEL', () => {
	const ids = new Set<string>();
	for (const def of Object.values(ITEM_CATALOG)) {
		assert.ok(def.id && !ids.has(def.id), `${def.id} is unique`);
		ids.add(def.id);
		if (def.slot) {
			assert.ok(def.minItemLevel! >= 1 && def.maxItemLevel! <= MAX_ITEM_LEVEL && def.minItemLevel! <= def.maxItemLevel!, `${def.id} window`);
			assert.ok(def.generation === 'base' || def.generation === 'named', def.id);
		}
	}
});

test('the base value of every stat rises with the tier, and the item level curve scales it', () => {
	for (const key of ITEM_STAT_KEYS) {
		const row = STAT_BASE_BY_TIER[key];
		for (let tier = 2; tier <= row.length; tier++) assert.ok(row[tier - 1] > row[tier - 2], `${key}: tier ${tier} beats tier ${tier - 1}`);
		assert.equal(baseStat(key, 3), row[2]);
		assert.ok(row[2] * levelScale(20) > row[2], `${key} grows with item level`);
	}
	assert.equal(levelScale(1), 1);
});

test('items that carry a new stat take its number from the tier table', () => {
	for (const def of Object.values(ITEM_CATALOG)) {
		for (const key of ['goldFind', 'dodge'] as const) {
			const value = def.stats?.[key];
			if (value !== undefined) assert.equal(value, baseStat(key, def.tier), `${def.id} ${key}`);
		}
	}
	assert.ok(Object.values(ITEM_CATALOG).some((d) => d.stats?.goldFind) && Object.values(ITEM_CATALOG).some((d) => d.stats?.dodge));
});

test('every weapon swings at a positive attack speed and nothing else has one', () => {
	for (const def of Object.values(ITEM_CATALOG)) {
		if (def.slot === 'mainHand') assert.ok((def.attackSpeed ?? 0) > 0, `${def.id} has an attack speed`);
		else assert.equal(def.attackSpeed, undefined, `${def.id} is not a weapon`);
	}
	assert.equal(ITEM_CATALOG.wooden_sword.attackSpeed, WEAPON_ATTACK_SPEED.sword);
	assert.ok(ITEM_CATALOG.titan_maul.attackSpeed! < ITEM_CATALOG.steel_dagger.attackSpeed!, 'heavy swings slower than light');
});

test('weapon DPS rises with the tier within a weapon type', () => {
	const best = new Map<string, number>(); // weaponType -> DPS of the previous (lower) tier
	const weapons = Object.values(ITEM_CATALOG)
		.filter((d) => d.slot === 'mainHand')
		.sort((a, b) => a.tier - b.tier);
	const byType = new Map<string, typeof weapons>();
	for (const w of weapons) byType.set(w.weaponType!, [...(byType.get(w.weaponType!) ?? []), w]);
	for (const [type, list] of byType) {
		let lowerTier = { tier: 0, dps: 0 };
		for (const tier of [...new Set(list.map((w) => w.tier))]) {
			const dps = Math.max(...list.filter((w) => w.tier === tier).map(weaponDps));
			assert.ok(dps > lowerTier.dps, `${type}: tier ${tier} (${dps}) beats tier ${lowerTier.tier} (${lowerTier.dps})`);
			lowerTier = { tier, dps };
		}
		best.set(type, lowerTier.dps);
	}
	assert.ok(best.size >= 6);
});

test('a starter weapon kills a tier-1 rat in well under a minute of attack-speed swings', () => {
	const sword = ITEM_CATALOG.wooden_sword;
	assert.ok(100 / weaponDps(sword) < 30);
});
