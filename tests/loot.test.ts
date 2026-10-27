import test from 'node:test';
import assert from 'node:assert/strict';
import { rollKillLoot } from '../src/lib/loot';
import { emitCombat } from '../src/lib/combatFx';
import { COMBAT } from '../src/config/combatConfig';
import { BASIC_GEAR, ITEM_CATALOG, RATTATUI_SET, lootPool, isGear } from '../src/config/itemCatalog';

const ctx = { goldPerSec: 100, xpPerSec: 2, luck: 0 };
const T1 = { type: 'rat', tier: 1 } as const;

test('rng 0 drops a piece of plain gear and a potion from a rat, rng 0.999 drops nothing', () => {
	const lucky = rollKillLoot(T1, ctx, () => 0);
	assert.equal(lucky.items.length, 2);
	assert.ok((BASIC_GEAR as readonly string[]).includes(lucky.items[0].id));
	assert.deepEqual(lucky.items[1], { id: 'potion_minor', qty: 1 });
	assert.deepEqual(rollKillLoot(T1, ctx, () => 0.999).items, []);
});

test('rats never drop Rattatui pieces, whatever the rng', () => {
	for (const tier of [1, 3, 5] as const) {
		for (let i = 0; i < 200; i++) {
			const r = rollKillLoot({ type: 'rat', tier }, ctx, () => i / 200);
			for (const item of r.items) assert.equal(RATTATUI_SET.pieces.includes(item.id), false, item.id);
		}
	}
});

test('drop chances rise with the tier', () => {
	const rng = () => COMBAT.drops.gearBase + 0.005; // above the T1 chance, below T3's
	const gear = (tier: number) =>
		rollKillLoot({ type: 'rat', tier }, ctx, rng).items.filter((i) => i.id !== 'potion_minor').length;
	assert.equal(gear(1), 0);
	assert.equal(gear(3), 1);
});

test('the Rat King always drops a Rattatui piece and every potion that lists him', () => {
	const king = { type: 'ratKing', tier: 1 } as const;
	const r = rollKillLoot(king, ctx, () => 0.999);
	const pieces = r.items.filter((i) => RATTATUI_SET.pieces.includes(i.id));
	assert.equal(pieces.length, COMBAT.drops.king.setPieces);
	assert.deepEqual(r.items.find((i) => i.id === 'potion_minor'), { id: 'potion_minor', qty: 2 });
	assert.deepEqual(r.items.find((i) => i.id === 'potion_greater'), { id: 'potion_greater', qty: 1 });
	assert.equal(r.items.some((i) => ITEM_CATALOG[i.id].rarity === 'legendary'), false);
	const lucky = rollKillLoot(king, ctx, () => 0).items;
	assert.equal(lucky.filter((i) => RATTATUI_SET.pieces.includes(i.id)).length, 2);
	assert.equal(lucky.filter((i) => ITEM_CATALOG[i.id].rarity === 'legendary').length, 1, 'a low roll also wins a legendary weapon');
});

test('older rats drop better gear: steel needs tier 3, obsidian tier 5, the greater potion tier 4', () => {
	const rarities = (tier: number) => new Set(lootPool('rat', tier, isGear).map((e) => ITEM_CATALOG[e.id].rarity));
	assert.deepEqual([...rarities(1)], ['common']);
	assert.ok(!rarities(2).has('uncommon') && rarities(3).has('uncommon') && !rarities(4).has('rare') && rarities(5).has('rare'));
	assert.ok(!lootPool('rat', 3).some((e) => e.id === 'potion_greater'));
	assert.ok(lootPool('rat', 4).some((e) => e.id === 'potion_greater'));
	for (const tier of [1, 3, 5]) assert.ok(!lootPool('rat', tier).some((e) => ITEM_CATALOG[e.id].rarity === 'legendary' || ITEM_CATALOG[e.id].rarity === 'epic'));
});

test('the king prefers pieces you do not own yet, and falls back to duplicates once you own all', () => {
	const king = { type: 'ratKing', tier: 1 } as const;
	const all = RATTATUI_SET.pieces;
	const missing = all[all.length - 1];
	for (let i = 0; i < 40; i++) {
		const r = rollKillLoot(king, { ...ctx, owned: all.slice(0, -1) }, () => i / 40);
		assert.equal(r.items.find((x) => RATTATUI_SET.pieces.includes(x.id))!.id, missing);
	}
	const dupe = rollKillLoot(king, { ...ctx, owned: all }, () => 0.5);
	assert.ok(dupe.items.some((x) => all.includes(x.id)));
});

test('gold and xp are seconds of income and scale with the tier (T2 = 1.5x T1)', () => {
	const t1 = rollKillLoot(T1, ctx, () => 0.999);
	assert.equal(t1.gold, 9000);
	assert.equal(t1.xp, 180);
	const t2 = rollKillLoot({ type: 'rat', tier: 2 }, ctx, () => 0.999);
	assert.equal(t2.gold, 13500);
	assert.equal(t2.xp, 270);
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

test('plain gear is picked uniformly from BASIC_GEAR', () => {
	const n = BASIC_GEAR.length;
	const seen = new Set<string>();
	for (let i = 0; i < n; i++) {
		const rolls = [0, (i + 0.5) / n, 0.999]; // gear drops, which piece, then no potion
		let call = 0;
		const r = rollKillLoot(T1, ctx, () => rolls[call++] ?? 0.999);
		assert.equal(r.items.length, 1);
		seen.add(r.items[0].id);
	}
	assert.equal(seen.size, n);
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
