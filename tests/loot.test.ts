import test from 'node:test';
import assert from 'node:assert/strict';
import { rollKillLoot } from '../src/lib/loot';
import { emitCombat } from '../src/lib/combatFx';
import { COMBAT } from '../src/config/combatConfig';
import { RATTATUI_SET } from '../src/config/itemCatalog';

const ctx = { goldPerSec: 100, xpPerSec: 2, luck: 0 };
const T1 = { type: 'rat', tier: 1 } as const;

test('rng 0 drops both a set piece and a potion, rng 0.999 drops nothing', () => {
	const lucky = rollKillLoot(T1, ctx, () => 0);
	assert.equal(lucky.items.length, 2);
	assert.ok(RATTATUI_SET.pieces.includes(lucky.items[0].id));
	assert.deepEqual(lucky.items[1], { id: 'potion_minor', qty: 1 });
	assert.deepEqual(rollKillLoot(T1, ctx, () => 0.999).items, []);
});

test('drop chances rise with the tier', () => {
	const rng = () => COMBAT.drops.setPieceBase + 0.005; // above the T1 chance, below T3's
	assert.equal(rollKillLoot(T1, ctx, rng).items.filter((i) => i.id !== 'potion_minor').length, 0);
	assert.equal(rollKillLoot({ type: 'rat', tier: 3 }, ctx, rng).items.filter((i) => i.id !== 'potion_minor').length, 1);
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

test('the set piece is picked uniformly from RATTATUI_SET.pieces', () => {
	const n = RATTATUI_SET.pieces.length;
	const seen = new Set<string>();
	for (let i = 0; i < n; i++) {
		const rolls = [0, (i + 0.5) / n, 0.999]; // set piece drops, which piece, then no potion
		let call = 0;
		const r = rollKillLoot(T1, ctx, () => rolls[call++] ?? 0.999);
		assert.equal(r.items.length, 1);
		seen.add(r.items[0].id);
	}
	assert.equal(seen.size, n);
});

test('emitCombat is a no-op outside the browser', () => {
	emitCombat({ kind: 'hit', damage: 2, killed: false });
	emitCombat({ kind: 'hurt', amount: 3 });
	emitCombat({ kind: 'heal', amount: 35 });
});
