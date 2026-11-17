import test from 'node:test';
import assert from 'node:assert/strict';
import { SHOP_VERSION } from '../../src/config/rebirth';
import { refundOldShop } from '../../src/lib/emberShopMigration';
import { autoUseUnlocked } from '../../src/lib/combat';
import { emberOwned } from '../../src/utils/game/rebirth';
import type { PrestigeState } from '../../src/types/game';

const old = (over: Partial<PrestigeState> = {}): PrestigeState => ({ rebirths: 3, legacyPoints: 5, legacyEarned: 60, upgrades: { thrift: 4, mastery: 6 }, ...over });

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
