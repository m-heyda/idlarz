import test from 'node:test';
import assert from 'node:assert/strict';
import { levelAtAge } from '../../src/lib/monsters';
import { newLedger } from '../../src/lib/offline/ledger';
import { emptyBank } from '../../src/lib/offline/tickets';
import { inventoryFromCore } from '../../src/lib/offline/inventory';
import { growthLimits } from '../../src/lib/offline/prestigeOfCore';
import { queueView } from '../../src/lib/offline/fightTargets';
import { payKill } from '../../src/lib/offline/reward';
import type { StoredSave } from '../../src/lib/cloudSave/pipeline';
import type { PrestigeState } from '../../src/types/game';

// Wild Growth (Ember shop) shortens the monster growth interval, and the browser shows that level. Every server read of a monster's level
// (the queue's win estimate, the fight, the payout) must use the same prestige, or the upgrade only changes the picture.

const T = 1_800_000_000_000;
const AGE = 3000;
const prestige = (wildgrowth: number): PrestigeState => ({ rebirths: 1, legacyPoints: 0, legacyEarned: 0, upgrades: { wildgrowth } });
const storedWith = (wildgrowth: number) =>
	({
		core: { prestige: prestige(wildgrowth) },
		summary: { rates: { gold: 10, xp: 5, hide: 0 }, xpGainPct: 0, derived: { luck: 0, goldFind: 0, killRewardPct: 0 } },
	}) as unknown as StoredSave;
const ledgerWith = (stored: StoredSave) => ({
	...newLedger(T),
	inv: inventoryFromCore(stored.core),
	bank: { ...emptyBank(T / 1000), monsters: [{ n: 1, at: T / 1000 - AGE, kind: 'normal' as const, lucky: false, spawnLevel: 10, x: 1, y: 1 }] },
});

test("growthLimits carries the stored save's Embers into the growth interval", () => {
	assert.equal(levelAtAge(10, AGE, growthLimits(storedWith(0))), 13, '3000 s at 900 s per level');
	assert.equal(levelAtAge(10, AGE, growthLimits(storedWith(10))), 20, 'Wild Growth 10: 300 s per level');
});

test('the queue view shows the level Wild Growth earned', () => {
	const stored = storedWith(10);
	const ledger = ledgerWith(stored);
	const at = T / 1000;
	const view = queueView({ ...ledger } as never, { at, queue: [1] } as never, () => 50, growthLimits(stored));
	assert.equal(view[0].level, 20);
	assert.equal(queueView({ ...ledger } as never, { at, queue: [1] } as never, () => 50)[0].level, 13, 'without the context it is the base interval');
});

test('a kill pays at the level Wild Growth earned', () => {
	const level = (wildgrowth: number) => {
		const stored = storedWith(wildgrowth);
		const paid = payKill('wild-secret-wild-secret', 'u1', ledgerWith(stored) as never, stored, 1, T / 1000);
		assert.ok(paid);
		return paid!.payout.level;
	};
	assert.equal(level(0), 13);
	assert.equal(level(10), 20);
});
