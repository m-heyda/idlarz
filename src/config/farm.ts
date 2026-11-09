// The farm: animals, pen and farm upgrades.
// Part of the former gameConfig.ts (split in IDL-15); the values are unchanged.
import { Animal, Resources } from '@/types/game';
import { FARM_KEYS, type FarmKey } from '@/catalog/resourceKeys';

// Farm products: shown on the farm and at the merchant, not in the header row
export const FARM_PRODUCT_KEYS = FARM_KEYS.filter((key): key is Exclude<FarmKey, 'meat'> => key !== 'meat'); // the farm's products without meat (meat is bought with food, the rest only earned)

// Farm animal configurations
/**
 * The farm: animals are bought with food. The N-th animal of a kind costs `floor(baseCost x costScaling^owned)` ({@link calculateAnimalCost}); a pen holds 12 per kind (`FARM.baseCap`), +4 per Pen Expansion level.
 *
 * @category Economy/Farm
 * @order 1
 * @table farm-animals
 */
export const ANIMALS: Animal[] = [
	{
		id: 'chicken',
		name: 'Chicken',
		description: 'A simple farm animal that produces a small amount of meat.',
		baseCost: 1000, // the first chicken is within reach after about half an hour (a few dozen tiles)
		costScaling: 1.3, // each purchase costs this much more than the previous one
		baseProduction: 0.2, // meat per second per animal; each purchase adds one more animal
		product: { resource: 'eggs', perSec: 0.03 },
	},
	{
		id: 'deer',
		name: 'Deer',
		description: 'A wild animal that produces more meat than a chicken.',
		baseCost: 10000,
		costScaling: 1.33,
		baseProduction: 0.5,
		product: { resource: 'hide', perSec: 0.075 },
	},
	{
		id: 'pig',
		name: 'Pig',
		description: 'A domestic animal that produces a good amount of meat.',
		baseCost: 60000,
		costScaling: 1.36,
		baseProduction: 1,
		product: { resource: 'hide', perSec: 0.15 },
	},
	{
		id: 'cow',
		name: 'Cow',
		description: 'A large animal that produces a significant amount of meat.',
		baseCost: 400000,
		costScaling: 1.4,
		baseProduction: 2,
		product: { resource: 'milk', perSec: 0.225 },
	},
];

/**
 * The farm: every animal yields meat plus a small trickle of a product (eggs, milk, hide, worth about a third of the meat
 * once sold). Products were 50 % slower (and their upgrade bonuses 33 % smaller) until the second-tier resources felt too
 * slow to earn; the merchant prices were lowered by the same factor, so a product still sells for the same share of its
 * animal's meat and gold income is unchanged: the products themselves, and what they unlock, come faster.
 * Upgrades raise the output and the per-kind animal cap. Cost of level N+1 = base x growth^N, per resource.
 * Prices: the first animal of each kind is a milestone (chicken ~30 min, deer / pig / cow over the first days) and the costs
 * then climb gently enough that a full pen (12 of a kind, 44 with every Pen Expansion) is a goal for weeks, not a wall.
 */
export const FARM = {
	baseCap: 12, // animals of one kind the pen holds before it is expanded
	unitsDrawn: 8, // most sprites drawn per kind in the pen (the animal panel shows the real count)
};

// Pen Expansion: per level, every animal kind may hold `capPerLevel` more animals and all farm output grows
export const FARM_PEN = { outputPerLevel: 0.02, capPerLevel: 4 };

/**
 * Farm upgrades: the cost of level N+1 is `ceil(base x growth^N)` per resource ({@link farmUpgradeCost}). Pen Expansion adds +2% farm output and +4 animals per kind (8 levels, growth 1.9);
 * the others have 10 levels and growth 1.6.
 *
 * @category Economy/Farm
 * @order 3
 * @table farm-upgrades
 */
export const FARM_UPGRADES = {
	feed: {
		label: 'Feed Trough',
		description: (n: number) => `+${Math.round(n * 5)}% meat`,
		maxLevel: 10,
		effectPerLevel: 0.05, // meat
		cost: { food: 2000 } as Partial<Record<keyof Resources, number>>,
		costGrowth: 1.6,
	},
	coop: {
		label: 'Hen House',
		description: (n: number) => `+${Math.round(n * 15)}% eggs`,
		maxLevel: 10,
		effectPerLevel: 0.15, // eggs
		cost: { wood: 1500, eggs: 40 } as Partial<Record<keyof Resources, number>>,
		costGrowth: 1.6,
	},
	dairy: {
		label: 'Dairy',
		description: (n: number) => `+${Math.round(n * 15)}% milk`,
		maxLevel: 10,
		effectPerLevel: 0.15, // milk
		cost: { stone: 1500, milk: 30 } as Partial<Record<keyof Resources, number>>,
		costGrowth: 1.6,
	},
	tannery: {
		label: 'Tannery',
		description: (n: number) => `+${Math.round(n * 25)}% hide`,
		maxLevel: 10,
		effectPerLevel: 0.25, // hide: the one farm product the big territories are paid in (TILE_RESOURCE_COST)
		cost: { coal: 1200, hide: 20 } as Partial<Record<keyof Resources, number>>,
		costGrowth: 1.6,
	},
	pasture: {
		label: 'Pasture',
		description: (n: number) => `+${Math.round(n * 8)}% eggs, milk and hide`,
		maxLevel: 10,
		effectPerLevel: 0.08, // eggs, milk and hide together, on top of Hen House / Dairy / Tannery
		cost: { food: 5000, wood: 2500 } as Partial<Record<keyof Resources, number>>,
		costGrowth: 1.6,
	},
	pen: {
		label: 'Pen Expansion',
		description: (n: number) => `+${Math.round(n * FARM_PEN.outputPerLevel * 100)}% farm output, +${n * FARM_PEN.capPerLevel} animals per kind`,
		maxLevel: 8,
		effectPerLevel: FARM_PEN.outputPerLevel,
		cost: { food: 8000, wood: 3000, stone: 3000 } as Partial<Record<keyof Resources, number>>,
		costGrowth: 1.9,
	},
} as const;
export type FarmUpgradeId = keyof typeof FARM_UPGRADES;
