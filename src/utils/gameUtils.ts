import {
	BIOMES,
	CASTLE_UPGRADE,
	GRID_SIZE,
	GRID_HEIGHT,
	BASE_GENERATION_RATES,
	ANIMALS,
	FARM,
	FARM_PEN,
	FARM_UPGRADES,
	type FarmUpgradeId,
	BASE_XP_PER_TILE,
	BASE_XP_PER_LEVEL,
	XP_GROWTH_FACTOR,
	SCALING_CONFIG,
	GRID_CENTER_Y,
	GRID_CENTER_X,
	BUILDINGS,
	BuildingType,
	BIOME_YIELD,
	BUILDING_COST,
	CHARACTER_STAT_CONFIG,
	INITIAL_RESOURCES,
	LEGACY_UPGRADES,
	MERCHANT_UPGRADES,
	type MerchantUpgradeId,
	REBIRTH,
	TILE_RESOURCE_COST,
	type LegacyUpgradeId,
} from '@/config/gameConfig';
import {
	Animal,
	BiomeType,
	CharacterStats,
	GameState,
	ResourceRates,
	PrestigeState,
	Resources,
	Tile,
	TileCost,
} from '@/types/game';
import { RING, generateStartRing } from '@/utils/biomeRules';

/**
 * Counts the total number of owned tiles in the grid
 * @param tiles Grid of tiles to count ownership from
 * @returns Number of owned tiles
 */
export const countOwnedTiles = (tiles: { isOwned: boolean }[][]): number => {
	let count = 0;
	for (let y = 0; y < GRID_HEIGHT; y++) {
		for (let x = 0; x < GRID_SIZE; x++) {
			if (tiles[y][x].isOwned) count++;
		}
	}
	return count;
};

/**
 * Counts the total number of owned tiles of a specific biome type
 * @param tiles Grid of tiles to count ownership from
 * @param biomeType The type of biome to count
 * @returns Number of owned tiles of the specified biome type
 */
export const countOwnedBiomeTypes = (
	tiles: Tile[][],
	biomeType: BiomeType
): number => {
	let count = 0;
	for (let y = 0; y < GRID_HEIGHT; y++) {
		for (let x = 0; x < GRID_SIZE; x++) {
			if (tiles[y][x].isOwned && tiles[y][x].biome === biomeType) count++;
		}
	}
	return count;
};

/**
 * Gets the description for a character stat
 * @param stat The character stat key
 * @returns Description of what the stat does
 */
const titleCase = (s: string) => s[0].toUpperCase() + s.slice(1);

/** "+2.5% Stone & Coal production per point / +0.2% XP production per point / +0.2% XP gained per point" */
const resourceEffect = (stat: keyof typeof CHARACTER_STAT_CONFIG.resourceTargets): string => {
	const cfg = CHARACTER_STAT_CONFIG;
	const parts = [
		`+${+(cfg.resourceModifierPerPoint * 100).toFixed(2)}% ${cfg.resourceTargets[stat].map(titleCase).join(' & ')} production per point`,
	];
	if (stat === 'intelligence' || stat === 'charisma') {
		parts.push(`+${+(cfg.xpModifierPerPoint[stat] * 100).toFixed(2)}% XP production per point`);
		parts.push(`+${cfg.xpGainPercentPerPoint[stat]}% XP gained per point`);
	}
	return parts.join(' / ');
};

export const getStatDescription = (
	stat: keyof Omit<CharacterStats, 'availablePoints'>
): string => {
	const descriptions: Record<
		keyof Omit<CharacterStats, 'availablePoints'>,
		string
	> = {
		// Resource, XP and discount effects come from CHARACTER_STAT_CONFIG (the same constants the maths uses)
		strength: `${resourceEffect('strength')} / +1 Physical ATK per point / +0.5 DEF per point / +1% Crit DMG per point`,
		dexterity: `${resourceEffect('dexterity')} / +1 DEF per point / +0.25% ATK Speed per point / +0.25% Crit Chance per point / +0.5% Crit DMG per point`,
		intelligence: `${resourceEffect('intelligence')} / +1 Magic ATK per point / +1 Magic DEF per point / +2 MP per point`,
		vitality: `${resourceEffect('vitality')} / +3 HP per point / +0.5 DEF per point / +0.5 Magic DEF per point`,
		charisma: `${resourceEffect('charisma')} / +${CHARACTER_STAT_CONFIG.tileDiscountPercentPerCharisma}% Tile Cost Discount per point (max ${CHARACTER_STAT_CONFIG.tileDiscountCapPercent}%) / +1 Luck per point (bigger chests) / +0.25 HP, DEF & Magic DEF per point / +0.5% Crit Chance & Crit DMG per point`,
		// Combat stats
		physicalAtk:
			'Your physical attack power. Determines damage dealt with physical attacks.',
		magicAtk:
			'Your magical attack power. Determines damage dealt with magical attacks.',
		hp: 'Hit Points. Your health that determines how much damage you can take.',
		mp: 'Mana Points. Resource used for casting spells and special abilities.',
		def: 'Physical Defense. Reduces damage taken from physical attacks.',
		magicDef: 'Magical Defense. Reduces damage taken from magical attacks.',
		luck: 'Influences random events and rare item finds.',
		critChance:
			'Percentage chance to land a critical hit for increased damage.',
		critDmgMultiplier:
			'Percentage of additional damage dealt on critical hits.',
		atkSpeedIncrease:
			'Percentage increase to attack speed, allowing faster actions.',
		xpGainMultiplier:
			'Percentage increase to experience points gained from all sources.',
		tileCostDiscount: 'Percentage discount when purchasing new tiles.',
		reputation:
			'Your standing in the world. Affects interactions with NPCs and factions.',
	};

	return descriptions[stat];
};

/**
 * Calculate XP gain scaling based on owned tiles
 * The more tiles owned, the more XP gained
 */
export const calculateXpGain = (ownedTiles: number): number => {
	// Basic XP gain increases with the number of tiles owned
	// Each tile contributes XP that increases slightly with more tiles
	return BASE_XP_PER_TILE * Math.pow(1.02, ownedTiles - 1) * (ownedTiles / 4);
};

/**
 * Calculate level based on total XP using exponential scaling
 * Each level requires more XP than the previous one
 */
export const calculateLevel = (
	xp: number
): { level: number; progress: number } => {
	// Start at level 1, no XP needed for first level
	let level = 1;
	let xpForNextLevel = BASE_XP_PER_LEVEL;
	let remainingXp = xp;

	// Keep leveling up until we don't have enough XP
	while (remainingXp >= xpForNextLevel) {
		remainingXp -= xpForNextLevel;
		level++;
		xpForNextLevel = Math.floor(
			BASE_XP_PER_LEVEL * Math.pow(XP_GROWTH_FACTOR, level - 1)
		);
	}

	// Calculate progress to next level
	const progress = xpForNextLevel > 0 ? remainingXp / xpForNextLevel : 0;

	return { level, progress };
};

export const countAdjacentSameBiomes = (
	tiles: GameState['tiles'],
	x: number,
	y: number,
	biome: BiomeType
): number => {
	const directions = [
		[-1, 0],
		[1, 0],
		[0, -1],
		[0, 1],
	];
	return directions.reduce((count, [dx, dy]) => {
		const newX = x + dx;
		const newY = y + dy;
		if (
			newX >= 0 &&
			newX < GRID_SIZE &&
			newY >= 0 &&
			newY < GRID_HEIGHT &&
			tiles[newY][newX].isOwned &&
			tiles[newY][newX].biome === biome
		) {
			return count + 1;
		}
		return count;
	}, 0);
};

/** Tiles that did not cost anything: the castle (1) in an old save, the castle and its 8 neighbours in a new game. */
export const STARTER_FREE_TILES = 9;

/**
 * Owned-tile count as the economy sees it: purchases + 1 (the old castle-only start). Tile cost, XP per tile, the extra
 * resource costs, the biome picker cadence and the rebirth requirements all use this, so the free starting ring does not
 * make the first purchases expensive. Pass the state's `freeTiles`.
 */
export const economyTiles = (tiles: { isOwned: boolean }[][], freeTiles: number): number =>
	countOwnedTiles(tiles) - freeTiles + 1;

/** A new map: the castle at the centre and its 8 neighbours already owned, generated from the basic biomes. */
export const createInitialGrid = (random: () => number = Math.random): Tile[][] => {
	const grid: Tile[][] = Array(GRID_HEIGHT)
		.fill(null)
		.map(() =>
			Array(GRID_SIZE)
				.fill(null)
				.map(() => ({
					biome: 'empty' as BiomeType,
					isOwned: false,
				}))
		);

	// Place castle at center
	grid[GRID_CENTER_Y][GRID_CENTER_X] = {
		biome: 'castle',
		isOwned: true,
		level: 1,
		upgradeCost: CASTLE_UPGRADE.upgradeCosts[0],
	} as Tile;

	const ring = generateStartRing(random);
	RING.forEach(([dx, dy], i) => {
		grid[GRID_CENTER_Y + dy][GRID_CENTER_X + dx] = { biome: ring[i], isOwned: true };
	});

	return grid;
};

// Resource Management
// Calculate stat-based resource modifiers
export const calculateStatResourceModifiers = (
	stats: CharacterStats
): Resources => {
	const modifiers: Resources = {
		gold: 0,
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

	const cfg = CHARACTER_STAT_CONFIG;
	(Object.keys(cfg.resourceTargets) as (keyof typeof cfg.resourceTargets)[]).forEach((stat) => {
		cfg.resourceTargets[stat].forEach((resource) => {
			modifiers[resource] += stats[stat] * cfg.resourceModifierPerPoint;
		});
	});
	modifiers.xp += stats.intelligence * cfg.xpModifierPerPoint.intelligence;
	modifiers.xp += stats.charisma * cfg.xpModifierPerPoint.charisma;

	return modifiers;
};

export const calculateAnimalCost = (animal: Animal, level: number): number => {
	return Math.floor(animal.baseCost * Math.pow(animal.costScaling, level));
};

export type FarmUpgrades = Partial<Record<string, number>>;

export const farmUpgradeLevel = (upgrades: FarmUpgrades | undefined, id: FarmUpgradeId): number =>
	Math.max(0, Math.min(FARM_UPGRADES[id].maxLevel, Math.floor(upgrades?.[id] ?? 0)));

/** Animals of one kind the pen holds (the base cap plus Pen Expansion). A save with more is never trimmed. */
export const farmCap = (upgrades: FarmUpgrades | undefined): number =>
	FARM.baseCap + farmUpgradeLevel(upgrades, 'pen') * FARM_PEN.capPerLevel;

/** Cost of the next level of a farm upgrade, given its current level (one entry per resource). */
export const farmUpgradeCost = (id: FarmUpgradeId, level: number): Partial<Resources> => {
	const def = FARM_UPGRADES[id];
	const out: Partial<Resources> = {};
	for (const [resource, base] of Object.entries(def.cost)) {
		out[resource as keyof Resources] = Math.ceil((base as number) * Math.pow(def.costGrowth, level));
	}
	return out;
};

/** Everything the farm yields per second before the global modifiers: meat plus the products. */
export type FarmOutput = Record<'meat' | 'eggs' | 'milk' | 'hide', number>;

const emptyOutput = (): FarmOutput => ({ meat: 0, eggs: 0, milk: 0, hide: 0 });

/** Output of `count` animals of one kind (every purchase adds one more animal). */
export const animalOutput = (animal: Animal, count: number, upgrades?: FarmUpgrades): FarmOutput => {
	const out = emptyOutput();
	if (count <= 0) return out;
	const pen = 1 + farmUpgradeLevel(upgrades, 'pen') * FARM_PEN.outputPerLevel;
	const up = (id: FarmUpgradeId) => 1 + farmUpgradeLevel(upgrades, id) * FARM_UPGRADES[id].effectPerLevel;
	out.meat = animal.baseProduction * count * pen * up('feed');
	const productUpgrade: Record<Animal['product']['resource'], FarmUpgradeId> = { eggs: 'coop', milk: 'dairy', hide: 'tannery' };
	out[animal.product.resource] = animal.product.perSec * count * pen * up(productUpgrade[animal.product.resource]);
	return out;
};

// Meat/s of `level` animals of one kind (every purchase adds one more animal)
export const calculateAnimalProduction = (animal: Animal, level: number, upgrades?: FarmUpgrades): number =>
	animalOutput(animal, level, upgrades).meat;

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
	resources: Pick<Resources, 'food' | 'wood' | 'stone' | 'coal' | 'meat' | 'eggs' | 'milk' | 'hide' | 'gold'>,
	farmLevels: Record<string, number>,
	farmUpgrades: FarmUpgrades | undefined
): boolean => {
	const cap = farmCap(farmUpgrades);
	if (ANIMALS.some((a) => affordableAnimals(a, farmLevels[a.id] || 0, resources.food, cap, 1) > 0)) return true;
	return (Object.keys(FARM_UPGRADES) as FarmUpgradeId[]).some((id) => {
		const level = farmUpgradeLevel(farmUpgrades, id);
		if (level >= FARM_UPGRADES[id].maxLevel) return false;
		return Object.entries(farmUpgradeCost(id, level)).every(
			([resource, price]) => (resources[resource as keyof typeof resources] ?? 0) >= (price ?? 0)
		);
	});
};

// Calculate combat stats from base stats
export const calculateCombatStats = (
	stats: CharacterStats
): Partial<CharacterStats> => {
	return {
		physicalAtk: stats.strength, // +1 per strength
		magicAtk: stats.intelligence, // +1 per intelligence
		hp: stats.vitality * 3 + stats.charisma * 0.25, // +3 per vitality, +0.25 per charisma
		mp: stats.intelligence * 2, // +2 per intelligence
		def:
			stats.dexterity +
			stats.strength * 0.5 +
			stats.vitality * 0.5 +
			stats.charisma * 0.25, // Base + dex + str/2 + vit/2 + cha/4
		magicDef: stats.intelligence + stats.vitality * 0.5 + stats.charisma * 0.25, // Base + int + vit/2 + cha/4
		luck: stats.charisma, // +1 per charisma
		critChance: stats.dexterity * 0.25 + stats.charisma * 0.5, // +0.25% per dex, +0.5% per cha
		critDmgMultiplier:
			100 + stats.strength + stats.dexterity * 0.5 + stats.charisma * 0.5, // Base 100% + str + dex/2 + cha/2
		atkSpeedIncrease: stats.dexterity * 0.25, // +0.25% per dex
		xpGainMultiplier:
			stats.intelligence * CHARACTER_STAT_CONFIG.xpGainPercentPerPoint.intelligence +
			stats.charisma * CHARACTER_STAT_CONFIG.xpGainPercentPerPoint.charisma,
		tileCostDiscount: Math.min(
			stats.charisma * CHARACTER_STAT_CONFIG.tileDiscountPercentPerCharisma,
			CHARACTER_STAT_CONFIG.tileDiscountCapPercent
		),
	};
};

export const calculateTotalMeatProduction = (farmLevels: Record<string, number>, upgrades?: FarmUpgrades): number =>
	calculateFarmOutput(farmLevels, upgrades).meat;

export const calculateResourceRates = (
	tiles: Tile[][],
	characterStats?: CharacterStats,
	farmLevels: Record<string, number> = {},
	prestige?: PrestigeState,
	farmUpgrades?: FarmUpgrades
): ResourceRates => {
	const base = { ...BASE_GENERATION_RATES };
	const modifiers: Resources = { gold: 0, wood: 0, stone: 0, coal: 0, food: 0, meat: 0, eggs: 0, milk: 0, hide: 0, xp: 0 };
	const total = { ...BASE_GENERATION_RATES };

	// Add meat and farm products from animals to base rates
	const farm = calculateFarmOutput(farmLevels, farmUpgrades);
	base.meat = farm.meat;
	base.eggs = farm.eggs;
	base.milk = farm.milk;
	base.hide = farm.hide;

	// Calculate base rates from tiles
	for (let y = 0; y < tiles.length; y++) {
		for (let x = 0; x < tiles[y].length; x++) {
			const tile = tiles[y][x];
			if (tile.isOwned) {
				const biome = BIOMES[tile.biome];
				const adjacentCount = countAdjacentSameBiomes(tiles, x, y, tile.biome);
				const adjacencyMultiplier =
					1 + SCALING_CONFIG.adjacencyBonus * adjacentCount;

				// Biome output is boosted by BIOME_YIELD.scale; the castle (unique tile) is not
				const yieldScale = tile.biome === 'castle' ? 1 : BIOME_YIELD.scale;

				Object.entries(biome.resourceGeneration).forEach(([resource, rate]) => {
					if (rate) {
						// Add to base rate with adjacency bonus
						base[resource as keyof Resources] +=
							rate * adjacencyMultiplier * yieldScale;
					}
				});

				// A building adds its own output on top of the tile's biome output
				if (tile.building) {
					const building = BUILDINGS[tile.building as BuildingType];
					if (building && building.resourceGeneration) {
						// Add building resource generation to the base rates
						Object.entries(building.resourceGeneration).forEach(([resource, rate]) => {
							if (rate && typeof rate === 'number') {
								// Add to base rate with adjacency bonus
								base[resource as keyof Resources] +=
									rate * adjacencyMultiplier * BIOME_YIELD.scale;
							}
						});
					}
				}
			}
		}
	}

	// Calculate castle modifier (exponential growth - doubles each level after level 1)
	let castleLevel = 1;
	for (let y = 0; y < GRID_HEIGHT; y++) {
		for (let x = 0; x < GRID_SIZE; x++) {
			const tile = tiles[y][x];
			if (tile.isOwned && tile.biome === 'castle' && tile.level) {
				castleLevel = tile.level;
				break;
			}
		}
	}
	const castleBonus = castleModifier(castleLevel);

	// Add the castle modifier to all resources
	Object.keys(modifiers).forEach((resource) => {
		const key = resource as keyof Resources;
		modifiers[key] += castleBonus;
	});

	// Castle levels above 1 add flat XP/s
	base.xp += CASTLE_UPGRADE.xpBonus * Math.max(castleLevel - 1, 0);

	// Add Plains biome bonus for meat production
	// Each owned Plains tile provides a 5% bonus to meat production
	const plainsCount = countOwnedBiomeTypes(tiles, 'plains');
	if (plainsCount > 0) {
		// 5% per plains tile
		modifiers.meat += plainsCount * CHARACTER_STAT_CONFIG.plainsMeatModifier;
	}

	// Apply stat-based resource modifiers if stats are provided
	if (characterStats) {
		const statModifiers = calculateStatResourceModifiers(characterStats);
		Object.entries(statModifiers).forEach(([resource, modifier]) => {
			modifiers[resource as keyof Resources] += modifier;
		});
	}

	// Legacy income bonus multiplies everything; it is folded into the modifiers so tooltips stay consistent
	const legacyMultiplier = legacyIncomeMultiplier(prestige);

	// Calculate total rates
	Object.keys(total).forEach((resource) => {
		const key = resource as keyof Resources;
		modifiers[key] = (1 + modifiers[key]) * legacyMultiplier - 1;
		total[key] = base[key] * (1 + modifiers[key]);
	});

	return { base, modifiers, total };
};

// Per-second output of one owned tile (biome + building, adjacency bonus, global modifiers).
// Used for the tile-tap bonus and the tile tooltip. XP is excluded on purpose.
export const calculateTileTapYield = (
	tiles: Tile[][],
	x: number,
	y: number,
	rates: ResourceRates
): Partial<Resources> => {
	const tile = tiles[y]?.[x];
	if (!tile || !tile.isOwned) return {};

	const out: Partial<Resources> = {};
	const adjacent = countAdjacentSameBiomes(tiles, x, y, tile.biome);
	const adjacency = 1 + SCALING_CONFIG.adjacencyBonus * adjacent;
	const addRate = (resource: string, rate: number) => {
		if (!rate || resource === 'xp') return;
		const key = resource as keyof Resources;
		out[key] =
			(out[key] || 0) +
			rate * adjacency * yieldScale * (1 + (rates.modifiers[key] || 0));
	};
	const yieldScale = tile.biome === 'castle' ? 1 : BIOME_YIELD.scale;

	Object.entries(BIOMES[tile.biome].resourceGeneration).forEach(([resource, rate]) =>
		addRate(resource, rate as number)
	);
	if (tile.building) {
		const building = BUILDINGS[tile.building as BuildingType];
		if (building?.resourceGeneration) {
			Object.entries(building.resourceGeneration).forEach(([resource, rate]) =>
				addRate(resource, rate as number)
			);
		}
	}
	return out;
};

// ---------------------------------------------------------------------------
// Costs

/** Everything buying the next tile costs, given how many tiles are owned and the Charisma discount (percent). */
export const calculateTileCost = (
	ownedTiles: number,
	discountPercent = 0
): TileCost => {
	const keep = 1 - discountPercent / 100;
	const base = SCALING_CONFIG.costFormula(ownedTiles);
	const resources: Partial<Resources> = {};
	TILE_RESOURCE_COST.forEach(({ from, resource, share }) => {
		if (ownedTiles >= from) resources[resource] = Math.floor(base * share * keep);
	});
	return { gold: Math.floor(base * keep), resources };
};

/** Cost of a bundle of resources (gold included) as a flat partial-resources object. */
export const tileCostAsResources = (cost: TileCost): Partial<Resources> => ({
	...cost.resources,
	gold: cost.gold,
});

export const canAffordBundle = (
	resources: Resources,
	cost: Partial<Resources>
): boolean =>
	Object.entries(cost).every(
		([resource, amount]) => resources[resource as keyof Resources] >= (amount || 0)
	);

/** Returns a copy of `resources` with `cost` subtracted (callers check affordability first). */
export const subtractBundle = (
	resources: Resources,
	cost: Partial<Resources>
): Resources => {
	const next = { ...resources };
	Object.entries(cost).forEach(([resource, amount]) => {
		next[resource as keyof Resources] -= amount || 0;
	});
	return next;
};

export const countBuildings = (tiles: Tile[][]): number => {
	let count = 0;
	for (let y = 0; y < GRID_HEIGHT; y++) {
		for (let x = 0; x < GRID_SIZE; x++) {
			if (tiles[y][x].isOwned && tiles[y][x].building) count++;
		}
	}
	return count;
};

/** Price factor of the next building when `built` buildings stand: the cheap starter steps, then three stages of growth. */
export const buildingCostFactor = (built: number): number => {
	const C = BUILDING_COST;
	if (built < C.starter.length) return C.starter[built];
	const k = built - C.starter.length + 1; // 1 for the first building after the starter ones
	return (
		Math.pow(C.growthEarly, Math.min(k, C.earlyCount)) *
		Math.pow(C.growthMid, Math.min(Math.max(k - C.earlyCount, 0), C.midCount)) *
		Math.pow(C.growthLate, Math.max(k - C.earlyCount - C.midCount, 0))
	);
};

/** Cost of the next building: base cost x the factor for the number of buildings already built. */
export const calculateBuildingCost = (
	tiles: Tile[][],
	prestige?: PrestigeState
): Partial<Resources> => {
	const factor = buildingCostFactor(countBuildings(tiles)) * (1 - legacyEffect(prestige, 'thrift'));
	const cost: Partial<Resources> = {};
	Object.entries(BUILDING_COST.base).forEach(([resource, amount]) => {
		cost[resource as keyof Resources] = Math.floor((amount || 0) * factor);
	});
	return cost;
};

/** An explored tile that can take a building: not water or the castle, and nothing built on it yet. */
export const canBuildOn = (tile: Tile | undefined): boolean =>
	!!tile && tile.isOwned && !BUILDING_COST.blockedBiomes.includes(tile.biome) && !tile.building;

/**
 * Bonus (as a fraction) the castle adds to the modifier of every resource: +20% at level 1, doubling each
 * level up to `doublingUntil`, then a fixed step per level (so levels 7-10 stay a long climb, not an explosion).
 */
export const castleModifier = (level: number): number => {
	const lvl = Math.max(1, Math.floor(level));
	const doubled = Math.min(lvl, CASTLE_UPGRADE.doublingUntil);
	let bonus = CASTLE_UPGRADE.baseResourceMultiplier * Math.pow(2, doubled - 1);
	if (lvl > CASTLE_UPGRADE.doublingUntil) {
		bonus += CASTLE_UPGRADE.lateLevelStep * (lvl - CASTLE_UPGRADE.doublingUntil);
	}
	return bonus;
};

/** Seconds the castle needs to go from `fromLevel` to `fromLevel + 1`. */
export const castleUpgradeDuration = (fromLevel: number, prestige?: PrestigeState): number =>
	Math.floor((CASTLE_UPGRADE.durationsSec[fromLevel - 1] ?? 0) * (1 - legacyEffect(prestige, 'builders')));

// ---------------------------------------------------------------------------
// Rebirth / Legacy

export const EMPTY_PRESTIGE: PrestigeState = { rebirths: 0, legacyPoints: 0, legacyEarned: 0, upgrades: {} };

export const legacyLevel = (prestige: PrestigeState | undefined, id: LegacyUpgradeId): number =>
	prestige?.upgrades?.[id] ?? 0;

/** Effect of a shop upgrade as a fraction (or, for Provisions, as a number of starting bundles). */
export const legacyEffect = (prestige: PrestigeState | undefined, id: LegacyUpgradeId): number =>
	legacyLevel(prestige, id) * LEGACY_UPGRADES[id].effectPerLevel;

/** Cost in Legacy points of buying the next level of an upgrade, given its current level. */
export const legacyUpgradeCost = (id: LegacyUpgradeId, currentLevel: number): number =>
	Math.ceil(LEGACY_UPGRADES[id].baseCost * Math.pow(LEGACY_UPGRADES[id].costGrowth, currentLevel));

/** Points spent on shop levels so far. */
export const legacySpent = (upgrades: PrestigeState['upgrades']): number => {
	let spent = 0;
	(Object.keys(LEGACY_UPGRADES) as LegacyUpgradeId[]).forEach((id) => {
		for (let level = 0; level < (upgrades[id] ?? 0); level++) spent += legacyUpgradeCost(id, level);
	});
	return spent;
};

export const legacyIncomeMultiplier = (prestige: PrestigeState | undefined): number =>
	1 + REBIRTH.incomePerPoint * (prestige?.legacyEarned ?? 0);

/** Percent off tile cost: Charisma plus Thrift, capped. */
export const effectiveTileDiscount = (
	stats: Pick<CharacterStats, 'tileCostDiscount'>,
	prestige: PrestigeState | undefined,
	merchant?: MerchantUpgrades
): number =>
	Math.min(
		stats.tileCostDiscount + legacyEffect(prestige, 'thrift') * 100 + merchantEffect(merchant, 'bulk'),
		REBIRTH.discountCapPercent
	);

// Merchant upgrades
export type MerchantUpgrades = Partial<Record<string, number>>;

export const merchantLevel = (upgrades: MerchantUpgrades | undefined, id: MerchantUpgradeId): number =>
	Math.max(0, Math.min(MERCHANT_UPGRADES[id].maxLevel, Math.floor(upgrades?.[id] ?? 0)));

export const merchantEffect = (upgrades: MerchantUpgrades | undefined, id: MerchantUpgradeId): number =>
	merchantLevel(upgrades, id) * MERCHANT_UPGRADES[id].effectPerLevel;

export const merchantUpgradeCost = (id: MerchantUpgradeId, level: number): number =>
	Math.ceil(MERCHANT_UPGRADES[id].baseCost * Math.pow(MERCHANT_UPGRADES[id].costGrowth, level));

/** Multiplier on every gold payout from selling to the merchant (Haggler). */
export const sellMultiplier = (upgrades: MerchantUpgrades | undefined): number => 1 + merchantEffect(upgrades, 'haggler');

/** Gold for selling `qty` of something worth `unit` each. */
export const sellPayout = (unit: number, qty: number, upgrades: MerchantUpgrades | undefined): number =>
	Math.floor(unit * qty * sellMultiplier(upgrades));

/** Luck from the Lucky Charm, added to the character's Luck for chests and kills. */
export const merchantLuck = (upgrades: MerchantUpgrades | undefined): number => merchantEffect(upgrades, 'charm');

/** Bag slots a game has: the base bag plus Pack Rat. */
export const bagSizeFor = (baseSize: number, upgrades: MerchantUpgrades | undefined): number => baseSize + merchantEffect(upgrades, 'packrat');

/** Resources a new run starts with: the usual start plus the Provisions bundles. */
export const startingResources = (prestige: PrestigeState | undefined): Resources => {
	const out: Resources = { ...INITIAL_RESOURCES };
	const bundles = legacyEffect(prestige, 'provisions');
	Object.entries(LEGACY_UPGRADES.provisions.bundle).forEach(([resource, amount]) => {
		out[resource as keyof Resources] += (amount || 0) * bundles;
	});
	return out;
};

export const legacyGain = (castleLevel: number, tiles: number): number => REBIRTH.gain(castleLevel, tiles);
