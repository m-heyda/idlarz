import test from 'node:test';
import assert from 'node:assert/strict';
import { MONSTERS } from '../../src/config/combatConfig';
import { CHEST } from '../../src/config/spawns';
import { killIncome } from '../../src/lib/loot/kill';

// The capped reward model (docs/plan/20-monster-families-and-rewards.md section 3): gold and XP = min(rewardSec x income, cap) x levelMult^(level - refLevel), then Luck, Gold Find, Kill Rewards %.

const rat = MONSTERS.thistleBoar;
const boss = MONSTERS.bossGreatAuroch;

test('below the cap a kill pays rewardSec seconds of income, at any level multiplier of 1.08 per level', () => {
	const ctx = { goldPerSec: 1, xpPerSec: 0.1, luck: 0 };
	assert.equal(rat.reward.levelMult, 1.08);
	assert.equal(killIncome({ type: 'thistleBoar', level: 1 }, ctx).gold, rat.reward.gold.rewardSec);
	const l10 = killIncome({ type: 'thistleBoar', level: 10 }, ctx);
	assert.equal(l10.gold, Math.floor(rat.reward.gold.rewardSec * 1.08 ** 9));
	assert.ok(Math.abs(l10.xp - 0.1 * rat.reward.xp.rewardSec * 1.08 ** 9) < 1e-9);
});

test('the cap binds at high income: the pay stops growing with the income', () => {
	const rich = { goldPerSec: 1e6, xpPerSec: 1e5, luck: 0 };
	const richer = { goldPerSec: 1e9, xpPerSec: 1e8, luck: 0 };
	const a = killIncome({ type: 'thistleBoar', level: 5 }, rich);
	const b = killIncome({ type: 'thistleBoar', level: 5 }, richer);
	assert.deepEqual(a, { ...a, gold: Math.floor(rat.reward.gold.cap * 1.08 ** 4) });
	assert.equal(a.gold, b.gold);
	assert.equal(a.xp, b.xp);
	assert.ok(Math.abs(a.xp - rat.reward.xp.cap * 1.08 ** 4) < 1e-9);
});

test('Luck, Gold Find and Kill Rewards % come after the cap', () => {
	const rich = { goldPerSec: 1e9, xpPerSec: 1e8 };
	const plain = killIncome({ type: 'thistleBoar', level: 1 }, { ...rich, luck: 0 });
	assert.equal(plain.gold, rat.reward.gold.cap);
	const luck = 100;
	const withLuck = killIncome({ type: 'thistleBoar', level: 1 }, { ...rich, luck });
	assert.equal(
		withLuck.gold,
		Math.floor(rat.reward.gold.cap * (1 + luck * CHEST.luckBonusPerPoint)),
		'Luck multiplies the capped pay, so it can exceed the cap',
	);
	assert.ok(withLuck.gold > rat.reward.gold.cap);
	assert.equal(killIncome({ type: 'thistleBoar', level: 1 }, { ...rich, luck: 0, goldFind: 50 }).gold, Math.floor(rat.reward.gold.cap * 1.5));
	const kr = killIncome({ type: 'thistleBoar', level: 1 }, { ...rich, luck: 0, killRewardPct: 50 });
	assert.equal(kr.gold, Math.floor(rat.reward.gold.cap * 1.5));
	assert.ok(Math.abs(kr.xp - rat.reward.xp.cap * 1.5) < 1e-9);
});

test('a boss keeps 3600 s of income and 1.03 per level, with a cap far above a normal monster', () => {
	assert.equal(boss.reward.gold.rewardSec, 3600);
	assert.equal(boss.reward.levelMult, 1.03);
	assert.ok(boss.reward.gold.cap > 1000 * rat.reward.gold.cap);
	const ctx = { goldPerSec: 10, xpPerSec: 1, luck: 0 };
	const l15 = killIncome({ type: 'bossGreatAuroch', level: boss.refLevel }, ctx);
	assert.equal(l15.gold, 36000);
	const l20 = killIncome({ type: 'bossGreatAuroch', level: boss.refLevel + 5 }, ctx);
	assert.equal(l20.gold, Math.floor(36000 * 1.03 ** 5));
});
