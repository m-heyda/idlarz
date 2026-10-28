import test from 'node:test';
import assert from 'node:assert/strict';
import { rollKillLoot } from '../src/lib/loot';
import { emitCombat } from '../src/lib/combatFx';
import { COMBAT } from '../src/config/combatConfig';
import { BASIC_GEAR, ITEM_CATALOG, RATTATUI_SET } from '../src/config/itemCatalog';
import { generateLoot } from '../src/lib/loot/generate';
import { LOOT_DATA } from '../src/lib/loot/data';
import { eligibleCandidates } from '../src/lib/loot/pools';
import { mulberry32 } from '../src/lib/rng';
import { monsterStats } from '../src/lib/monsters';
import type { Drop } from '../src/types/game';

const ctx = { goldPerSec: 100, xpPerSec: 2, luck: 0 };
const T1 = { type: 'rat', level: 1 } as const;

const baseOf = (d: Drop) => (d.kind === 'gear' ? d.item.base : d.id);
const gearOnly = (items: Drop[]) => items.filter((d) => d.kind === 'gear');
const isLegendaryWeapon = (d: Drop) => ITEM_CATALOG[baseOf(d)].pools?.includes('legendary_weapons') ?? false;
const isSetPiece = (d: Drop) => RATTATUI_SET.pieces.includes(baseOf(d));

test('rng 0 drops a piece of plain gear and a potion from a rat, rng 0.999 drops nothing', () => {
	const lucky = rollKillLoot(T1, ctx, () => 0);
	assert.equal(lucky.items.length, 2);
	assert.equal(lucky.items[0].kind, 'gear');
	assert.ok((BASIC_GEAR as readonly string[]).includes(baseOf(lucky.items[0])));
	assert.deepEqual(lucky.items[1], { kind: 'consumable', id: 'potion_minor', qty: 1 });
	assert.deepEqual(rollKillLoot(T1, ctx, () => 0.999).items, []);
});

test('rats never drop Rattatui pieces or the legendary weapons, whatever the rng', () => {
	for (const level of [1, 5, 9, 20] as const) {
		for (let i = 0; i < 200; i++) {
			const r = rollKillLoot({ type: 'rat', level }, ctx, () => i / 200);
			for (const item of r.items) {
				assert.equal(isSetPiece(item), false, baseOf(item));
				assert.equal(isLegendaryWeapon(item), false, baseOf(item));
			}
		}
	}
});

test('drop chances rise with the monster level', () => {
	const rng = () => 0.125; // above the level 1 chance (0.12), below level 5 (0.16)
	const gear = (level: number) => gearOnly(rollKillLoot({ type: 'rat', level }, ctx, rng).items).length;
	assert.equal(gear(1), 0);
	assert.equal(gear(5), 1);
});

test('a rat drops gear about 12% of the time at level 1, and the chance is independent of the rarity that rolls', () => {
	const rng = mulberry32(31);
	let drops = 0;
	const n = 50000;
	for (let i = 0; i < n; i++) drops += gearOnly(rollKillLoot(T1, ctx, rng).items).length;
	assert.ok(Math.abs(drops / n - 0.12) < 0.01, `${drops / n}`);
});

test('the Rat King always drops a Rattatui piece and every potion that lists him', () => {
	const king = { type: 'ratKing', level: 15 } as const;
	const r = rollKillLoot(king, ctx, () => 0.999);
	assert.equal(r.items.filter(isSetPiece).length, 1);
	assert.deepEqual(r.items.find((d) => baseOf(d) === 'potion_minor'), { kind: 'consumable', id: 'potion_minor', qty: 2 });
	assert.deepEqual(r.items.find((d) => baseOf(d) === 'potion_greater'), { kind: 'consumable', id: 'potion_greater', qty: 1 });
	assert.equal(r.items.some(isLegendaryWeapon), false);
	const lucky = rollKillLoot(king, ctx, () => 0).items;
	assert.equal(lucky.filter(isSetPiece).length, 2);
	assert.equal(lucky.filter(isLegendaryWeapon).length, 1, 'a low roll also wins a legendary weapon');
});

test('the King gives a second set piece 40% of the time and a legendary weapon 5% of the time (the old rates)', () => {
	const rng = mulberry32(32);
	const n = 40000;
	let two = 0;
	let legendary = 0;
	for (let i = 0; i < n; i++) {
		const items = rollKillLoot({ type: 'ratKing', level: 15 }, ctx, rng).items;
		if (items.filter(isSetPiece).length === 2) two++;
		if (items.some(isLegendaryWeapon)) legendary++;
	}
	assert.ok(Math.abs(two / n - 0.4) < 0.01, `two pieces ${two / n}`);
	assert.ok(Math.abs(legendary / n - 0.05) < 0.007, `legendary ${legendary / n}`);
});

test('the King now also rolls one general item of his own (rolled rarity, at the King level)', () => {
	const rng = mulberry32(33);
	for (let i = 0; i < 300; i++) {
		const general = gearOnly(rollKillLoot({ type: 'ratKing', level: 15 }, ctx, rng).items).filter((d) => !isSetPiece(d) && !isLegendaryWeapon(d));
		assert.equal(general.length, 1);
		assert.equal(general[0].kind === 'gear' ? general[0].item.level : 0, 15);
	}
});

test('older rats unlock better material: steel from level 5, obsidian from level 9, the greater potion from level 7', () => {
	const bases = (level: number) => new Set(eligibleCandidates(LOOT_DATA, 'general_equipment', level).map((c) => ITEM_CATALOG[c.def.id].tier));
	assert.deepEqual([...bases(1)], [1]);
	assert.ok(!bases(3).has(2) && bases(5).has(2), 'steel (tier 2) arrives with level 5 rats');
	assert.ok(!bases(7).has(3) && bases(9).has(3), 'obsidian (tier 3) arrives with level 9 rats');
	const seen = (level: number) => {
		const rng = mulberry32(40 + level);
		const ids = new Set<string>();
		for (let i = 0; i < 6000; i++) for (const d of generateLoot({ sourceId: 'rat', level }, rng).drops) ids.add(baseOf(d));
		return ids;
	};
	assert.ok(!seen(5).has('potion_greater') && seen(7).has('potion_greater'));
	for (const level of [1, 5, 9]) for (const id of seen(level)) assert.ok(!ITEM_CATALOG[id].pools?.length || id.startsWith('potion'), `${id} is not a named item`);
});

test('the king prefers pieces you do not own yet, and falls back to duplicates once you own all', () => {
	const king = { type: 'ratKing', level: 15 } as const;
	const all = RATTATUI_SET.pieces;
	const missing = all[all.length - 1];
	for (let i = 0; i < 40; i++) {
		const r = rollKillLoot(king, { ...ctx, owned: all.slice(0, -1) }, () => i / 40);
		assert.equal(baseOf(r.items.find(isSetPiece)!), missing);
	}
	const dupe = rollKillLoot(king, { ...ctx, owned: all }, () => 0.5);
	assert.ok(dupe.items.some((x) => all.includes(baseOf(x))));
});

test('gold and xp are seconds of income and scale with the monster level', () => {
	const t1 = rollKillLoot(T1, ctx, () => 0.999);
	assert.equal(t1.gold, 9000);
	assert.equal(t1.xp, 180);
	const seconds = monsterStats('rat', 3).rewardSec;
	const t3 = rollKillLoot({ type: 'rat', level: 3 }, ctx, () => 0.999);
	assert.equal(t3.gold, Math.floor(100 * seconds));
	assert.equal(t3.xp, 2 * seconds);
	assert.ok(t3.gold > t1.gold);
});

test('minimum gold and xp apply at zero income', () => {
	const r = rollKillLoot(T1, { goldPerSec: 0, xpPerSec: 0, luck: 0 }, () => 0.999);
	assert.equal(r.gold, COMBAT.rewards.minGold);
	assert.equal(r.xp, COMBAT.rewards.minXp);
});

test('luck raises gold', () => {
	const base = rollKillLoot(T1, ctx, () => 0.999).gold;
	const lucky = rollKillLoot(T1, { ...ctx, luck: 20 }, () => 0.999).gold;
	assert.ok(lucky > base);
});

test('every base a level 1 rat can drop comes up, in even shares (all pool weights are equal)', () => {
	const rng = mulberry32(34);
	const counts = new Map<string, number>();
	let total = 0;
	for (let i = 0; i < 120000; i++) {
		for (const d of gearOnly(rollKillLoot(T1, ctx, rng).items)) {
			counts.set(baseOf(d), (counts.get(baseOf(d)) ?? 0) + 1);
			total++;
		}
	}
	assert.equal(counts.size, BASIC_GEAR.length);
	const expected = total / BASIC_GEAR.length;
	for (const [id, n] of counts) assert.ok(Math.abs(n - expected) < expected * 0.3, `${id}: ${n} vs ${expected.toFixed(0)}`);
});

test('the monster level sets the item level of kill drops; the pity counters come back updated', () => {
	const rng = mulberry32(35);
	const top = (level: number) =>
		Math.max(...Array.from({ length: 4000 }, () => Math.max(0, ...gearOnly(rollKillLoot({ type: 'rat', level }, ctx, rng).items).map((d) => (d.kind === 'gear' ? d.item.level : 0)))));
	assert.ok(top(20) > top(5) + 10);
	assert.equal(top(5), 6, 'level 5 plus the one level of variance');
	const king = rollKillLoot({ type: 'ratKing', level: 15 }, { ...ctx, pity: { 'boss:king_legendary': 4 } }, () => 0.999);
	assert.equal(king.pity['boss:king_legendary'], 5);
});

test('emitCombat is a no-op outside the browser', () => {
	emitCombat({ kind: 'hit', damage: 2, killed: false, crit: 'none' });
	emitCombat({ kind: 'hurt', amount: 3 });
	emitCombat({ kind: 'heal', amount: 35 });
});

test('Gold Find raises kill gold by its percentage and leaves a plain kill alone', () => {
	const plain = rollKillLoot(T1, ctx, () => 0.999).gold;
	const boosted = rollKillLoot(T1, { ...ctx, goldFind: 50 }, () => 0.999).gold;
	assert.equal(boosted, Math.floor(plain * 1.5));
	assert.equal(rollKillLoot(T1, { ...ctx, goldFind: 0 }, () => 0.999).gold, plain);
});

test('a kill pays pelts: a share of the farm hide income for the monster\'s reward seconds, nothing without a farm', () => {
	const rat = monsterStats('rat', 5).rewardSec;
	assert.equal(rollKillLoot({ type: 'rat', level: 5 }, { ...ctx, hidePerSec: 4 }, () => 0.5).hide, Math.floor(4 * rat * COMBAT.rewards.hideShare));
	assert.equal(rollKillLoot({ type: 'rat', level: 5 }, ctx, () => 0.5).hide, 0, 'no hide income, no pelts');
	const king = rollKillLoot({ type: 'ratKing', level: 15 }, { ...ctx, hidePerSec: 4 }, () => 0.5).hide;
	assert.ok(king > rollKillLoot({ type: 'rat', level: 9 }, { ...ctx, hidePerSec: 4 }, () => 0.5).hide, 'the King pays more than any rat');
	const lucky = rollKillLoot({ type: 'rat', level: 5 }, { ...ctx, hidePerSec: 4, lucky: true }, () => 0.5).hide;
	assert.ok(lucky > Math.floor(4 * rat * COMBAT.rewards.hideShare), 'a lucky monster pays its multiplier on pelts too');
});
