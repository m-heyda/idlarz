import {
	BIOMES,
	BIOME_SPAWN,
	CASTLE_UPGRADE,
	GRID_SIZE,
	GRID_HEIGHT,
	BASE_GENERATION_RATES,
	SPECIAL_SINGLE_TYPE_BIOMES,
	EMPTY_BIOMES,
	ANIMALS,
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
	TILE_RESOURCE_COST,
} from '@/config/gameConfig';
import {
	Animal,
	BiomeType,
	CharacterStats,
	GameState,
	ResourceRates,
	Resources,
	Tile,
	TileCost,
} from '@/types/game';

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

export const createInitialGrid = (): Tile[][] => {
	const grid = Array(GRID_HEIGHT)
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

	return grid;
};

// Resource Management
// Calculate stat-based resource modifiers
export const calculateStatResourceModifiers = (
	stats: CharacterStats
): Resources => {
	const modifiers = {
		gold: 0,
		wood: 0,
		stone: 0,
		coal: 0,
		food: 0,
		meat: 0,
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

// Meat/s of `level` animals of one kind (every purchase adds one more animal)
export const calculateAnimalProduction = (
	animal: Animal,
	level: number
): number => {
	if (level <= 0) return 0;
	return animal.baseProduction * level;
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

export const calculateTotalMeatProduction = (
	farmLevels: Record<string, number>
): number => {
	let totalProduction = 0;

	// ANIMALS is an array, not an object, so use forEach directly
	ANIMALS.forEach((animal) => {
		const level = farmLevels[animal.id] || 0;
		if (level > 0) {
			totalProduction += calculateAnimalProduction(animal, level);
		}
	});

	return totalProduction;
};

export const calculateResourceRates = (
	tiles: Tile[][],
	characterStats?: CharacterStats,
	farmLevels: Record<string, number> = {}
): ResourceRates => {
	const base = { ...BASE_GENERATION_RATES };
	const modifiers: Resources = { gold: 0, wood: 0, stone: 0, coal: 0, food: 0, meat: 0, xp: 0 };
	const total = { ...BASE_GENERATION_RATES };

	// Add meat production from animals to base rates
	const meatProduction = calculateTotalMeatProduction(farmLevels);
	base.meat = meatProduction;

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

				// Add building resources if the tile is an upgraded grounds tile with a building
				if (tile.biome === 'grounds' && tile.level === 2 && tile.building) {
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

	// Calculate total rates
	Object.keys(total).forEach((resource) => {
		const key = resource as keyof Resources;
		total[key] = base[key] * (1 + modifiers[key]);
	});

	return { base, modifiers, total };
};

// Biome Generation: a random purchase picks a biome by weight; water and shores cluster around existing water
export const getRandomBiome = (
	tiles?: Tile[][],
	x = 0,
	y = 0,
	random: () => number = Math.random
): BiomeType => {
	const BIOMES_TO_EXCLUDE = [...SPECIAL_SINGLE_TYPE_BIOMES, ...EMPTY_BIOMES];
	const available = Object.keys(BIOMES).filter((name) => !BIOMES_TO_EXCLUDE.includes(name as BiomeType));

	const around = tiles
		? ([[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const).map(([ax, ay]) => tiles[ay]?.[ax])
		: [];
	const nearLake = around.some((t) => t?.isOwned && t.biome === 'lake');
	const nearCoast = around.some((t) => t?.isOwned && t.biome === 'coast');

	const weights = available.map((name) => {
		let w = BIOME_SPAWN.weights[name] ?? 1;
		if (nearLake) w *= BIOME_SPAWN.nearLake[name] ?? 1;
		if (nearCoast) w *= BIOME_SPAWN.nearCoast[name] ?? 1;
		return w;
	});
	let roll = random() * weights.reduce((a, b) => a + b, 0);
	for (let i = 0; i < available.length; i++) {
		roll -= weights[i];
		if (roll < 0) return available[i] as BiomeType;
	}
	return available[available.length - 1] as BiomeType;
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
	if (tile.biome === 'grounds' && tile.level === 2 && tile.building) {
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

/** Cost of the next building: base cost x growth^(buildings already built). */
export const calculateBuildingCost = (tiles: Tile[][]): Partial<Resources> => {
	const factor = Math.pow(BUILDING_COST.growth, countBuildings(tiles));
	const cost: Partial<Resources> = {};
	Object.entries(BUILDING_COST.base).forEach(([resource, amount]) => {
		cost[resource as keyof Resources] = Math.floor((amount || 0) * factor);
	});
	return cost;
};

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
export const castleUpgradeDuration = (fromLevel: number): number =>
	CASTLE_UPGRADE.durationsSec[fromLevel - 1] ?? 0;
