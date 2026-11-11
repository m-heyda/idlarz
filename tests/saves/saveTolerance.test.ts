// A save or a ledger row written by an older (or newer) release must degrade, not die: what this version does not know is dropped, what is over a changed limit is cut, what is missing gets a default.
// Structural damage (a map that is not a map, a number that is not a number) is still refused. See docs/plan/save-compatibility.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, rawSnapshot, setLandAt } from '../helpers';
import { sanitizeSave } from '../../src/lib/sanitizeSave';
import { RESOURCE_CAP } from '../../src/config/economy';
import { MERCHANT_UPGRADES } from '../../src/config/merchant';
import { EMBER_UPGRADES } from '../../src/config/rebirth';
import { emberSpent } from '../../src/utils/game/rebirth';
import { totalStatPoints } from '../../src/utils/game/character';
import { CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import { plainItem } from '../../src/lib/itemInstance';
import { readCombat, readInventory } from '../../src/lib/offline/ledgerRead';
import { freshCombat } from '../../src/lib/offline/fightTypes';
import { ledgerFromRow, type LedgerRow } from '../../src/lib/offline/supabaseLedger';

const game = () => {
	freshGame();
	growTo(10);
	api().tick(60_000);
	return rawSnapshot();
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const load = (mutate: (raw: any) => void) => {
	const raw = game();
	mutate(raw);
	const result = sanitizeSave(raw);
	assert.equal(result.ok, true, result.ok ? '' : result.reason);
	return result.ok ? result.state : (null as never);
};

test('a resource this save has never heard of is 0; only gold and XP must be there', () => {
	const state = load((r) => {
		delete r.resources.coal;
		delete r.resources.wool;
		delete r.resources.pearls;
	});
	assert.equal(state.resources.coal, 0);
	assert.equal(sanitizeSave({ ...game(), resources: { ...game().resources, gold: undefined } }).ok, false, 'gold is required');
	assert.equal(sanitizeSave({ ...game(), resources: { ...game().resources, xp: undefined } }).ok, false, 'xp is required');
});

test('unknown keys are ignored: on the save, on a land entry, on a merchant stock', () => {
	const state = load((r) => {
		r.somethingFromTheFuture = { a: 1 };
		r.land[0].glow = 'blue';
		r.merchantStock = { at: 0, offers: [], future: 1 };
	});
	assert.equal('somethingFromTheFuture' in state, false);
});

test('unknown ids are dropped: upgrades, animals, loot tables (the rest of the save stays)', () => {
	const state = load((r) => {
		r.merchantUpgrades = { haggler: 2, retiredPerk: 4 };
		r.farmUpgrades = { retiredBarn: 1 };
		r.farmLevels = { chicken: 3, dragon: 2 };
		r.lootPity = { 'boss:retired': 5 };
		r.prestige = { rebirths: 0, legacyPoints: 0, legacyEarned: 0, upgrades: { retired: 3 } };
	});
	assert.deepEqual(state.merchantUpgrades, { haggler: 2 });
	assert.deepEqual(state.farmUpgrades, {});
	assert.deepEqual(state.farmLevels, { chicken: 3 });
	assert.deepEqual(state.lootPity, {});
});

test('a level above a lowered maximum is cut to it, never refused', () => {
	const max = MERCHANT_UPGRADES.haggler.maxLevel;
	const state = load((r) => (r.merchantUpgrades = { haggler: max + 5 }));
	assert.equal(state.merchantUpgrades.haggler, max);
	const castle = load((r) => (r.castleUpgrade = { toLevel: 2, remainingSec: 1e8 }));
	assert.ok((castle.castleUpgrade?.remainingSec ?? 1e9) < 1e8, 'a timer longer than the duration is cut');
});

test('HP and mana above the maximum (a lowered max, gear no longer worn) are cut to it', () => {
	const state = load((r) => {
		r.playerHp = 1e9;
		r.playerMp = 1e9;
	});
	assert.ok(state.playerHp < 1e6);
	assert.ok(state.playerMp < 1e6);
});

test('the level pays the stat points: too few are credited, too many are a free respec (a rebalanced rule never refuses a save)', () => {
	const sum = (s: ReturnType<typeof load>) =>
		s.characterStats.strength +
		s.characterStats.dexterity +
		s.characterStats.intelligence +
		s.characterStats.vitality +
		s.characterStats.charisma +
		s.characterStats.availablePoints;
	const honest = load(() => undefined);
	const few = load((r) => (r.characterStats.availablePoints = 0));
	assert.equal(sum(few), sum(honest), 'credited up to what the level pays');
	const many = load((r) => (r.characterStats.strength += 500));
	assert.equal(many.characterStats.availablePoints, totalStatPoints(many.level.level), 'every point back, unspent');
	assert.equal(sum(many), sum(honest));
});

test('XP below what the tiles paid for is lifted to it', () => {
	const state = load((r) => (r.resources.xp = 0));
	assert.ok(state.resources.xp > 0);
});

test('Embers: an upgrade that is gone gives its Embers back, a changed price is absorbed by the balance, a shop dearer than everything earned is still refused', () => {
	const id = Object.keys(EMBER_UPGRADES)[0] as keyof typeof EMBER_UPGRADES;
	const gone = load((r) => (r.prestige = { rebirths: 1, legacyPoints: 0, legacyEarned: 10, upgrades: { retired: 2 } }));
	assert.equal(gone.prestige.legacyPoints, 10, 'its Embers are unspent again');
	const priced = load((r) => (r.prestige = { rebirths: 1, legacyPoints: 3, legacyEarned: 10, upgrades: { [id]: 1 } }));
	assert.equal(priced.prestige.legacyPoints + emberSpent(priced.prestige.upgrades), 10, 'earned = unspent + spent');
	const raw = game();
	raw.prestige = { rebirths: 1, legacyPoints: 0, legacyEarned: 1, upgrades: { [id]: EMBER_UPGRADES[id].maxLevel } };
	assert.equal(sanitizeSave(raw).ok, false);
});

test('a piece of gear that is no longer valid is dropped, the rest of the bag and the gear stay', () => {
	const state = load((r) => {
		r.bag[0] = { item: plainItem('obsidian_cuirass') };
		r.bag[1] = { item: { ...plainItem('obsidian_cuirass'), base: 'removed_in_a_later_release' } };
		r.bag[2] = { id: 'removed_potion', qty: 3 };
		r.equipment.head = { ...plainItem('leather_cap'), base: 'removed_in_a_later_release' };
	});
	assert.deepEqual(state.bag[1], null);
	assert.deepEqual(state.bag[2], null);
	assert.ok(state.bag[0] && 'item' in state.bag[0]);
	assert.equal(state.equipment.head, undefined);
});

test('structural damage is still refused', () => {
	assert.equal(sanitizeSave({ ...game(), land: 'nonsense' }).ok, false);
	assert.equal(sanitizeSave({ ...game(), resources: { ...game().resources, gold: RESOURCE_CAP * 10 } }).ok, false);
	assert.equal(sanitizeSave({ ...game(), resources: 'lots' }).ok, false);
	const raw = game();
	setLandAt(raw, CASTLE_X + 1, CASTLE_Y, { biome: 'a_biome_this_version_lacks' });
	assert.equal(sanitizeSave(raw).ok, false, 'a tile cannot be dropped without breaking the map: biomes are append-only (appendOnly.test.ts)');
});

test('ledger inventory: unknown ids are dropped, the version goes up so the browser takes the cleaned bag', () => {
	const inv = readInventory({
		ver: 4,
		bag: [{ id: 'potion_minor', qty: 5 }, { id: 'gone', qty: 1 }, { item: { ...plainItem('leather_cap'), base: 'gone' } }, null],
		equipment: { head: plainItem('leather_cap'), chest: { ...plainItem('leather_cap'), base: 'gone' }, mainHand: 'junk' },
		lootPity: { 'boss:future': 2, bad: 'x' },
		autoSellUpTo: 'mythic_of_the_future',
	});
	assert.ok(inv);
	assert.equal(inv.ver, 5);
	assert.deepEqual(inv.bag, [{ id: 'potion_minor', qty: 5 }, null, null, null]);
	assert.deepEqual(Object.keys(inv.equipment), ['head']);
	assert.deepEqual(inv.lootPity, { 'boss:future': 2 }, 'unknown pity tables are kept (a later release may bring them back)');
	assert.equal(inv.autoSellUpTo, null);
	const clean = readInventory({ ver: 4, bag: [null], equipment: {}, lootPity: {}, autoSellUpTo: null });
	assert.equal(clean?.ver, 4, 'nothing dropped, same version');
	assert.equal(readInventory(null), null);
	assert.equal(readInventory({ bag: 'x' }), null);
});

test('ledger combat: an open fight against a monster this version lacks is closed, lists default, the vitals stay', () => {
	const base = freshCombat(1000, 50, 20);
	const fight = { n: 1, type: 'a_monster_from_the_future', level: 1 };
	const read = readCombat({ ...base, fight, queue: undefined, log: 'broken', cd: undefined, retryAt: { a: 'x', '2': 5 } });
	assert.ok(read);
	assert.equal(read.fight, null);
	assert.deepEqual(read.queue, []);
	assert.deepEqual(read.log, []);
	assert.deepEqual(read.retryAt, { '2': 5 });
	assert.equal(read.hp, 50);
	assert.equal(readCombat({ hp: 'x' }), null);
	assert.equal(readCombat(null), null);
});

test('a ledger row with damaged columns still loads: every column falls back to empty', () => {
	const ledger = ledgerFromRow({
		ver: 3,
		run_id: 1,
		rebirths: 0,
		anchor_at: '2026-11-11T00:00:00.000Z',
		reset_at: null,
		bank: 'garbage',
		ord_chest: 0,
		ord_kill: 0,
		granted: { gold: 5, brandNewResource: 9 },
		granted_seen: {},
		gems: 10,
		last_key: null,
		last_result: null,
		combat: 'garbage',
		inv: { bag: 'garbage' },
		craft: 'garbage',
		buffs: 'garbage',
		stats: 'garbage',
	} as unknown as LedgerRow);
	assert.equal(ledger.combat, null);
	assert.equal(ledger.inv, null);
	assert.equal(ledger.granted.gold, 5);
	assert.deepEqual(ledger.buffs, []);
	assert.deepEqual(ledger.bank.chests, []);
});
