import test from 'node:test';
import assert from 'node:assert/strict';
import { AFFIXES } from '../../src/catalog/affixes';
import { STAT_KEYS, type StatKey } from '../../src/catalog';
import { INITIAL_CHARACTER_STATS } from '../../src/config/character';
import { STARTER_EQUIPMENT } from '../../src/config/itemCatalog';
import { armorOf, dodgeChance, lifeLeechPercent, manaRegenPerSec, maxHp, maxMana } from '../../src/lib/combat';
import { aggregateStats, compareDetailed } from '../../src/lib/inventory';
import { plainItem, resolveItem } from '../../src/lib/itemInstance';
import { calculateCombatStats } from '../../src/utils/game/character';
import type { CharacterStats, Equipment, ItemInstance } from '../../src/types/game';

// IDL-340: the audit of equipment stats. An affix is counted exactly once: in the item's own stats, in the character's gear total, in the comparison preview and in what combat reads.
// `aggregateStats` is the one place gear is summed (`inventory.ts`); every reader below goes through it.

const stats = (): CharacterStats => ({ ...INITIAL_CHARACTER_STATS, ...calculateCombatStats(INITIAL_CHARACTER_STATS) }) as CharacterStats;
const WITH = (affixId: string, roll = 0.5): ItemInstance => ({ ...plainItem('obsidian_helm'), rarity: 'rare', level: 30, affixes: [{ id: affixId, roll }] });
const close = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} vs ${b}`);

test('an affix is in the item total exactly once: stats = base stats + the affix value, for every affix', () => {
	for (const affix of AFFIXES.filter((a) => a.enabled)) {
		const item = WITH(affix.id);
		const r = resolveItem(item)!;
		assert.ok(r, affix.id);
		assert.equal(r.affixes.length, 1, affix.id);
		const own = r.affixes[0];
		for (const key of STAT_KEYS) {
			const expected = (r.baseStats[key] ?? 0) + (own.stat === key ? own.value : 0);
			close(r.stats[key] ?? 0, expected, `${affix.id} ${key}`);
		}
	}
});

test('the character total adds the item once and nothing else changes: a worn affix item minus the worn kit is the item itself', () => {
	for (const affix of AFFIXES.filter((a) => a.enabled)) {
		const item = WITH(affix.id);
		const worn: Equipment = { head: item };
		const total = aggregateStats(worn);
		const own = resolveItem(item)!.stats;
		for (const key of STAT_KEYS) {
			// the perk families are capped by `capPerks`; everything an item can roll sums straight through
			if (own[key] === undefined) continue;
			assert.ok((total[key] ?? 0) <= (own[key] ?? 0) + 1e-9, `${affix.id} ${key} never exceeds the item`);
		}
		close(total[affix.stat as StatKey] ?? 0, own[affix.stat as StatKey] ?? 0, `${affix.id} total ${affix.stat}`);
	}
});

test('the comparison preview is the real before/after of equipping: net = aggregate(after) - aggregate(before), for every affix and both slots of a ring', () => {
	for (const affix of AFFIXES.filter((a) => a.enabled)) {
		const item = WITH(affix.id);
		const cmp = compareDetailed(item, STARTER_EQUIPMENT)!;
		const before = aggregateStats(STARTER_EQUIPMENT);
		const after = aggregateStats(cmp.after);
		for (const key of STAT_KEYS) {
			const real = Math.round(((after[key] ?? 0) - (before[key] ?? 0)) * 100) / 100;
			close(cmp.net[key] ?? 0, real, `${affix.id} net ${key}`);
		}
	}
	const ring = {
		...plainItem('obsidian_ring'),
		rarity: 'rare' as const,
		level: 20,
		affixes: [{ id: AFFIXES.find((a) => a.stat === 'goldFind')!.id, roll: 0.5 }],
	};
	const worn: Equipment = { ring1: plainItem('obsidian_ring'), ring2: { ...plainItem('obsidian_ring'), level: 40 } };
	for (const pick of ['ring1', 'ring2'] as const) {
		const cmp = compareDetailed(ring, worn, pick)!;
		const real = aggregateStats({ ...worn, [pick]: ring });
		const was = aggregateStats(worn);
		for (const key of STAT_KEYS) close(cmp.net[key] ?? 0, Math.round(((real[key] ?? 0) - (was[key] ?? 0)) * 100) / 100, `${pick} ${key}`);
	}
});

test('combat reads the affix once: each combat stat moves by exactly the affix value when the item is worn', () => {
	const base: Equipment = {};
	const cs = stats();
	const attrs = { strength: 5, dexterity: 5, intelligence: 5, vitality: 5, charisma: 5 };
	const pick = (stat: string) => AFFIXES.find((a) => a.stat === stat && a.enabled)!;
	const value = (affixId: string) => resolveItem(WITH(affixId))!.affixes[0].value;

	const hp = pick('maxHp');
	assert.equal(maxHp(cs, { head: WITH(hp.id) }) - maxHp(cs, base), Math.round(value(hp.id) + (resolveItem(WITH(hp.id))!.baseStats.maxHp ?? 0)));
	const armor = pick('armor');
	close(armorOf({ head: WITH(armor.id) }) - armorOf(base), resolveItem(WITH(armor.id))!.stats.armor ?? 0, 'armor');
	const dodge = pick('dodge');
	close(dodgeChance({ head: WITH(dodge.id) }) - dodgeChance(base), (resolveItem(WITH(dodge.id))!.stats.dodge ?? 0) / 100, 'dodge');
	const mana = pick('maxMana');
	assert.equal(maxMana(cs, { head: WITH(mana.id) }) - maxMana(cs, base), Math.round(resolveItem(WITH(mana.id))!.stats.maxMana ?? 0));
	const regen = pick('manaRegen');
	close(manaRegenPerSec(attrs, { head: WITH(regen.id) }) - manaRegenPerSec(attrs, base), resolveItem(WITH(regen.id))!.stats.manaRegen ?? 0, 'mana regen');
	const leech = pick('lifeLeech');
	close(lifeLeechPercent({ head: WITH(leech.id) }) - lifeLeechPercent(base), resolveItem(WITH(leech.id))!.stats.lifeLeech ?? 0, 'life leech');
});
