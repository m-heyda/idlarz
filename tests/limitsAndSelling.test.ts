import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, setResources, store } from './helpers';
import { LIMITS } from '../src/config/limits';
import { emptyBag, gearOf } from '../src/lib/inventory';
import { plainItem, sellValueOf } from '../src/lib/itemInstance';
import { limitOf, LIMIT_BONUSES } from '../src/lib/limits';
import { generateMerchantStock } from '../src/lib/merchant';
import { receiveDrops } from '../src/lib/loot';
import { MERCHANT_RESOURCE_PRICES } from '../src/config/gameConfig';
import { globalMenuItems } from '../src/lib/globalMenu';
import { SELL_BONUSES, sellMultiplier, sellPayout } from '../src/utils/gameUtils';

// ---- limits are reusable ---------------------------------------------------------------------------------------------------------

test('limits: a bonus registered for a key reaches every reader (bag size, the merchant shelf)', () => {
	assert.equal(limitOf('bagSize'), LIMITS.bagSize);
	assert.equal(limitOf('bagSize', { merchantUpgrades: { packrat: 2 } }), LIMITS.bagSize + 8, 'Pack Rat goes through the same hook');
	const original = LIMIT_BONUSES.merchantOffers;
	LIMIT_BONUSES.merchantOffers = () => 2; // a future Ember effect
	try {
		assert.equal(limitOf('merchantOffers'), 8);
		assert.equal(generateMerchantStock(3, 20, () => 0.5, 0, {}).offers.length, 8);
	} finally {
		LIMIT_BONUSES.merchantOffers = original;
	}
	assert.equal(generateMerchantStock(3, 20, () => 0.5, 0, {}).offers.length, LIMITS.merchantOffers);
});

// ---- the sell bonus reaches everything the player sells -------------------------------------------------------------------------

test('a new sell bonus applies to resources, bag gear, junk, auto-sold drops and the previews alike', () => {
	const bonus = () => 0.2; // a future Ember effect
	SELL_BONUSES.push(bonus);
	try {
		assert.equal(sellMultiplier({}), 1.2);
		freshGame({ gold: 0 });
		setResources({ wood: 1000 });
		api().sellResources('wood', 1000);
		assert.equal(api().resources.gold, Math.floor(1000 * MERCHANT_RESOURCE_PRICES.wood * 1.2), 'resources');

		freshGame({ gold: 0 });
		const sword = plainItem('wooden_sword');
		const bag = emptyBag();
		bag[0] = { item: sword };
		store.setState({ bag });
		const paid = api().sellItem(0, 1);
		assert.equal(paid, Math.floor(sellValueOf(sword) * 1.2), 'a piece of gear from the bag');

		freshGame({ gold: 0 });
		const junkBag = emptyBag();
		junkBag[0] = { item: sword };
		junkBag[1] = { item: sword };
		store.setState({ bag: junkBag });
		const junk = api().sellJunk('common');
		assert.equal(junk.gold, 2 * Math.floor(sellValueOf(sword) * 1.2), 'junk');

		const received = receiveDrops(emptyBag(), [{ kind: 'gear', item: sword }], 'common', api());
		assert.equal(received.autoSold.gold, Math.floor(sellValueOf(sword) * 1.2), 'an auto-sold drop');

		assert.equal(sellPayout(10, 3, api()), Math.floor(30 * 1.2), 'the previews use the same function');
		assert.equal(gearOf(api().bag[0]), null);
	} finally {
		SELL_BONUSES.splice(SELL_BONUSES.indexOf(bonus), 1);
	}
	assert.equal(sellMultiplier({}), 1);
});

// ---- Organize is a bag function, in the global menu too -------------------------------------------------------------------------

test('the auto-battle entry is greyed out until the first rebirth', () => {
	freshGame();
	const locked = globalMenuItems().find((entry) => entry.id === 'autoBattle')!;
	assert.equal(locked.disabled, true);
	assert.match(locked.hint ?? '', /rebirth/);
	store.setState({ prestige: { ...api().prestige, rebirths: 1 } } as never);
	assert.equal(globalMenuItems().find((entry) => entry.id === 'autoBattle')!.disabled, false);
});

test('the global menu keeps the battle switches apart: a section of their own, at the bottom, above the view options', () => {
	freshGame();
	const ids = globalMenuItems().map((entry) => entry.id);
	assert.ok(ids.indexOf('autoBattle') > ids.indexOf('import'), 'after the save and bag entries');
	assert.equal(ids.indexOf('autoUse'), ids.indexOf('autoBattle') + 1);
	assert.equal(ids.indexOf('minimap'), ids.indexOf('autoUse') + 1, 'right above the view options');
	const items = globalMenuItems();
	assert.equal(items.find((entry) => entry.id === 'autoBattle')?.separator, true, 'a rule above the battle section');
	assert.equal(items.find((entry) => entry.id === 'minimap')?.separator, true, 'and one below it');
});

test('the global menu has an Organize bag entry that tidies the bag', () => {
	freshGame();
	const item = globalMenuItems().find((entry) => entry.id === 'organize');
	assert.ok(item, 'the entry is there');
	const bag = emptyBag();
	bag[3] = { id: 'potion_minor', qty: 1 };
	bag[7] = { id: 'potion_minor', qty: 1 };
	store.setState({ bag });
	item!.onSelect();
	assert.deepEqual(api().bag[0], { id: 'potion_minor', qty: 2 });
	assert.equal(api().bag[3], null);
});
