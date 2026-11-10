import test from 'node:test';
import assert from 'node:assert/strict';
import { rollKillLoot } from '../../src/lib/loot';
import { emitCombat } from '../../src/lib/combatFx';
import { COMBAT } from '../../src/config/combatConfig';
import { ITEM_CATALOG } from '../../src/catalog';
import { BASIC_GEAR } from '../../src/config/itemCatalog';
import { generateLoot } from '../../src/lib/loot/generate';
import { LOOT_DATA } from '../../src/lib/loot/data';
import { eligibleCandidates } from '../../src/lib/loot/pools';
import { mulberry32 } from '../../src/lib/rng';
import type { Drop } from '../../src/types/game';

const ctx = { goldPerSec: 100, xpPerSec: 2, luck: 0 };
const T1 = { type: 'thistleBoar', level: 1 } as const;

const baseOf = (d: Drop) => (d.kind === 'gear' ? d.item.base : d.id);
const gearOnly = (items: Drop[]) => items.filter((d) => d.kind === 'gear');
const isLegendaryWeapon = (d: Drop) => ITEM_CATALOG[baseOf(d)].pools?.includes('legendary_weapons') ?? false;

test('rng 0 drops a piece of plain gear and a potion from a rat, rng 0.999 drops nothing', () => {
	const lucky = rollKillLoot(T1, ctx, () => 0);
	assert.equal(lucky.items.length, 2);
	assert.equal(lucky.items[0].kind, 'gear');
	assert.ok((BASIC_GEAR as readonly string[]).includes(baseOf(lucky.items[0])));
	assert.deepEqual(lucky.items[1], { kind: 'consumable', id: 'potion_minor', qty: 1 });
	assert.deepEqual(rollKillLoot(T1, ctx, () => 0.999).items, []);
});

test('rats never drop the legendary weapons, whatever the rng', () => {
	for (const level of [1, 5, 9, 20] as const) {
		for (let i = 0; i < 200; i++) {
			const r = rollKillLoot({ type: 'thistleBoar', level }, ctx, () => i / 200);
			for (const item of r.items) {
				assert.equal(isLegendaryWeapon(item), false, baseOf(item));
			}
		}
	}
});

test('drop chances rise with the monster level', () => {
	const rng = () => 0.125; // above the level 1 chance (0.12), below level 5 (0.16)
	const gear = (level: number) => gearOnly(rollKillLoot({ type: 'thistleBoar', level }, ctx, rng).items).length;
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

test('a boss always drops the potions that list it, and a low roll adds a legendary weapon', () => {
	const king = { type: 'bossWinterWyrm', level: 30 } as const; // the tundra boss owns Titan Maul (BOSS_LOOT)
	const r = rollKillLoot(king, ctx, () => 0.999);
	assert.deepEqual(
		r.items.find((d) => baseOf(d) === 'potion_minor'),
		{ kind: 'consumable', id: 'potion_minor', qty: 2 },
	);
	assert.deepEqual(
		r.items.find((d) => baseOf(d) === 'potion_greater'),
		{ kind: 'consumable', id: 'potion_greater', qty: 1 },
	);
	assert.equal(r.items.some(isLegendaryWeapon), false);
	const lucky = rollKillLoot(king, ctx, () => 0).items;
	assert.equal(lucky.filter(isLegendaryWeapon).length, 1, 'a low roll also wins a legendary weapon');
});

test('a boss with a unique gives it about 5% of the time (the Great Auroch has none yet)', () => {
	const rng = mulberry32(32);
	const n = 40000;
	let legendary = 0;
	for (let i = 0; i < n; i++) {
		const items = rollKillLoot({ type: 'bossWinterWyrm', level: 30 }, ctx, rng).items;
		if (items.some(isLegendaryWeapon)) legendary++;
		assert.equal(rollKillLoot({ type: 'bossGreatAuroch', level: 15 }, ctx, rng).items.some(isLegendaryWeapon), false);
	}
	assert.ok(Math.abs(legendary / n - 0.05) < 0.007, `legendary ${legendary / n}`);
});

test('the boss also rolls one general item of its own (rolled rarity, at the boss level)', () => {
	const rng = mulberry32(33);
	for (let i = 0; i < 300; i++) {
		const general = gearOnly(rollKillLoot({ type: 'bossGreatAuroch', level: 15 }, ctx, rng).items).filter((d) => !isLegendaryWeapon(d));
		assert.equal(general.length, 1);
		assert.equal(general[0].kind === 'gear' ? general[0].item.level : 0, 15);
	}
});

test('older rats unlock better material: hide (G2) from item level 9, iron (G3) from 19, steel (G4) from 31, the greater potion from level 7', () => {
	const grades = (level: number) =>
		new Set(eligibleCandidates(LOOT_DATA, 'general_equipment', level).flatMap((c) => c.def.tags?.filter((t) => t.startsWith('grade:')) ?? []));
	assert.deepEqual([...grades(1)], ['grade:G1']);
	assert.ok(!grades(8).has('grade:G2') && grades(9).has('grade:G2'), 'G2 arrives with item level 9');
	assert.ok(!grades(18).has('grade:G3') && grades(19).has('grade:G3'), 'G3 arrives with item level 19');
	assert.ok(!grades(30).has('grade:G4') && grades(31).has('grade:G4') && !grades(31).has('grade:G3'), 'G4 arrives with item level 31 and G3 leaves');
	assert.ok(grades(43).has('grade:G5') && grades(55).has('grade:G6'), 'G5 from 43, G6 from 55');
	assert.ok(![...grades(100)].some((g) => g > 'grade:G6'), 'nothing above the live grades (G1-G6) at any level');
	const seen = (level: number) => {
		const rng = mulberry32(40 + level);
		const ids = new Set<string>();
		for (let i = 0; i < 6000; i++) for (const d of generateLoot({ sourceId: 'monster', level }, rng).drops) ids.add(baseOf(d));
		return ids;
	};
	assert.ok(!seen(5).has('potion_greater') && seen(7).has('potion_greater'));
	for (const level of [1, 5, 9])
		for (const id of seen(level)) assert.ok(!ITEM_CATALOG[id].pools?.length || id.startsWith('potion'), `${id} is not a named item`);
});

test('gold and xp are seconds of income (below the cap) and scale with the monster level', () => {
	const low = { goldPerSec: 1, xpPerSec: 0.2, luck: 0 };
	const t1 = rollKillLoot(T1, low, () => 0.999);
	assert.equal(t1.gold, 90);
	assert.equal(t1.xp, 18);
	const t3 = rollKillLoot({ type: 'thistleBoar', level: 3 }, low, () => 0.999);
	assert.equal(t3.gold, Math.floor(90 * 1.08 ** 2));
	assert.ok(Math.abs(t3.xp - 18 * 1.08 ** 2) < 1e-9);
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

test('every base a level 1 rat can drop comes up, in shares that follow the pool weights, among the commons', () => {
	const rng = mulberry32(34);
	const counts = new Map<string, number>();
	let total = 0;
	for (let i = 0; i < 120000; i++) {
		// Common only: a G1 base is common-only (grades.ts), so above common the shares differ by who may roll that rarity
		for (const d of gearOnly(rollKillLoot(T1, ctx, rng).items)) {
			if (d.kind !== 'gear' || d.item.rarity !== 'common') continue;
			counts.set(baseOf(d), (counts.get(baseOf(d)) ?? 0) + 1);
			total++;
		}
	}
	assert.equal(counts.size, BASIC_GEAR.length);
	const weightOf = (id: string) => ITEM_CATALOG[id].poolWeight ?? 1;
	const weightSum = BASIC_GEAR.reduce((sum, id) => sum + weightOf(id), 0);
	for (const [id, n] of counts) {
		const expected = (total * weightOf(id)) / weightSum;
		assert.ok(Math.abs(n - expected) < expected * 0.3, `${id}: ${n} vs ${expected.toFixed(0)}`);
	}
});

test('the monster level sets the item level of kill drops; the pity counters come back updated', () => {
	const rng = mulberry32(35);
	const top = (level: number) =>
		Math.max(
			...Array.from({ length: 4000 }, () =>
				Math.max(0, ...gearOnly(rollKillLoot({ type: 'thistleBoar', level }, ctx, rng).items).map((d) => (d.kind === 'gear' ? d.item.level : 0))),
			),
		);
	assert.ok(top(20) > top(5) + 10);
	assert.equal(top(5), 6, 'level 5 plus the one level of variance');
	const king = rollKillLoot({ type: 'bossWinterWyrm', level: 30 }, { ...ctx, pity: { 'boss_tundra:unique': 4 } }, () => 0.999);
	assert.equal(king.pity['boss_tundra:unique'], 5);
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

test("a kill pays pelts: a share of the farm hide income for the monster's reward seconds, nothing without a farm", () => {
	const rat = 90 * 1.08 ** 4;
	assert.equal(rollKillLoot({ type: 'thistleBoar', level: 5 }, { ...ctx, hidePerSec: 4 }, () => 0.5).hide, Math.floor(4 * rat * COMBAT.rewards.hideShare));
	assert.equal(rollKillLoot({ type: 'thistleBoar', level: 5 }, ctx, () => 0.5).hide, 0, 'no hide income, no pelts');
	const king = rollKillLoot({ type: 'bossGreatAuroch', level: 15 }, { ...ctx, hidePerSec: 4 }, () => 0.5).hide;
	assert.ok(king > rollKillLoot({ type: 'thistleBoar', level: 9 }, { ...ctx, hidePerSec: 4 }, () => 0.5).hide, 'the boss pays more than any normal monster');
	const lucky = rollKillLoot({ type: 'thistleBoar', level: 5 }, { ...ctx, hidePerSec: 4, lucky: true }, () => 0.5).hide;
	assert.ok(lucky > Math.floor(4 * rat * COMBAT.rewards.hideShare), 'a lucky monster pays its multiplier on pelts too');
});
