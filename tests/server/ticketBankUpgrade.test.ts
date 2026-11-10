import test from 'node:test';
import assert from 'node:assert/strict';
import { bossOf, emptyBank, normalsOf, upgradeStoredBank } from '../../src/lib/offline/tickets';

// IDL-7 / IDL-50: a bank stored before the new chapter (normal monsters in `rats`, the boss in `king`) is read into the one `monsters` list,
// so the deploy can go out before the reset and no in-flight monster is lost. Delete with the reader after the reset.

test('a bank stored with the old keys becomes one monsters list with kinds, timers and sites carried over', () => {
	const stored = {
		chestAcc: 10,
		ratAcc: 20,
		kingAcc: 30,
		accAt: 1000,
		chests: [{ n: 1, at: 5 }],
		rats: [
			{ n: 2, at: 6, lucky: true, x: 1, y: 2, spawnLevel: 3, type: 'thistleBoar' },
			{ n: 3, at: 7, lucky: false },
		],
		king: { n: 4, at: 8, lucky: false, x: 5, y: 6, spawnLevel: 16 },
		nextN: 5,
		ratsMinted: 2,
		sites: { rat: 9, king: 4, chest: 7 },
		sitesKey: 'k',
	};
	const bank = upgradeStoredBank(stored);
	assert.deepEqual(
		bank.monsters.map((t) => [t.n, t.kind]),
		[
			[2, 'normal'],
			[3, 'normal'],
			[4, 'boss'],
		],
	);
	assert.equal(normalsOf(bank).length, 2);
	assert.equal(bossOf(bank)?.n, 4);
	assert.deepEqual([bank.chestAcc, bank.monsterAcc, bank.bossAcc, bank.monstersMinted, bank.nextN, bank.accAt], [10, 20, 30, 2, 5, 1000]);
	assert.deepEqual(bank.sites, { monster: 9, boss: 4, chest: 7 });
	assert.equal(bank.sitesKey, 'k');
	assert.equal(bank.monsters[0].lucky, true, 'the golden flag survives');
	assert.equal(bank.chests.length, 1);
	for (const gone of ['rats', 'king', 'ratAcc', 'kingAcc', 'ratsMinted']) assert.equal(gone in bank, false, `${gone} is not carried over`);
});

test('a bank without a boss or with no tickets upgrades to empty lists', () => {
	assert.deepEqual(upgradeStoredBank({ ...emptyBank(0), rats: [], king: null }, 0).monsters, []);
	const noBoss = upgradeStoredBank({ ...emptyBank(0), rats: [{ n: 1, at: 0, lucky: false }], king: null });
	assert.equal(bossOf(noBoss), null);
	assert.equal(noBoss.monsters.length, 1);
});

test('a bank in the new shape, or no bank at all, is read as it is', () => {
	const fresh = { ...emptyBank(7), monsters: [{ n: 1, at: 0, kind: 'boss' as const, lucky: false }], bossAcc: 3 };
	assert.deepEqual(upgradeStoredBank(fresh), fresh);
	assert.deepEqual(upgradeStoredBank(null, 9), emptyBank(9));
});
