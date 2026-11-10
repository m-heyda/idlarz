// The farm: animal costs and output, pen and upgrades (part of the former utils/gameUtils.ts, split in IDL-15).
import { ANIMALS, FARM, FARM_PEN, FARM_UPGRADES, type FarmUpgradeId } from '@/config/farm';
import type { Animal, Resources } from '@/types/game';

/**
 * Food cost of the next animal of a kind when `level` of them are owned: `floor(baseCost x costScaling^level)`.
 *
 *
 * @category Economy/Farm
 * @order 4
 * @formula
 * cost = floor(baseCost x costScaling^owned)
 */
export const calculateAnimalCost = (animal: Animal, level: number): number => {
	return Math.floor(animal.baseCost * Math.pow(animal.costScaling, level));
};

export type FarmUpgrades = Partial<Record<string, number>>;

export const farmUpgradeLevel = (upgrades: FarmUpgrades | undefined, id: FarmUpgradeId): number =>
	Math.max(0, Math.min(FARM_UPGRADES[id].maxLevel, Math.floor(upgrades?.[id] ?? 0)));

/** Animals of one kind the pen holds (the base cap plus Pen Expansion). A save with more is never trimmed. */
export const farmCap = (upgrades: FarmUpgrades | undefined): number => FARM.baseCap + farmUpgradeLevel(upgrades, 'pen') * FARM_PEN.capPerLevel;

/**
 * Cost of the next level of a farm upgrade, given its current level (one entry per resource).
 *
 * @category Economy/Farm
 * @order 5
 * @formula
 * cost[r] = ceil(base[r] x growth^level)          per resource of the upgrade
 */
export const farmUpgradeCost = (id: FarmUpgradeId, level: number): Partial<Resources> => {
	const def = FARM_UPGRADES[id];
	const out: Partial<Resources> = {};
	for (const [resource, base] of Object.entries(def.cost)) {
		out[resource as keyof Resources] = Math.ceil((base as number) * Math.pow(def.costGrowth, level));
	}
	return out;
};

/** Everything the farm yields per second before the global modifiers: meat plus the products. */
export type FarmOutput = Record<'meat' | 'eggs' | 'milk' | 'hide' | 'wool', number>;

const emptyOutput = (): FarmOutput => ({ meat: 0, eggs: 0, milk: 0, hide: 0, wool: 0 });

/**
 * Output of `count` animals of one kind (every purchase adds one more animal).
 *
 * Output of N animals of one kind. Meat uses Feed Trough, the products use their own upgrade and Pasture.
 *
 * @category Economy/Farm
 * @order 2
 * @formula
 * meat    = baseProduction x N x (1 + 0.02 x pen level) x (1 + 0.05 x feed trough level)
 * product = perSec x N x (1 + 0.02 x pen level) x (1 + coop | dairy | tannery | shearing effect) x (1 + 0.08 x pasture level)
 */
export const animalOutput = (animal: Animal, count: number, upgrades?: FarmUpgrades): FarmOutput => {
	const out = emptyOutput();
	if (count <= 0) return out;
	const pen = 1 + farmUpgradeLevel(upgrades, 'pen') * FARM_PEN.outputPerLevel;
	const up = (id: FarmUpgradeId) => 1 + farmUpgradeLevel(upgrades, id) * FARM_UPGRADES[id].effectPerLevel;
	out.meat = animal.baseProduction * count * pen * up('feed');
	const productUpgrade: Record<Animal['product']['resource'], FarmUpgradeId> = { eggs: 'coop', milk: 'dairy', hide: 'tannery', wool: 'shearing' };
	out[animal.product.resource] = animal.product.perSec * count * pen * up(productUpgrade[animal.product.resource]) * up('pasture');
	return out;
};

// Meat/s of `level` animals of one kind (every purchase adds one more animal)
export const calculateAnimalProduction = (animal: Animal, level: number, upgrades?: FarmUpgrades): number => animalOutput(animal, level, upgrades).meat;

/**
 * The whole farm's output per second: the sum of {@link animalOutput} over the animal kinds. The merchant's Skinner multiplies meat and hide afterwards ({@link calculateResourceBreakdown}).
 *
 * @category Economy/Farm
 * @order 6
 */
export const calculateFarmOutput = (farmLevels: Record<string, number>, upgrades?: FarmUpgrades): FarmOutput => {
	const total = emptyOutput();
	ANIMALS.forEach((animal) => {
		const out = animalOutput(animal, farmLevels[animal.id] || 0, upgrades);
		(Object.keys(total) as (keyof FarmOutput)[]).forEach((k) => (total[k] += out[k]));
	});
	return total;
};

/** Total cost of buying `count` more animals of one kind, starting from `owned` (each costs more than the last). */
export const animalBatchCost = (animal: Animal, owned: number, count: number): number => {
	let total = 0;
	for (let i = 0; i < count; i++) total += calculateAnimalCost(animal, owned + i);
	return total;
};

/** How many animals of one kind `food` pays for, up to the pen cap (`want` limits it further when given). */
export const affordableAnimals = (animal: Animal, owned: number, food: number, cap: number, want = Infinity): number => {
	let n = 0;
	let spent = 0;
	while (owned + n < cap && n < want) {
		const next = calculateAnimalCost(animal, owned + n);
		if (spent + next > food) break;
		spent += next;
		n++;
	}
	return n;
};

/** True when the farm has something to buy right now: one more animal (below the pen cap) or the next level of an upgrade. */
export const farmHasPurchase = (
	resources: Pick<Resources, 'food' | 'wood' | 'stone' | 'coal' | 'meat' | 'eggs' | 'milk' | 'hide' | 'wool' | 'gold'>,
	farmLevels: Record<string, number>,
	farmUpgrades: FarmUpgrades | undefined,
): boolean => {
	const cap = farmCap(farmUpgrades);
	if (ANIMALS.some((a) => affordableAnimals(a, farmLevels[a.id] || 0, resources.food, cap, 1) > 0)) return true;
	return (Object.keys(FARM_UPGRADES) as FarmUpgradeId[]).some((id) => {
		const level = farmUpgradeLevel(farmUpgrades, id);
		if (level >= FARM_UPGRADES[id].maxLevel) return false;
		return Object.entries(farmUpgradeCost(id, level)).every(([resource, price]) => (resources[resource as keyof typeof resources] ?? 0) >= (price ?? 0));
	});
};
