import test from 'node:test';
import assert from 'node:assert/strict';
import { SHOP_VERSION } from '../../src/config/rebirth';
import { refundOldShop, stampShopFromServer } from '../../src/lib/emberShopMigration';
import { sanitizeSave } from '../../src/lib/sanitizeSave';
import { api, freshGame, rawSnapshot, store, landAt } from '../helpers';
import { CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import { autoUseUnlocked } from '../../src/lib/combat';
import { emberOwned } from '../../src/utils/game/rebirth';
import type { PrestigeState } from '../../src/types/game';

const old = (over: Partial<PrestigeState> = {}): PrestigeState => ({
	rebirths: 3,
	legacyPoints: 5,
	legacyEarned: 60,
	upgrades: { thrift: 4, mastery: 6 },
	...over,
});

test('the old shop is refunded once: levels cleared, every earned Ember unspent, the income bonus untouched', () => {
	const refunded = refundOldShop(old());
	assert.deepEqual(refunded.upgrades, {});
	assert.equal(refunded.legacyPoints, 60);
	assert.equal(refunded.legacyEarned, 60);
	assert.equal(refunded.rebirths, 3);
	assert.equal(refunded.shopVersion, SHOP_VERSION);
});

test('it is idempotent: a migrated account (or an old client re-uploading it) is never refunded again', () => {
	const once = refundOldShop(old());
	const bought = { ...once, legacyPoints: 40, upgrades: { thrift: 2 } };
	assert.equal(refundOldShop(bought), bought, 'the same object comes back');
	assert.deepEqual(refundOldShop(refundOldShop(old())), refundOldShop(old()));
});

test('players who already rebirthed keep auto-potion for free; a new account has to buy it', () => {
	const rebirthed = refundOldShop(old());
	assert.deepEqual(rebirthed.grants, ['potion']);
	assert.equal(autoUseUnlocked(rebirthed.rebirths, rebirthed), true);
	assert.equal(emberOwned(rebirthed, 'potion'), true);
	assert.equal(rebirthed.upgrades.potion, undefined, 'a grant costs nothing and is not a shop level');
	const fresh: PrestigeState = { rebirths: 1, legacyPoints: 30, legacyEarned: 30, upgrades: {}, shopVersion: SHOP_VERSION };
	assert.equal(autoUseUnlocked(1, fresh), false);
	assert.equal(autoUseUnlocked(1, { ...fresh, upgrades: { potion: 1 } }), true);
	const never = refundOldShop({ rebirths: 0, legacyPoints: 0, legacyEarned: 0, upgrades: {} });
	assert.equal(never.grants, undefined, 'no rebirth, no grant');
});

test('grants and the shop generation come from the server, so an upload cannot give itself Potion Reflex', () => {
	const stored: PrestigeState = { rebirths: 1, legacyPoints: 30, legacyEarned: 30, upgrades: {}, shopVersion: SHOP_VERSION };
	const forged: PrestigeState = { ...stored, grants: ['potion'] };
	const stamped = stampShopFromServer(forged, stored);
	assert.equal(stamped.grants, undefined, 'the forged grant is dropped');
	assert.equal(autoUseUnlocked(1, stamped), false);
	// a real grant held by the server stays, even when the upload lost it
	const granted: PrestigeState = { ...stored, grants: ['potion'] };
	assert.deepEqual(stampShopFromServer({ ...stored }, granted).grants, ['potion']);
	assert.equal(stampShopFromServer(granted, granted), granted, 'nothing to change returns the same object');
	// an account the migration has not reached yet is judged by the migration rule, not stamped
	const unmigrated: PrestigeState = { rebirths: 2, legacyPoints: 5, legacyEarned: 40, upgrades: {} };
	assert.equal(stampShopFromServer(unmigrated, unmigrated), unmigrated);
	// a first save has no stored grants
	assert.equal(stampShopFromServer(forged, undefined).grants, undefined);
});

test('a granted one-time upgrade cannot be bought again, and Extra Builder is disabled until the second builder exists', () => {
	freshGame();
	store.setState((s) => ({ prestige: { ...s.prestige, rebirths: 1, legacyPoints: 500, legacyEarned: 500, grants: ['potion'] } }));
	assert.equal(api().buyEmberUpgrade('potion'), false);
	assert.equal(api().prestige.legacyPoints, 500, 'nothing is charged');
	assert.equal(api().buyEmberUpgrade('extrabuilder'), false);
	assert.equal(api().buyEmberUpgrade('vigil'), true, 'other one-time upgrades are still for sale');
});

test('a save cannot hold a castle upgrade to a level above the cap it paid for', () => {
	freshGame();
	const saved = rawSnapshot();
	landAt(saved, CASTLE_X, CASTLE_Y).level = 10;
	saved.castleUpgrade = { toLevel: 11, remainingSec: 1000 };
	assert.equal(sanitizeSave(saved).ok, false);
	saved.prestige = { rebirths: 1, legacyPoints: 0, legacyEarned: 100000, upgrades: { castlecap: 1 }, shopVersion: SHOP_VERSION };
	saved.prestige.legacyPoints = 0;
	assert.equal(sanitizeSave(saved).ok, true, 'with one Castle Expansion level, level 11 is allowed');
});
