import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEGENDARY_PERKS } from '@/catalog/items/reuse';
import { PERK_CAPS, type PerkFamily } from '@/catalog/perkCaps';
import { ITEM_CATALOG } from '@/catalog';
import { gearEconomy } from '@/lib/gearEconomy';
import { aggregateStats } from '@/lib/inventory';
import { resolveItem } from '@/lib/itemInstance';
import { LOOT_DATA, type LootData } from '@/lib/loot/data';
import { validateLootData } from '@/lib/loot/validate';
import type { Equipment, ItemInstance } from '@/types/game';

// IDL-143 / IDL-144: a legendary's perks are fixed numbers on the item that flow through the same gear sum as the set bonuses, so the
// browser, the server's summary (`summarize` -> `gearEconomy`) and the fight profile read one number.

const piece = (base: string): ItemInstance => ({ base, level: ITEM_CATALOG[base].minItemLevel ?? 1, rarity: 'legendary', quality: 50, affixes: [] });
const wearing = (base: string): Equipment => ({ mainHand: piece(base) });

test('every perk of the roster is in the item, in its stats and in the gear sum, whatever the family', () => {
	for (const [id, perks] of Object.entries(LEGENDARY_PERKS)) {
		const resolved = resolveItem(piece(id))!;
		const sum = aggregateStats(wearing(id)) as unknown as Record<string, number>;
		for (const [stat, value] of Object.entries(perks)) {
			assert.equal(resolved.perks[stat as keyof typeof resolved.perks], value, `${id} perk ${stat}`);
			assert.ok((resolved.stats[stat as keyof typeof resolved.stats] ?? 0) >= (value as number), `${id}: the perk is part of the item's stats`);
			assert.equal(
				sum[stat],
				Math.min(value as number, stat in PERK_CAPS ? PERK_CAPS[stat as PerkFamily] : Infinity) +
					(stat === 'goldFind' ? (resolved.stats.goldFind ?? 0) - (value as number) : 0),
				`${id}: ${stat} in the gear sum`,
			);
		}
	}
});

test('the economy perks reach the server summary: gearEconomy reads the same sum as the client, and nothing changes with no legendary worn', () => {
	const none = gearEconomy({});
	assert.deepEqual(none, { incomePct: 0, xpPct: 0, killRewardPct: 0, offlineEff: 0, offlineCapHours: 0, clickPct: 0 });
	const expected: Record<string, Partial<typeof none>> = {
		dawnbringer_trident: { incomePct: 25 },
		reapers_crescent: { killRewardPct: 25 },
		frostbloom_fan: { xpPct: 15 },
		voidrune_blade: { offlineEff: 15 },
		nightfall_edge: { clickPct: 15 },
	};
	for (const [id, want] of Object.entries(expected)) assert.deepEqual(gearEconomy(wearing(id)), { ...none, ...want }, id);
	// combat perks: the fight profile reads the same aggregate
	assert.equal(aggregateStats(wearing('stormtrident')).maxHpPct, 15);
	assert.equal(aggregateStats(wearing('cindercrescent_glaive')).damagePct, 10);
});

test('a perk and the set bonuses share one family cap: income 25 from a legendary plus 26 from the Obsidian set stops at 50', () => {
	const slots = ['offHand', 'head', 'shoulder', 'chest', 'hands', 'legs', 'feet', 'neck', 'cape', 'ring1', 'ring2', 'charm'] as const;
	const bases = [
		'obsidian_aegis',
		'obsidian_helm',
		'obsidian_pauldrons',
		'obsidian_cuirass',
		'obsidian_gauntlets',
		'obsidian_greaves',
		'obsidian_sabatons',
		'obsidian_pendant',
		'obsidian_cloak',
		'obsidian_ring',
		'obsidian_ring',
		'obsidian_charm',
	];
	const set: Equipment = Object.fromEntries(slots.map((slot, i) => [slot, { base: bases[i], level: 60, rarity: 'rare', quality: 50, affixes: [] }]));
	assert.equal(aggregateStats(set).incomePct, 26, 'the full Obsidian set alone');
	assert.equal(aggregateStats({ ...set, mainHand: piece('dawnbringer_trident') }).incomePct, PERK_CAPS.incomePct, '26 + 25 stops at the cap');
});

test('the roster keeps one headline family each, stays inside the caps, and the validator accepts it and refuses a perk on a plain item', () => {
	const families = Object.values(LEGENDARY_PERKS).map((perks) => Object.keys(perks).join('+'));
	assert.equal(new Set(families).size, families.length, `no two legendaries share a headline perk: ${families.join(', ')}`);
	assert.deepEqual(validateLootData().errors, []);
	const bad: LootData = JSON.parse(JSON.stringify(LOOT_DATA));
	bad.items.iron_sword.perks = { incomePct: 5 };
	assert.ok(validateLootData(bad).errors.some((e) => /only a named item carries perks/.test(e)));
	const over: LootData = JSON.parse(JSON.stringify(LOOT_DATA));
	over.items.dawnbringer_trident.perks = { incomePct: 99 };
	assert.ok(validateLootData(over).errors.some((e) => /above the family cap/.test(e)));
});
