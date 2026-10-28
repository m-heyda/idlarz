import {
	Animal,
	BiomeInfo,
	BiomeType,
	CharacterStats,
	Resources, // Added Resources import
} from '@/types/game';
import { RESOURCES, type MerchantResourceKey, type ResourceKey } from '@/catalog/resources';
import { shopItems } from '@/catalog/loot';
import { BIOME_COLORS } from '@/config/biomePalette';
import { HARD_LIMITS, LIMITS } from '@/config/limits';

// Default player name
export const DEFAULT_PLAYER_NAME = 'Explorer';

// Character stats initial values
export const INITIAL_CHARACTER_STATS: CharacterStats = {
	// Base Stats
	strength: 5,
	dexterity: 5,
	intelligence: 5,
	vitality: 5,
	charisma: 5,
	// Points to spent
	availablePoints: 0,
	// Derived stats (HP, attack, crit, XP gain, tile discount ...) start at 0 here and are always filled in by
	// calculateCombatStats() (createInitialData, addStatPoint, sanitizeSave), so there is one formula only.
	physicalAtk: 0,
	magicAtk: 0,
	hp: 0,
	mp: 0,
	def: 0,
luck: 0,
	critChance: 0,
	critDmgMultiplier: 0,
	atkSpeedIncrease: 0,
	xpGainMultiplier: 0,
	tileCostDiscount: 0,
	reputation: 1000, // Base reputation value
};

// Map. The map itself is unbounded (utils/world.ts): there is no grid size. The castle stays at its logical position, so
// old saves and the procedural art (which hashes absolute coordinates) are unchanged.
export const CASTLE_X = 25;
export const CASTLE_Y = 25;
/** The first saves stored the map as this square (castle in the middle); only the old save layout and test adapters still use it. */
export const LEGACY_GRID_SIZE = 50;

export const TILE_SIZE = 48; // Balanced for visibility

// Game Constants
export const TICK_RATE = 100; // 10 times per second
export const BASE_TILE_COST = 55; // Base cost for first tile purchase

// XP calculation constants - Exponential XP system
export const BASE_XP_PER_TILE = 45; // was 125 (pacing commit): tile XP is now the smaller part of a level, the curve below is fitted to what the bot earns

// The character level curve (xpToNextLevel / calculateLevel in utils/gameUtils.ts). Level and XP carry over a rebirth, so the curve is
// paced over rebirths, not days, and is written down as ANCHORS: the total XP at which a level is reached, measured with the sim bot
// (npm run sim hardcore-rebirth6-x10 logs lifetime XP and level; with the cheaper castle the hardcore bot rebirths at ~day 4, 7, 10, 12.5, 15 ... 25):
//   level 10 after ~4-5 h (XP 1.4e5), level ~30 around day 2 (1e8), the soft cap (80) around the 3rd rebirth (3e9),
//   level 90 around the 5th (6.5e9) and the maximum (100) around the 10th (1.85e10).
// Between two anchors the step to the next level grows by a constant factor, chosen so the total hits the anchor and the steps never
// shrink at a join; the first step is `firstStepXp`. Retune the anchors (not the code) when the sim's XP supply changes.
export const LEVELING = {
	maxLevel: 100,
	softCapLevel: 80,
	firstStepXp: 5000,
	// A level gives 1 attribute point; the levels up to `earlyBonusUntil` give `earlyBonusPoints` more. Levels are slower than they were, and
	// the points (Charisma, Intelligence ...) are what speeds the first days up, so the early levels pay extra to keep the pace of the first days.
	earlyBonusUntil: 30,
	earlyBonusPoints: 2,
	/** [level, total XP needed to reach it], increasing, ending at maxLevel */
	anchors: [
		[10, 1.4e5],
		[30, 1.0e8],
		[80, 3.0e9],
		[90, 6.5e9],
		[100, 1.85e10],
	] as readonly (readonly [number, number])[],
};
export const MAX_LEVEL = LEVELING.maxLevel;

export const SPECIAL_SINGLE_TYPE_BIOMES: BiomeType[] = ['castle'];
export const EMPTY_BIOMES: BiomeType[] = ['empty'];

// Hard limits shared by the tick loop and save validation
export const MAX_CATCHUP_SEC = 300; // one tick never advances the game by more than this (clock edits, device sleep)
// Every stockpile, XP included, stops here; a save above it is considered tampered. Raised from 1e15 so a map of tens of
// thousands of tiles stays buyable (see TILE_PRICE and docs/05 BL16).
export const RESOURCE_CAP = 1e21;
export const XP_CAP = RESOURCE_CAP;

// The late part of the tile price. Up to `tailFrom` owned tiles the price is the three exponential stages of SCALING_CONFIG;
// beyond it grows like (n / tailFrom)^tailExponent, which is far gentler than any exponential, so the map can keep growing
// for as long as the player keeps earning. `ceiling` keeps the price a finite, affordable-in-principle number.
// The first 300 tiles are the "fill the map" part of a run (about 2-3 days); past them the price climbs much faster than the
// income, so 400 tiles take about twice as long per 100 as the stretch before. This is the knob for the later rebirth design:
// bigger starting resources and bigger maps mean raising `tailFrom` or lowering `tailExponent` (docs/05, BL16).
export const TILE_PRICE = {
	tailFrom: 300,
	tailExponent: 4.5,
	ceiling: RESOURCE_CAP / 100,
};

// XP a tile purchase gives: BASE_XP_PER_TILE x growth^(k-1) x k/4 up to tile `growthUntil`, then a polynomial tail. The level curve above is
// fitted to the XP these numbers give the sim bot, so change them together (re-run the sim and move the anchors).
export const XP_TILE = {
	growth: 1.02,
	growthUntil: 300,
	tailExponent: 1.5,
};

// Tile cost curve: exponential growth that is steepest early (cheap first tiles), gentler through the mid game and
// gentler again past `lateTiles`, so a big territory stays a goal instead of an unreachable number. Tuned with scripts/sim.ts
// so the first ~100 tiles come within the first day, 200-300 within 2-3 days (docs/06).
export const SCALING_CONFIG = {
	growthEarly: 1.13, // cost multiplier per owned tile up to `earlyTiles`
	earlyTiles: 15,
	growthLate: 1.07, // cost multiplier per owned tile from `earlyTiles` to `lateTiles`
	lateTiles: 100,
	growthEndgame: 1.007, // cost multiplier per owned tile after `lateTiles`, up to `TILE_PRICE.tailFrom`

	// Gold cost of the next tile when `ownedTiles` tiles are owned (castle counts), before discounts
	costFormula: (ownedTiles: number) => tilePrice(ownedTiles),
	adjacencyBonus: 0.25, // +25% output per same-biome neighbour
};

/**
 * Gold price of the next tile when `ownedTiles` are owned, before discounts: the three exponential stages of SCALING_CONFIG
 * up to TILE_PRICE.tailFrom, then the polynomial tail, never above TILE_PRICE.ceiling. Always finite.
 */
function tilePrice(ownedTiles: number): number {
	const S = SCALING_CONFIG;
	const n = Math.min(ownedTiles, TILE_PRICE.tailFrom);
	let price =
		BASE_TILE_COST *
		Math.pow(S.growthEarly, Math.min(n, S.earlyTiles)) *
		Math.pow(S.growthLate, Math.max(Math.min(n, S.lateTiles) - S.earlyTiles, 0)) *
		Math.pow(S.growthEndgame, Math.max(n - S.lateTiles, 0));
	if (ownedTiles > TILE_PRICE.tailFrom) price *= Math.pow(ownedTiles / TILE_PRICE.tailFrom, TILE_PRICE.tailExponent);
	return Math.floor(Math.min(price, TILE_PRICE.ceiling));
}

// Which biome a random purchase turns up. Everything weighs 1 unless listed; water clusters and gets a shore:
// next to a lake or a coast both become likelier, so ponds grow into bays with beaches instead of single specks.
export const BIOME_SPAWN = {
	weights: { coast: 0.6 } as Record<string, number>,
	nearLake: { lake: 3, coast: 3 } as Record<string, number>,
	nearCoast: { lake: 2, coast: 2 } as Record<string, number>,
};

// Extra resources a tile purchase costs once enough tiles are owned. amount = gold cost x share
export const TILE_RESOURCE_COST: { from: number; resource: 'wood' | 'stone' | 'coal' | 'food' | 'hide'; share: number }[] = [
	{ from: 15, resource: 'wood', share: 0.3 },
	{ from: 15, resource: 'stone', share: 0.2 }, // was 0.25: stone has the thinnest income of the five, the sim showed it holding tiles back more than gold in the first 100
	{ from: 30, resource: 'coal', share: 0.2 },
	{ from: 40, resource: 'food', share: 0.1 },
	{ from: 100, resource: 'hide', share: 0.02 }, // milk and eggs are kept for other uses, so the big territories ask for leather
];

// Biome/building output is multiplied by this (the castle's own output and the base rates are not)
export const BIOME_YIELD = { scale: 1.3 };

// Resource presentation (labels, glyphs, tooltips, merchant prices) lives in catalog/resources.ts; these are the old views of it
const resourceKeys = Object.keys(RESOURCES) as ResourceKey[];
const fromResources = <V>(keys: readonly string[], pick: (key: ResourceKey) => V) =>
	Object.fromEntries(keys.map((key) => [key, pick(key as ResourceKey)]));

export const RESOURCE_ICONS = fromResources(resourceKeys, (key) => RESOURCES[key].emoji) as { [K in ResourceKey]: string };

// What the header tooltips say about each currency: what it is, what it is for and where it comes from.
export const HEADER_DISPLAYED_RESOURCES_INFO = fromResources(
	resourceKeys.filter((key) => key !== 'gems' && key !== 'embers'),
	(key) => {
		const { emoji, label, description, usedFor, source } = RESOURCES[key];
		return { icon: emoji, label, description, usedFor, source };
	}
) as { [K in Exclude<ResourceKey, 'gems' | 'embers'>]: { icon: string; label: string; description: string; usedFor: string; source: string } };

// The two currencies that are not resources: Embers (rebirth, lives in the prestige state) and Gems (their own balance)
export const EMBERS_INFO = {
	label: RESOURCES.embers.label,
	description: RESOURCES.embers.description,
	usedFor: RESOURCES.embers.usedFor,
	source: RESOURCES.embers.source,
};
export const GEMS_INFO = {
	label: RESOURCES.gems.label,
	description: RESOURCES.gems.description,
	usedFor: RESOURCES.gems.usedFor,
	source: RESOURCES.gems.source,
};

// The castle's own per-second output (single source of truth: BIOMES.castle reads from it).
export const CASTLE_BASE_RATES = {
	gold: 0.1,
	wood: 0.05,
	stone: 0.1,
	coal: 0,
	food: 0.05,
	meat: 0,
	eggs: 0,
	milk: 0,
	hide: 0,
	xp: 0.5,
};

export const BIOMES: Record<string, BiomeInfo> = {
	empty: {
		name: 'empty',
		label: 'Empty',
		baseColor: BIOME_COLORS.empty,
		unique: true,
		upgradeable: false,
		resourceGeneration: {},
		resourceIcons: [RESOURCE_ICONS.coal],
		description: 'Empty land, waiting to be claimed',
	},
	castle: {
		name: 'castle',
		label: 'Castle',
		baseColor: BIOME_COLORS.castle,
		unique: true,
		upgradeable: true,
		resourceGeneration: Object.fromEntries(
			Object.entries(CASTLE_BASE_RATES).filter(([, rate]) => rate > 0)
		),
		resourceIcons: [RESOURCE_ICONS.gold, RESOURCE_ICONS.xp],
		description: 'Your castle generates resources over time',
	},
forest: {
		name: 'forest',
		label: 'Forest',
		baseColor: BIOME_COLORS.forest,
		unique: false,
		upgradeable: false,
		resourceGeneration: {
			gold: 0.1,
			wood: 0.3,
		},
		resourceIcons: [RESOURCE_ICONS.wood],
		description: 'Forests provide wood and gold',
	},
	plains: {
		name: 'plains',
		label: 'Plains',
		baseColor: BIOME_COLORS.plains,
		unique: false,
		upgradeable: false,
		resourceGeneration: {
			gold: 0.1,
			food: 0.3,
		},
		resourceIcons: [RESOURCE_ICONS.food],
		description: 'Plains provide food and gold',
	},
	hills: {
		name: 'hills',
		label: 'Hills',
		baseColor: BIOME_COLORS.hills,
		unique: false,
		upgradeable: false,
		resourceGeneration: {
			gold: 0.05,
			stone: 0.3,
			coal: 0.2,
		},
		resourceIcons: [RESOURCE_ICONS.stone, RESOURCE_ICONS.coal],
		description: 'Hills provide stone and coal',
	},
	swamp: {
		name: 'swamp',
		label: 'Swamp',
		baseColor: BIOME_COLORS.swamp,
		unique: false,
		upgradeable: false,
		resourceGeneration: {
			food: 0.1,
			wood: 0.2,
		},
		resourceIcons: [RESOURCE_ICONS.food, RESOURCE_ICONS.wood],
		description: 'Swamps provide food and wood',
	},
	tundra: {
		name: 'tundra',
		label: 'Tundra',
		baseColor: BIOME_COLORS.tundra,
		unique: false,
		upgradeable: false,
		resourceGeneration: {
			gold: 0.1,
			coal: 0.35,
		},
		resourceIcons: [RESOURCE_ICONS.gold, RESOURCE_ICONS.coal],
		description: 'Tundras provide gold and coal',
	},
	lake: {
		name: 'lake',
		label: 'Lake',
		baseColor: BIOME_COLORS.lake,
		unique: false,
		upgradeable: false,
		resourceGeneration: {
			gold: 0.05,
			food: 0.25,
		},
		resourceIcons: [RESOURCE_ICONS.gold, RESOURCE_ICONS.food],
		description: 'Lakes provide gold and food',
	},
	coast: {
		name: 'coast',
		label: 'Coast',
		baseColor: BIOME_COLORS.coast,
		unique: false,
		upgradeable: false,
		resourceGeneration: {
			gold: 0.1,
			food: 0.2,
		},
		resourceIcons: [RESOURCE_ICONS.gold, RESOURCE_ICONS.food],
		description: 'Sandy shores provide gold and food, and border the water',
	},
} as const;

export const INITIAL_RESOURCES = {
	gold: 125,
	wood: 0,
	stone: 0,
	coal: 0,
	food: 0,
	meat: 0,
	eggs: 0,
	milk: 0,
	hide: 0,
	xp: 0,
};

// Base resource generation (per second) - slightly increased for better early game
export const BASE_GENERATION_RATES = {
	gold: 0.1, // Increased base gold generation
	wood: 0,
	stone: 0,
	coal: 0,
	food: 0,
	meat: 0, // Meat can only be generated through the farm
	eggs: 0, // so are eggs, milk and hide
	milk: 0,
	hide: 0,
	xp: 0.25, // Base XP generation rate increased
};


// Castle range: tiles within this many steps of the castle (3x3 at radius 1) will get the castle's range bonus. `radius` is
// also the ward and the fortress walls. From `growFromLevel` the violet area (not the ward) grows by `growPerLevel` tiles on
// every side per level: 3x3 up to level 7, then 5x5, 7x7 and 9x9 at level 10.
export const CASTLE_RANGE = { radius: 1, growFromLevel: 8, growPerLevel: 1 };

// Production bonus inside the castle range: below `fromLevel` (no walls yet) every tile of the 3x3 range, and the building on
// it, produces `earlyBonus` extra (+50%, x1.5). From `fromLevel` it produces `perRadiusTile` times its output extra for every
// tile the range reaches out: +100% at radius 1 (level 7) up to +400% at radius 4 (level 10).
export const CASTLE_AREA_BONUS = { fromLevel: 7, perRadiusTile: 1, earlyBonus: 0.5 };

// From this castle level the 3x3 range becomes a walled fortress (walls on its edges, a tower on each corner): no monsters
// and no chests spawn inside it and monsters already there are driven out.
export const CASTLE_FORTRESS = { fromLevel: 7 };

// Exponential castle upgrade system
export const CASTLE_UPGRADE = {
	maxLevel: 10,
	baseResourceMultiplier: 0.2, // +20% to every resource at level 1
	doublingUntil: 6, // the bonus doubles with every level up to this level ...
	lateLevelStep: 3.2, // ... then grows linearly by this much per level (level 10 = +1920%)
	glowFromLevel: 6, // from this level the castle is drawn animated and glowing, stronger with every level
	xpBonus: 0.5, // Additional flat XP/s for every castle level above 1
	// Real upgrade time in seconds, indexed by the level being left (1 -> 2 is index 0). Counted by the tick loop.
	durationsSec: [3600, 14400, 43200, 86400, 172800, 259200, 345600, 432000, 604800],
	upgradeCosts: [
		{ gold: 70000, wood: 10000, stone: 10000 },
		{ gold: 200000, wood: 30000, stone: 30000, coal: 20000 },
		{ gold: 1000000, wood: 100000, stone: 100000, coal: 50000, food: 200000, meat: 40000 },
		{ gold: 4000000, wood: 400000, stone: 400000, coal: 200000, food: 2000000, meat: 100000 },
		{ gold: 8000000, wood: 2000000, stone: 2000000, coal: 1000000, food: 4000000, meat: 500000 },
		{ gold: 30000000, wood: 3000000, stone: 3000000, coal: 1600000, food: 16000000, meat: 800000 },
		{ gold: 48000000, wood: 4800000, stone: 4800000, coal: 2600000, food: 25600000, meat: 1280000 },
		{ gold: 76800000, wood: 7600000, stone: 7600000, coal: 4000000, food: 41000000, meat: 2000000 },
		{ gold: 122800000, wood: 12200000, stone: 12200000, coal: 6600000, food: 65600000, meat: 3200000 },
	],
};

// Merchant
// Resource pricing constants (gold per unit)
export const MERCHANT_RESOURCE_PRICES = fromResources(
	resourceKeys.filter((key) => 'merchant' in RESOURCES[key]),
	(key) => (RESOURCES[key] as { merchant: { price: number } }).merchant.price
) as { [K in MerchantResourceKey]: number };

// Merchant upgrades: permanent bonuses bought with gold. Level N+1 costs ceil(baseCost x costGrowth^N). Everything except Pack Rat
// starts again on a rebirth (like click power); Pack Rat's bigger bag stays, because the bag survives a rebirth.
// They are the game's late gold sink: the first levels are cheap, the last ones are far out of reach before the first rebirth (all the
// ladders together cost over a billion; tests/merchantShop.test.ts keeps it that way) and are bought over several runs.
// `group` only decides the heading of the card in the Upgrades tab.
export const MERCHANT_UPGRADE_GROUPS = {
	economy: 'Economy',
	combat: 'Combat',
	rebirth: 'Rebirth',
} as const;

export const MERCHANT_UPGRADES = {
	haggler: {
		label: 'Haggler',
		group: 'economy',
		description: (n: number) => `+${Math.round(n * 3)}% gold from everything you sell`,
		maxLevel: 10,
		effectPerLevel: 0.03, // gold from selling resources and items
		baseCost: 100000,
		costGrowth: 1.9,
	},
	bulk: {
		label: 'Bulk Discount',
		group: 'economy',
		description: (n: number) => `-${n}% tile and building cost`,
		maxLevel: 8,
		effectPerLevel: 1, // percentage points, added to Charisma and Thrift (REBIRTH.discountCapPercent still caps the sum)
		baseCost: 250000,
		costGrowth: 2.1,
	},
	charm: {
		label: 'Lucky Charm',
		group: 'economy',
		description: (n: number) => `+${n * 2} Luck for chests and kills`,
		maxLevel: 10,
		effectPerLevel: 2, // Luck
		baseCost: 150000,
		costGrowth: 1.9,
	},
	packrat: {
		label: 'Pack Rat',
		group: 'economy',
		description: (n: number) => `+${n * 4} bag slots`,
		maxLevel: 4,
		effectPerLevel: 4, // bag slots
		baseCost: 500000,
		costGrowth: 3,
	},
	foreman: {
		label: 'Foreman',
		group: 'economy',
		description: (n: number) => `+${n}% income from every resource, gold included`,
		maxLevel: 10,
		effectPerLevel: 0.01, // multiplies the income of every resource but XP (utils/gameUtils.ts, merchantIncomeMultiplier)
		baseCost: 400000,
		costGrowth: 1.9,
	},
	skinner: {
		label: 'Skinner',
		group: 'economy',
		description: (n: number) => `+${n * 5}% meat and hide from your animals`,
		maxLevel: 8,
		effectPerLevel: 0.05, // on top of the farm upgrades
		baseCost: 300000,
		costGrowth: 1.9,
	},
	swift: {
		label: 'Quick Hands',
		group: 'combat',
		description: (n: number) => `+${n * 2}% attack speed`,
		maxLevel: 8,
		effectPerLevel: 2, // % attacks per second
		baseCost: 250000,
		costGrowth: 1.9,
	},
	keen: {
		label: 'Keen Eye',
		group: 'combat',
		description: (n: number) => `+${n}% crit chance`,
		maxLevel: 8,
		effectPerLevel: 1, // percentage points (COMBAT.crit.maxCritChance still caps the total)
		baseCost: 250000,
		costGrowth: 1.9,
	},
	deadly: {
		label: 'Deadly Aim',
		group: 'combat',
		description: (n: number) => `+${n}% chance that a crit is a super crit`,
		maxLevel: 8,
		effectPerLevel: 1, // percentage points (COMBAT.crit.maxSuperChance still caps the total)
		baseCost: 250000,
		costGrowth: 1.9,
	},
	might: {
		label: 'Might',
		group: 'combat',
		description: (n: number) => `+${n * 2}% damage with physical weapons`,
		maxLevel: 8,
		effectPerLevel: 2, // %
		baseCost: 250000,
		costGrowth: 1.9,
	},
	arcana: {
		label: 'Arcana',
		group: 'combat',
		description: (n: number) => `+${n * 2}% damage with staves and wands`,
		maxLevel: 8,
		effectPerLevel: 2, // %
		baseCost: 250000,
		costGrowth: 2,
	},
	fang: {
		label: 'Vampiric Fang',
		group: 'combat',
		description: (n: number) => `+${n * 0.5}% life leech: HP back from the damage you deal`,
		maxLevel: 6,
		effectPerLevel: 0.5, // % of the damage dealt (STAT_RULES.lifeLeechCap still caps the total)
		baseCost: 300000,
		costGrowth: 2,
	},
	wind: {
		label: 'Second Wind',
		group: 'combat',
		description: (n: number) => `+${n * 0.25} HP regenerated per second`,
		maxLevel: 6,
		effectPerLevel: 0.25, // HP/s, in and out of fights
		baseCost: 300000,
		costGrowth: 2,
	},
	tithe: {
		label: 'Ancestral Tithe',
		group: 'rebirth',
		description: (n: number) => `+${n * 5}% Embers from your next rebirth`,
		maxLevel: 10,
		effectPerLevel: 0.05, // multiplies the Embers of a rebirth (emberGain); starts again with the rebirth like the rest
		baseCost: 600000,
		costGrowth: 1.9,
	},
} as const;

export type MerchantUpgradeId = keyof typeof MERCHANT_UPGRADES;

// Supplies (potions) the merchant always sells, each at its own `shop` price in the catalog. Every price is at least 3x the item's
// sell value (x1.3 for a maxed Haggler), so buying and selling can never print gold: tests/merchantShop.test.ts checks every entry.
export const MERCHANT_SHOP_ITEMS: { id: string; price: number }[] = shopItems();

// The merchant's shuffling goods (Goods tab): pieces of gear rolled by the loot pipeline (source `merchant`, see lootConfig).
export const MERCHANT_GOODS = {
	offers: LIMITS.merchantOffers, // pieces on the shelf (base value: read it through limitOf('merchantOffers', ctx))
	rotateSec: LIMITS.merchantRotateSec, // the shelf is reshuffled after this much play time (limitOf('merchantRotateSec', ctx))
	maxOffers: HARD_LIMITS.merchantOffers, // what a save may hold
	priceFactor: 5, // gold per gold of sell value: above the 3.9x a max Haggler could resell at, so buying and selling never gains
	// A paid refresh costs `refreshBase` x (refreshes bought so far + 1) for the first `stepRefreshes` of them (5k, 10k ... 50k), then
	// every further one costs `bigStep` more than the one before (100k, 150k ...). Counted per run (a rebirth starts it again).
	refreshBase: LIMITS.merchantRefreshBase, // limitOf('merchantRefreshBase', ctx)
	refresh: { stepRefreshes: 10, bigStep: 50_000 },
	// What the shelf may hold: never above uncommon (the rarer pieces stay a reward for fights and chests), and never more than
	// `maxAboveAverage` item levels above the average level of the gear the player wears. The shelf is built around the world (castle)
	// level, held down to `centreAboveAverage` above that average.
	maxAboveAverage: 5,
	centreAboveAverage: 3,
} as const;

// Farm products: shown on the farm and at the merchant, not in the header row
export const FARM_PRODUCT_KEYS = ['eggs', 'milk', 'hide'] as const;

// Only these can be bought back (as resource packs); farm products are earned on the farm, never bought
export const MERCHANT_BUYABLE = ['wood', 'stone', 'coal', 'food', 'meat'] as const;

// Buying resources from the merchant costs this many times the sell price
export const MERCHANT_BUY_MULTIPLIER = 2;

// Farm animal configurations
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

// The farm: every animal yields meat plus a small trickle of a product (eggs, milk, hide, worth about a third of the meat
// once sold). Products were 50 % slower (and their upgrade bonuses 33 % smaller) until the second-tier resources felt too
// slow to earn; the merchant prices were lowered by the same factor, so a product still sells for the same share of its
// animal's meat and gold income is unchanged: the products themselves, and what they unlock, come faster.
// Upgrades raise the output and the per-kind animal cap. Cost of level N+1 = base x growth^N, per resource.
// Prices: the first animal of each kind is a milestone (chicken ~30 min, deer / pig / cow over the first days) and the costs
// then climb gently enough that a full pen (12 of a kind, 44 with every Pen Expansion) is a goal for weeks, not a wall.
export const FARM = {
	baseCap: 12, // animals of one kind the pen holds before it is expanded
	unitsDrawn: 8, // most sprites drawn per kind in the pen (the animal panel shows the real count)
};

// Pen Expansion: per level, every animal kind may hold `capPerLevel` more animals and all farm output grows
export const FARM_PEN = { outputPerLevel: 0.02, capPerLevel: 4 };

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

// Resource display information
export const MERCHANT_RESOURCE_INFO = fromResources(
	resourceKeys.filter((key) => 'merchant' in RESOURCES[key]),
	(key) => {
		const { label, merchant } = RESOURCES[key] as { label: string; merchant: { description: string; pitch: string } };
		return { label, description: merchant.description, priceDescription: merchant.pitch };
	}
) as { [K in MerchantResourceKey]: { label: string; description: string; priceDescription: string } };

// Buildings (any explored tile)
export type BuildingType =
	| 'farm'
	| 'mine'
	| 'lumbermill'
	| 'market'
	| 'blacksmith'
	| 'workshop'
	| 'lumbercamp'
	| 'quarry'
	| 'fishinghut'
	| 'hunterslodge'
	| 'tavern'
	| 'tower'
	| 'well'
	| 'alchemylab'
	| 'stonecraft'
	| 'barracks';

export interface Building {
	name: BuildingType;
	label: string;
	resourceGeneration: Partial<Resources>;
}

// Buildings configuration
export const BUILDINGS: Record<BuildingType, Building> = {
	farm: {
		name: 'farm',
		label: 'Farm',
		resourceGeneration: {
			food: 0.2,
		},
	},
	mine: {
		name: 'mine',
		label: 'Mine',
		resourceGeneration: {
			stone: 0.2,
			coal: 0.2,
		},
	},
	lumbermill: {
		name: 'lumbermill',
		label: 'Lumber Mill',
		resourceGeneration: {
			wood: 0.2,
		},
	},
	market: {
		name: 'market',
		label: 'Market',
		resourceGeneration: {
			gold: 0.2,
		},
	},
	blacksmith: {
		name: 'blacksmith',
		label: 'Blacksmith',
		resourceGeneration: {
			stone: 0.07,
			coal: 0.07,
			gold: 0.07,
			food: 0.07,
			wood: 0.07,
		},
	},
	workshop: {
		name: 'workshop',
		label: 'Workshop',
		resourceGeneration: {
			xp: 0.2,
		},
	},
	// Round 2 buildings: every output is an existing resource (tuning notes in docs/05)
	lumbercamp: { name: 'lumbercamp', label: 'Lumber Camp', resourceGeneration: { wood: 0.18 } },
	quarry: { name: 'quarry', label: 'Quarry', resourceGeneration: { stone: 0.25 } },
	fishinghut: { name: 'fishinghut', label: 'Fishing Hut', resourceGeneration: { food: 0.16, gold: 0.05 } },
	// Meat used to be farm-only; the Hunter's Lodge is the one other source (small, so farms stay the main supply)
	hunterslodge: { name: 'hunterslodge', label: "Hunter's Lodge", resourceGeneration: { meat: 0.15 } },
	tavern: { name: 'tavern', label: 'Tavern', resourceGeneration: { food: 0.12, xp: 0.08 } },
	tower: { name: 'tower', label: 'Tower', resourceGeneration: { stone: 0.08, xp: 0.12 } },
	well: { name: 'well', label: 'Well', resourceGeneration: { food: 0.15 } },
	alchemylab: { name: 'alchemylab', label: 'Alchemy Lab', resourceGeneration: { xp: 0.12, gold: 0.08 } },
	stonecraft: { name: 'stonecraft', label: 'Stone Craft', resourceGeneration: { stone: 0.15, gold: 0.08 } },
	barracks: { name: 'barracks', label: 'Barracks', resourceGeneration: { gold: 0.1, xp: 0.1 } },
};

// Tile tapping: clicking an owned tile also yields a small slice of that tile's own output.
// A tap = `seconds` worth of the tile's per-second production, with a per-tile cooldown so
// spam-clicking can add at most seconds/cooldown (~42%) on top of a tile's passive income.
export const TILE_TAP = {
	seconds: 0.5,
	cooldownMs: 1200,
	// Lucky tap: chance = the player's crit chance (%), payout = 1 + crit damage multiplier (%)/100
	luckyEnabled: true,
};

// Farm meadow bonuses: little critters wander into the meadow while the Farm window is open; click one before
// it leaves (lifetimeMs) for a gift worth `seconds` of that resource's income (at least `min`).
export const FARM_BONUS = {
	lifetimeMs: 10000,
	firstDelayMs: 45000, // rare on purpose: a visit is a treat, not a chore
	minGapMs: 60000,
	maxGapMs: 120000,
	maxActive: 1,
	goldenChance: 0.12,
	goldenMultiplier: 2,
	critters: {
		butterfly: { label: 'Butterfly', resource: 'gold', seconds: 10, min: 5, weight: 3 },
		bee: { label: 'Bee', resource: 'food', seconds: 10, min: 3, weight: 3 },
		ladybug: { label: 'Ladybug', resource: 'xp', seconds: 10, min: 3, weight: 2 },
		rabbit: { label: 'Rabbit', resource: 'meat', seconds: 10, min: 2, weight: 2 },
	},
} as const;

export type FarmCritterType = keyof typeof FARM_BONUS.critters;

// Gold per click = total gold/s x click power. Four upgrade levels, bought from the merchant.
export const CLICK_LADDER = [
	{ power: 0.5, price: 0 },
	{ power: 0.9, price: 750000 },
	{ power: 1.3, price: 2500000 },
	{ power: 1.8, price: 10000000 },
] as const;

// Click rate limiter: two token buckets, a click must take a token from both.
// - burst: up to `capacity` clicks at once, refilling `refillPerSec` per second (a fast human is never limited here;
//   anything faster than `refillPerSec` clicks/s earns nothing).
// - stamina: a long-run allowance (`staminaCapacity` clicks, refilling `staminaRefillPerSec`/s ~ 130K paid clicks a
//   day) so an auto-clicker running 24 h is no better than a very dedicated human, while normal sessions never notice it.
export const CLICK_LIMIT = {
	capacity: 8,
	refillPerSec: 5,
	staminaCapacity: 20000,
	staminaRefillPerSec: 1.5,
	requireTrusted: true, // ignore synthetic (script-dispatched) clicks
};

/** Gems every player starts with (also granted to saves from before Gems existed). */
export const STARTING_GEMS = 1000;
export const GEMS_CAP = 1_000_000_000;

// Monsters and chests together never take more than `maxFraction` of the free tiles (see src/lib/spawnLimits.ts); the spawn
// timers pause at that limit. `minAllowed` keeps a tiny early map playable: one rat and one chest can always coexist.
export const SPAWN_LIMIT = {
	maxFraction: 0.3,
	minAllowed: 2,
};

// Chests: one spawns every `intervalSec` (timer pauses while SPAWN_LIMIT is reached) on a random owned tile.
// Reward = passive gold/s x a random time between minMinutes and maxMinutes, plus a small bonus per Luck.
export const CHEST = {
	intervalSec: 600,
	minMinutes: 10,
	maxMinutes: 60,
	luckBonusPerPoint: 0.005,

	// Where chests appear: every eligible tile weighs 1, plus these bonuses (see src/lib/chests.ts)
	placement: {
		frontierBonus: 3, // a tile touching land you have not bought yet
		distanceStep: 4, // +1 per this many tiles (Chebyshev) from the castle, so far land is worth visiting
		nearbyRadius: 2, // another chest this close makes a tile much less likely ...
		nearbyFactor: 0.3, // ... times this
	},

	// What a chest holds: relative chances (they need not sum to 100)
	rewards: { gold: 50, bundle: 25, xp: 12, boost: 10, item: 8 } as Record<'gold' | 'bundle' | 'xp' | 'boost' | 'item', number>,
	boostMultiplier: 1.5, // the "lucky chest": gold x this
	bundle: {
		resources: ['wood', 'stone', 'coal', 'food'] as ('wood' | 'stone' | 'coal' | 'food')[],
		count: [1, 2] as [number, number], // how many of them
		minutes: [10, 30] as [number, number], // of that resource's income each
		floor: 25, // at least this much, so a slow resource still pays something
	},
	xp: { minutes: [10, 30] as [number, number], floor: 60 },
	luckRewardBonusPerPoint: 0.01, // each Luck point shifts this share of the gold weight into boost and item chances
};

// What Luck (the Charisma attribute + the merchant's Lucky Charm + gear) does besides the gold bonuses above. Read through the
// functions of src/lib/luck.ts, which are also what the Character window shows.
export const LUCK = {
	/** Chests come this much faster per Luck point (interval / (1 + n x Luck)), never faster than `chestIntervalFloor` x the base interval */
	chestSpeedPerPoint: 0.004,
	chestIntervalFloor: 0.6,
	/** Weights of rare-and-better gear grow by this much per point, capped at x`rarityCap` (the other weights stay, the roll is normalised) */
	rarityPerPoint: 0.004,
	rarityCap: 1.6,
	/** Rarities from this rank up (`RarityDef.order`: 2 = Rare) count as "rare and better" */
	rarityFromOrder: 2,
	/** Monster gear drop chance grows by this much per point */
	dropChancePerPoint: 0.002,
	/** A bonus roll on every chest (it never replaces the normal reward): chance, and how many gems (skewed to the low end) */
	gem: { base: 0.03, perPoint: 0.0006, cap: 0.15, min: 5, max: 50 },
	/** A newly arrived rat is a golden "lucky" one with this chance: same stats, bigger reward */
	luckyRat: { base: 0.02, perPoint: 0.0005, cap: 0.1, rewardMultiplier: 3, extraGearRolls: 1 },
};

// Buildings stand on any explored tile (not the castle or a lake) and cost resources; every building costs more than the last.
// The first few are cheap (`starter` = share of `base` for building 1, 2, 3 ...), then the price grows in three stages the way
// tile prices do: steeply for the next `earlyCount` buildings, gentler for `midCount` more, gentler again after that.
export const BUILDING_COST = {
	base: { gold: 500, wood: 250, stone: 150 } as Partial<Resources>,
	starter: [0.4, 0.6, 0.8, 1] as number[],
	growthEarly: 1.15,
	earlyCount: 12,
	growthMid: 1.09,
	midCount: 16,
	growthLate: 1.025,
	/** Biomes a building cannot stand on (water; the castle has its own upgrades) */
	blockedBiomes: ['lake', 'castle', 'empty'] as string[],
};

// What each base stat does per point. Used by the maths (gameUtils) AND by every tooltip/tutorial text.
export const CHARACTER_STAT_CONFIG = {
	// Fraction added to the modifier of each listed resource, per point
	resourceModifierPerPoint: 0.025,
	resourceTargets: {
		strength: ['stone', 'coal'],
		dexterity: ['wood', 'food'],
		intelligence: ['gold'],
		vitality: ['food', 'wood'],
		charisma: ['gold', 'coal'],
	} as Record<'strength' | 'dexterity' | 'intelligence' | 'vitality' | 'charisma', ('gold' | 'wood' | 'stone' | 'coal' | 'food')[]>,
	// Fraction added to the XP modifier, per point
	xpModifierPerPoint: { intelligence: 0.002, charisma: 0.0025 },
	// Percent added to xpGainMultiplier (applies to passive XP and tile XP), per point
	xpGainPercentPerPoint: { intelligence: 0.2, charisma: 0.25 },
	// Percent of tile cost removed per Charisma point, and the cap
	tileDiscountPercentPerCharisma: 0.5,
	tileDiscountCapPercent: 25,
	// Plains: meat modifier per owned Plains tile (fraction)
	plainsMeatModifier: 0.05,
};

// Rebirth: restart with a permanent bonus paid in Embers. Available once the castle reaches `minCastleLevel`.
export const REBIRTH = {
	minCastleLevel: 6,
	minTiles: 100, // a rebirth also needs this much territory (the first ~100 tiles come within a day, so it is the castle that gates it)
	gainScale: 4.5, // Embers = gainScale x (castle level - 5) x sqrt(tiles / 10), rounded down
	incomePerPoint: 0.05, // +5% of all income per Ember ever earned (spending points never lowers it)
	discountCapPercent: 45, // Charisma + Thrift together can never take more than this off a tile
	// Embers granted for a rebirth with this castle level and territory
	gain: (castleLevel: number, tiles: number) =>
		Math.floor(REBIRTH.gainScale * Math.max(0, castleLevel - 5) * Math.sqrt(Math.max(0, tiles) / 10)),
};

// The Ember shop: permanent upgrades bought with unspent Embers. The N+1-th level costs
// ceil(baseCost x costGrowth^N) points.
export const EMBER_UPGRADES = {
	thrift: {
		label: 'Thrift',
		maxLevel: 10,
		baseCost: 2,
		costGrowth: 1.4,
		effectPerLevel: 0.02, // -2% tile and building cost per level
	},
	builders: {
		label: 'Master Builders',
		maxLevel: 10,
		baseCost: 3,
		costGrowth: 1.4,
		effectPerLevel: 0.05, // -5% castle build time per level
	},
	mastery: {
		label: 'Click Mastery',
		maxLevel: 10,
		baseCost: 2,
		costGrowth: 1.4,
		effectPerLevel: 0.1, // +10% gold per click per level
	},
	provisions: {
		label: 'Provisions',
		maxLevel: 10,
		baseCost: 2,
		costGrowth: 1.4,
		effectPerLevel: 1, // levels of the starting bundle below
		bundle: { gold: 1500, wood: 400, stone: 400 } as Partial<Resources>, // per level, given at the start of every run
	},
	nightwatch: {
		label: 'Night Watch',
		maxLevel: 10,
		baseCost: 2,
		costGrowth: 1.4,
		effectPerLevel: 1, // +1 hour of away time the kingdom works for you, per level (base: LIMITS.offlineCapHours)
	},
	steward: {
		label: 'Steward',
		maxLevel: 10,
		baseCost: 3,
		costGrowth: 1.4,
		effectPerLevel: 0.05, // +5% of the normal income while you are away, per level (base: LIMITS.offlineEfficiency)
	},
} as const;

export type EmberUpgradeId = keyof typeof EMBER_UPGRADES;

// Cute life on the map: butterflies, bees, ladybugs and rabbits wander over owned land of a matching biome.
// Purely decorative, except the rare golden one, which can be clicked for a small gift (see claimCritterGift).
export const AMBIENT_LIFE = {
	firstSpawnMs: 6000, // the first critter shows up this long after the map opens
	spawnMinMs: 14000,
	spawnMaxMs: 30000,
	maxAlive: 3,
	lifeMinMs: 6000,
	lifeMaxMs: 10000,
	roamTiles: 1.5, // how far a critter strays from where it appears
	giftChance: 1 / 12, // share of critters that carry a gift
	giftSeconds: 5, // a map gift is worth this many seconds of that resource's income (x goldenMultiplier)
	giftCooldownMs: 20000, // at most one map gift per this long
	farmGiftCooldownMs: 8000, // same for the farm meadow critters
	// which critter likes which biome (a name twice = twice as common). Fish only swim where the lake has water on all four
	// sides, and fish, frogs, crabs, goats and wolves are decoration only: the golden gift critters are the four from FARM_BONUS.
	byBiome: {
		forest: ['butterfly', 'bee', 'wolf'],
		plains: ['bee', 'butterfly'],
		swamp: ['ladybug', 'frog', 'frog'],
		hills: ['rabbit', 'goat', 'goat'],
		tundra: ['rabbit'],
		lake: ['fish', 'fish', 'butterfly'],
		coast: ['butterfly', 'bee', 'crab', 'crab'],
} as Record<string, readonly AmbientCritterType[]>,
	// how far a critter strays, as a share of roamTiles (swimmers and crawlers stay close to where they appear)
	roamScale: { fish: 0.35, frog: 0.45, crab: 0.5, goat: 0.8, wolf: 1 } as Record<string, number>,
};

export type AmbientCritterType = 'butterfly' | 'bee' | 'ladybug' | 'rabbit' | 'fish' | 'frog' | 'crab' | 'goat' | 'wolf';
