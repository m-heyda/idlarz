import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, setResources } from './helpers';
import { ANIMALS, FARM, FARM_PEN, FARM_UPGRADES, type FarmUpgradeId } from '../src/config/gameConfig';
import {
	affordableAnimals,
	animalBatchCost,
	calculateAnimalCost,
	calculateFarmOutput,
	farmCap,
	farmUpgradeCost,
} from '../src/utils/gameUtils';

const chicken = ANIMALS.find((a) => a.id === 'chicken')!;
const cow = ANIMALS.find((a) => a.id === 'cow')!;

test('every animal yields meat plus a farm product', () => {
	for (const animal of ANIMALS) {
		const out = calculateFarmOutput({ [animal.id]: 3 });
		assert.ok(out.meat > 0, `${animal.id} meat`);
		assert.ok(out[animal.product.resource] > 0, `${animal.id} ${animal.product.resource}`);
	}
	assert.deepEqual(
		ANIMALS.map((a) => a.product.resource).sort(),
		['eggs', 'hide', 'hide', 'milk']
	);
});

test('a product is a small share of the meat value once sold (so the farm stays balanced)', () => {
	const price = { eggs: 2, milk: 3, hide: 4 };
	for (const animal of ANIMALS) {
		const meat = animal.baseProduction * 1; // sells for 1 gold per meat
		const product = animal.product.perSec * price[animal.product.resource];
		assert.ok(product / meat >= 0.2 && product / meat <= 0.4, `${animal.id}: ${(product / meat).toFixed(2)}`);
	}
});

test('buying animals in a batch costs exactly the sum of single purchases', () => {
	let sum = 0;
	for (let i = 0; i < 10; i++) sum += calculateAnimalCost(chicken, i);
	assert.equal(animalBatchCost(chicken, 0, 10), sum);
	assert.equal(affordableAnimals(chicken, 0, sum, 99), 10);
	assert.equal(affordableAnimals(chicken, 0, sum - 1, 99), 9);
	assert.equal(affordableAnimals(chicken, 0, 1e15, 4), 4); // the cap wins
	assert.equal(affordableAnimals(chicken, 3, 1e15, 99, 5), 5); // so does the wanted count
});

test('purchaseAnimal: x10 is all or nothing, max takes what food allows, the pen caps each kind', () => {
	freshGame();
	setResources({ food: animalBatchCost(chicken, 0, 10) - 1 });
	assert.equal(api().purchaseAnimal('chicken', 10), 0);
	assert.equal(api().farmLevels.chicken ?? 0, 0);
	assert.equal(api().purchaseAnimal('chicken', 'max'), 9);
	assert.equal(api().farmLevels.chicken, 9);

	setResources({ food: 1e18 });
	assert.equal(api().purchaseAnimal('chicken', 'max'), FARM.baseCap - 9);
	assert.equal(api().farmLevels.chicken, FARM.baseCap);
	assert.equal(api().purchaseAnimal('chicken'), 0, 'the pen is full');
	assert.equal(api().purchaseAnimal('chicken', 0), 0);
	assert.equal(api().purchaseAnimal('chicken', 1.5), 0);
	assert.equal(api().purchaseAnimal('chicken', -2), 0);
});

test('farm products accumulate in the resource rates and respect the global modifiers', () => {
	freshGame();
	setResources({ food: 1e18 });
	api().purchaseAnimal('chicken', 5);
	api().purchaseAnimal('cow', 2);
	const { total, base } = api().resourceRates;
	assert.ok(Math.abs(base.eggs - 5 * chicken.product.perSec) < 1e-12);
	assert.ok(Math.abs(base.milk - 2 * cow.product.perSec) < 1e-12);
	assert.ok(total.eggs >= base.eggs && total.milk >= base.milk);
	const before = api().resources.eggs;
	api().tick(10_000);
	assert.ok(api().resources.eggs > before);
});

test('farm upgrades: each level costs more, raises the right output and is paid in resources', () => {
	freshGame();
	setResources({ food: 1e12, wood: 1e12, stone: 1e12, coal: 1e12, eggs: 1e9, milk: 1e9, hide: 1e9 });
	api().purchaseAnimal('chicken', 5);
	const meat0 = api().resourceRates.base.meat;
	const eggs0 = api().resourceRates.base.eggs;

	const foodBefore = api().resources.food;
	assert.equal(api().buyFarmUpgrade('feed'), true);
	assert.equal(foodBefore - api().resources.food, farmUpgradeCost('feed', 0).food);
	assert.ok(Math.abs(api().resourceRates.base.meat - meat0 * (1 + FARM_UPGRADES.feed.effectPerLevel)) < 1e-9);
	assert.equal(api().resourceRates.base.eggs, eggs0, 'feed does not touch eggs');

	assert.equal(api().buyFarmUpgrade('coop'), true);
	assert.ok(Math.abs(api().resourceRates.base.eggs - eggs0 * (1 + FARM_UPGRADES.coop.effectPerLevel)) < 1e-12);

	for (const id of Object.keys(FARM_UPGRADES) as FarmUpgradeId[]) {
		const a = farmUpgradeCost(id, 0);
		const b = farmUpgradeCost(id, 1);
		for (const key of Object.keys(a) as (keyof typeof a)[]) assert.ok(b[key]! > a[key]!, `${id} ${key}`);
	}
});

test('farm upgrades stop at their max level and cannot be bought without the resources', () => {
	freshGame();
	assert.equal(api().buyFarmUpgrade('feed'), false);
	assert.equal(api().buyFarmUpgrade('nope' as FarmUpgradeId), false);
	setResources({ food: 1e30, wood: 1e30, stone: 1e30 });
	for (let i = 0; i < FARM_UPGRADES.pen.maxLevel; i++) assert.equal(api().buyFarmUpgrade('pen'), true);
	assert.equal(api().buyFarmUpgrade('pen'), false);
	assert.equal(api().farmUpgrades.pen, FARM_UPGRADES.pen.maxLevel);
});

test('Pen Expansion raises the per-kind cap and all farm output', () => {
	freshGame();
	setResources({ food: 1e30, wood: 1e12, stone: 1e12 });
	assert.equal(farmCap(api().farmUpgrades), FARM.baseCap);
	api().purchaseAnimal('chicken', 'max');
	assert.equal(api().farmLevels.chicken, FARM.baseCap);
	const meat0 = api().resourceRates.base.meat;
	assert.equal(api().buyFarmUpgrade('pen'), true);
	assert.equal(farmCap(api().farmUpgrades), FARM.baseCap + FARM_PEN.capPerLevel);
	assert.ok(Math.abs(api().resourceRates.base.meat - meat0 * (1 + FARM_PEN.outputPerLevel)) < 1e-9);
	assert.equal(api().purchaseAnimal('chicken', 'max'), FARM_PEN.capPerLevel);
});

test('second-tier products come at a brisk pace: a full pen of chickens pays the first Hen House in two minutes, and the upgrades give +15 % per level', () => {
	const eggsPerSec = calculateFarmOutput({ chicken: FARM.baseCap }).eggs;
	assert.ok(eggsPerSec >= 0.35, `${eggsPerSec} eggs/s from a full coop`);
	assert.ok((farmUpgradeCost('coop', 0).eggs ?? 0) / eggsPerSec <= 120, 'the first Hen House level costs under two minutes of a full coop');
	for (const [id, resource, animal] of [['coop', 'eggs', 'chicken'], ['dairy', 'milk', 'cow'], ['tannery', 'hide', 'pig']] as const) {
		const base = calculateFarmOutput({ [animal]: 4 })[resource];
		const maxed = calculateFarmOutput({ [animal]: 4 }, { [id]: 10 })[resource];
		assert.ok(Math.abs(maxed / base - 2.5) < 1e-9, `${id}: ${maxed / base}`);
	}
});
