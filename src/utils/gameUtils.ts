import {
	BIOMES,
	CASTLE_UPGRADE,
	CASTLE_X,
	CASTLE_Y,
	BASE_GENERATION_RATES,
	ANIMALS,
	FARM,
	FARM_PEN,
	FARM_UPGRADES,
	type FarmUpgradeId,
	BASE_XP_PER_TILE,
	BASE_XP_PER_LEVEL,
	XP_GROWTH_FACTOR,
	XP_LEVEL_SOFT,
	SCALING_CONFIG,
	XP_TILE,
	XP_CAP,
	RESOURCE_CAP,
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
import { castleAreaBonus, castleLevelOf, castleRangeRadius, inCastleRange } from '@/lib/castleWard';
import { STAT_RULES } from '@/config/combatConfig';
import { atkSpeedPercent, magicDamagePercent, physicalDamagePercent, statArmor, statMaxMana } from '@/lib/statBonuses';
import { RING, generateStartRing } from '@/utils/biomeRules';
import {
	EMPTY_WORLD,
	biomeCount,
	buildingCount,
	forEachOwned,
	getTile,
	ownedCount,
	setTiles,
	type Placed,
	type World,
} from '@/utils/world';

/** Number of owned tiles on the map (kept up to date by the world, so this is O(1)). */
export const countOwnedTiles = (tiles: World): number => ownedCount(tiles);

/** Number of owned tiles of one biome (O(1)). */
export const countOwnedBiomeTypes = (tiles: World, biomeType: BiomeType): number => biomeCount(tiles, biomeType);

/**
 * Gets the description for a character stat
 * @param stat The character stat key
 * @returns Description of what the stat does
 */
const titleCase = (s: string) => s[0].toUpperCase() + s.slice(1);

/** "+2.5% Stone & Coal production per point / +0.2% XP production per point / +0.2% XP gained per point" */
const R = STAT_RULES;

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
		// Every number below is read from STAT_RULES / CHARACTER_STAT_CONFIG: the text cannot drift from the maths. Combat bonuses count points above 5.
		strength: `${resourceEffect('strength')} / +${R.physicalDamagePerStrength}% damage with physical weapons per point above ${R.base} / +${R.armorPerStrength} DEF per point above ${R.base} / +${R.critDamagePerPoint.strength}% Crit DMG per point above ${R.base}`,
		dexterity: `${resourceEffect('dexterity')} / +${R.armorPerDexterity} DEF per point above ${R.base} / +${R.atkSpeedPerDexterity}% ATK Speed per point above ${R.base} / +0.25% Crit Chance per point / +${R.critDamagePerPoint.dexterity}% Crit DMG per point above ${R.base}`,
		intelligence: `${resourceEffect('intelligence')} / +${R.magicDamagePerIntelligence}% damage with magic weapons (staves, wands) per point above ${R.base} / +${R.mana.perIntelligence} Max Mana per point / +${R.mana.regenPerIntelligence} Mana Regen per second per point`,
		vitality: `${resourceEffect('vitality')} / +3 HP per point / +${R.armorPerVitality} DEF per point above ${R.base}`,
		charisma: `${resourceEffect('charisma')} / +${CHARACTER_STAT_CONFIG.tileDiscountPercentPerCharisma}% Tile Cost Discount per point (max ${CHARACTER_STAT_CONFIG.tileDiscountCapPercent}%) / +1 Luck per point (bigger chests) / +0.25 HP per point / +0.5% Crit Chance per point / +${R.critDamagePerPoint.charisma}% Crit DMG per point above ${R.base}`,
		// Combat stats
		physicalAtk: 'Bonus damage with physical weapons: swords, daggers, maces, mauls, axes, spears, bows and crossbows. Grows with Strength.',
		magicAtk: 'Bonus damage with magic weapons: staves and wands. Grows with Intelligence, a little faster than Strength does for physical ones.',
		hp: 'Hit Points. Your health that determines how much damage you can take.',
		mp: 'Mana. Skills like Heal and Stun spend it; it refills over time. Grows with Intelligence and magic gear.',
		def: 'Defense from your attributes, added to your gear armor: it cuts the damage monsters deal.',
		luck: 'Influences random events and rare item finds.',
		critChance:
			'Percentage chance to land a critical hit for increased damage.',
		critDmgMultiplier:
			'Percentage of additional damage dealt on critical hits.',
		atkSpeedIncrease:
			'Percentage increase to attack speed. Clicks do not use it yet: it is the base for the speed-based combat.',
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
	// Basic XP gain increases with the number of tiles owned: each tile contributes XP that grows slightly with more tiles.
	// Up to XP_TILE.growthUntil tiles that is exponential (1.02 per tile); beyond it a polynomial tail keeps it finite.
	const k = Math.min(ownedTiles, XP_TILE.growthUntil);
	const xp = BASE_XP_PER_TILE * Math.pow(1.02, k - 1) * (k / 4);
	return ownedTiles > XP_TILE.growthUntil ? xp * Math.pow(ownedTiles / XP_TILE.growthUntil, XP_TILE.tailExponent) : xp;
};

/** The XP curve of a save from before the soft part (every level was x1.3 on the last): the most levels such a save can have gained. */
export const OLD_XP_LEVEL_SOFT = { fromLevel: Infinity, growth: XP_GROWTH_FACTOR };

/** XP needed to leave level `level`: x1.3 per level up to XP_LEVEL_SOFT.fromLevel, then x`growth` per level. */
export const xpToLeaveLevel = (level: number, soft: { fromLevel: number; growth: number } = XP_LEVEL_SOFT): number => {
	const steep = Math.min(level, soft.fromLevel) - 1;
	const gentle = Math.max(0, level - soft.fromLevel);
	return Math.floor(BASE_XP_PER_LEVEL * Math.pow(XP_GROWTH_FACTOR, steep) * Math.pow(soft.growth, gentle));
};

/**
 * Calculate level based on total XP using exponential scaling
 * Each level requires more XP than the previous one
 */
export const calculateLevel = (
	xp: number,
	soft: { fromLevel: number; growth: number } = XP_LEVEL_SOFT
): { level: number; progress: number } => {
	// Start at level 1, no XP needed for first level
	let level = 1;
	let xpForNextLevel = xpToLeaveLevel(1, soft);
	let remainingXp = Number.isFinite(xp) ? Math.min(xp, XP_CAP) : XP_CAP;

	// Keep leveling up until we don't have enough XP (a non-finite threshold ends it: levels past ~2700 overflow)
	while (remainingXp >= xpForNextLevel) {
		remainingXp -= xpForNextLevel;
		level++;
		xpForNextLevel = xpToLeaveLevel(level, soft);
		if (!Number.isFinite(xpForNextLevel)) return { level, progress: 0 };
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
): number =>
	(getTile(tiles, x - 1, y)?.biome === biome ? 1 : 0) +
	(getTile(tiles, x + 1, y)?.biome === biome ? 1 : 0) +
	(getTile(tiles, x, y - 1)?.biome === biome ? 1 : 0) +
	(getTile(tiles, x, y + 1)?.biome === biome ? 1 : 0);

/** Tiles that did not cost anything: the castle (1) in an old save, the castle and its 8 neighbours in a new game. */
export const STARTER_FREE_TILES = 9;

/**
 * Owned-tile count as the economy sees it: purchases + 1 (the old castle-only start). Tile cost, XP per tile, the extra
 * resource costs, the biome picker cadence and the rebirth requirements all use this, so the free starting ring does not
 * make the first purchases expensive. Pass the state's `freeTiles`.
 */
export const economyTiles = (tiles: World, freeTiles: number): number => countOwnedTiles(tiles) - freeTiles + 1;

/** A new map: the castle at (CASTLE_X, CASTLE_Y) and its 8 neighbours already owned, generated from the basic biomes. */
export const createInitialWorld = (random: () => number = Math.random): World => {
	const placed: Placed[] = [
		{
			x: CASTLE_X,
			y: CASTLE_Y,
			tile: {
				biome: 'castle',
				isOwned: true,
				level: 1,
				upgradeCost: CASTLE_UPGRADE.upgradeCosts[0],
			} as Tile,
		},
	];
	const ring = generateStartRing(random);
	RING.forEach(([dx, dy], i) => placed.push({ x: CASTLE_X + dx, y: CASTLE_Y + dy, tile: { biome: ring[i], isOwned: true } }));
	return setTiles(EMPTY_WORLD, placed);
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
	out[animal.product.resource] = animal.product.perSec * count * pen * up(productUpgrade[animal.product.resource]) * up('pasture');
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
		// the combat ones come from lib/statBonuses.ts (the same functions the fight uses); bonuses count points above 5
		physicalAtk: physicalDamagePercent(stats),
		magicAtk: magicDamagePercent(stats),
		hp: stats.vitality * 3 + stats.charisma * 0.25, // +3 per vitality, +0.25 per charisma
		mp: statMaxMana(stats),
		def: statArmor(stats),
		luck: stats.charisma, // +1 per charisma
		critChance: stats.dexterity * 0.25 + stats.charisma * 0.5, // +0.25% per dex, +0.5% per cha
		critDmgMultiplier:
			100 + stats.strength + stats.dexterity * 0.5 + stats.charisma * 0.5, // Base 100% + str + dex/2 + cha/2 (lucky tile taps)
		atkSpeedIncrease: atkSpeedPercent(stats),
		xpGainMultiplier:
			stats.intelligence * CHARACTER_STAT_CONFIG.xpGainPercentPerPoint.intelligence +
			stats.charisma * CHARACTER_STAT_CONFIG.xpGainPercentPerPoint.charisma,
		tileCostDiscount: Math.min(
			stats.charisma * CHARACTER_STAT_CONFIG.tileDiscountPercentPerCharisma,
			CHARACTER_STAT_CONFIG.tileDiscountCapPercent
		),
	};
};

/** Where one resource's income comes from, piece by piece. `base` and `total` are exactly what `calculateResourceRates` reports. */
export interface ResourceBreakdownEntry {
	/** Flat income of the realm itself (before any tile) */
	start: number;
	/** Farm animals */
	farm: number;
	/** Biome tiles, with the adjacency bonus and the yield scale applied */
	biome: number;
	/** Buildings, with the adjacency bonus and the yield scale applied */
	building: number;
	/** What the castle area bonus adds on the tiles (and their buildings) inside the castle range */
	castleArea: number;
	/** Flat XP from castle levels above 1 */
	castleXp: number;
	/** start + farm + biome + building + castleArea + castleXp */
	base: number;
	/** Percentage bonuses (0.2 = +20%), added together before the legacy multiplier */
	castleMod: number;
	plainsMod: number;
	statMod: number;
	/** The rebirth income multiplier (1 = none) */
	legacyMult: number;
	/** All of the above folded into one modifier, as shown in tooltips: (1 + castle + plains + stats) * legacy - 1 */
	modifier: number;
	total: number;
}

export type ResourceBreakdown = Record<keyof Resources, ResourceBreakdownEntry>;

const RESOURCE_KEYS = Object.keys(BASE_GENERATION_RATES) as (keyof Resources)[];
const FARM_KEYS = ['meat', 'eggs', 'milk', 'hide'] as const;

const zeroResources = (): Resources => ({ gold: 0, wood: 0, stone: 0, coal: 0, food: 0, meat: 0, eggs: 0, milk: 0, hide: 0, xp: 0 });

/** What one tile produces per second (before the global modifiers), split into the part that is its own and the bonuses on it. */
export interface TileOutput {
	/** The biome's and the building's own output (with the yield scale) */
	base: Partial<Resources>;
	/** Extra from adjacent tiles of the same biome */
	neighbour: Partial<Resources>;
	/** Extra from the castle area bonus (0 outside the range or below castle level 7) */
	area: Partial<Resources>;
	/** The adjacency step count, and the area bonus as a fraction (1 = +100%) */
	adjacent: number;
	areaBonus: number;
}

/** The one place a single tile's output is priced; the tooltip, the tile tap and the castle area pass of the income all use it. */
export const calculateTileOutput = (tiles: World, x: number, y: number, castleLevel: number): TileOutput | null => {
	const tile = getTile(tiles, x, y);
	if (!tile) return null;
	const adjacent = countAdjacentSameBiomes(tiles, x, y, tile.biome);
	const adjacency = 1 + SCALING_CONFIG.adjacencyBonus * adjacent;
	const areaBonus = inCastleRange(x, y, castleLevel) ? castleAreaBonus(castleLevel) : 0;
	const yieldScale = tile.biome === 'castle' ? 1 : BIOME_YIELD.scale;
	const out: TileOutput = { base: {}, neighbour: {}, area: {}, adjacent, areaBonus };
	const add = (resource: string, rate: number | undefined, scale: number) => {
		if (!rate) return;
		const key = resource as keyof Resources;
		const own = rate * scale;
		const withNeighbours = own * adjacency;
		out.base[key] = (out.base[key] || 0) + own;
		out.neighbour[key] = (out.neighbour[key] || 0) + (withNeighbours - own);
		out.area[key] = (out.area[key] || 0) + withNeighbours * areaBonus;
	};
	for (const [resource, rate] of Object.entries(BIOMES[tile.biome].resourceGeneration)) add(resource, rate as number, yieldScale);
	// A building adds its own output on top of the tile's biome output, with the same neighbour bonus
	const building = tile.building ? BUILDINGS[tile.building as BuildingType] : undefined;
	if (building?.resourceGeneration) {
		for (const [resource, rate] of Object.entries(building.resourceGeneration)) {
			if (typeof rate === 'number') add(resource, rate, BIOME_YIELD.scale);
		}
	}
	return out;
};

/** Income per second of every resource, split into its sources and modifiers (the one place the income formula lives). */
export const calculateResourceBreakdown = (
	tiles: World,
	characterStats?: CharacterStats,
	farmLevels: Record<string, number> = {},
	prestige?: PrestigeState,
	farmUpgrades?: FarmUpgrades
): ResourceBreakdown => {
	const base: Resources = { ...BASE_GENERATION_RATES };
	const start: Resources = { ...BASE_GENERATION_RATES };
	const farmPart = zeroResources();
	const biomePart = zeroResources();
	const buildingPart = zeroResources();

	// Meat and the other farm products come from the animals alone
	const farm = calculateFarmOutput(farmLevels, farmUpgrades);
	for (const key of FARM_KEYS) {
		base[key] = farm[key];
		start[key] = 0;
		farmPart[key] = farm[key];
	}

	// Calculate base rates from tiles. Tiles are counted by (biome, same-biome neighbours, building) first and each group is
	// priced once, so a map of tens of thousands of tiles costs one cheap pass instead of an allocation per tile.
	const biomeNames = Object.keys(BIOMES);
	const biomeSlot = new Map(biomeNames.map((name, i) => [name, i]));
	const buildingNames = ['', ...Object.keys(BUILDINGS)];
	const buildingSlot = new Map(buildingNames.map((name, i) => [name, i]));
	const groups = new Float64Array(biomeNames.length * 5 * buildingNames.length);
	forEachOwned(tiles, (tile, x, y) => {
		const b = biomeSlot.get(tile.biome);
		if (b === undefined) return;
		const adjacent = countAdjacentSameBiomes(tiles, x, y, tile.biome);
		const bld = tile.building ? buildingSlot.get(tile.building) ?? 0 : 0;
		groups[(b * 5 + adjacent) * buildingNames.length + bld]++;
	});
	for (let b = 0; b < biomeNames.length; b++) {
		const biome = BIOMES[biomeNames[b]];
		// Biome output is boosted by BIOME_YIELD.scale; the castle (unique tile) is not
		const yieldScale = biomeNames[b] === 'castle' ? 1 : BIOME_YIELD.scale;
		for (let adjacent = 0; adjacent < 5; adjacent++) {
			const adjacencyMultiplier = 1 + SCALING_CONFIG.adjacencyBonus * adjacent;
			for (let bld = 0; bld < buildingNames.length; bld++) {
				const count = groups[(b * 5 + adjacent) * buildingNames.length + bld];
				if (count === 0) continue;
				for (const [resource, rate] of Object.entries(biome.resourceGeneration)) {
					if (rate) {
						// Add to base rate with adjacency bonus
						const gain = count * rate * adjacencyMultiplier * yieldScale;
						base[resource as keyof Resources] += gain;
						biomePart[resource as keyof Resources] += gain;
					}
				}
				// A building adds its own output on top of the tile's biome output
				const building = bld > 0 ? BUILDINGS[buildingNames[bld] as BuildingType] : undefined;
				if (building && building.resourceGeneration) {
					for (const [resource, rate] of Object.entries(building.resourceGeneration)) {
						if (rate && typeof rate === 'number') {
							const gain = count * rate * adjacencyMultiplier * BIOME_YIELD.scale;
							base[resource as keyof Resources] += gain;
							buildingPart[resource as keyof Resources] += gain;
						}
					}
				}
			}
		}
	}

	// Calculate castle modifier (exponential growth - doubles each level after level 1)
	const castleTile = getTile(tiles, CASTLE_X, CASTLE_Y);
	const castleLevel = castleTile && castleTile.biome === 'castle' && castleTile.level ? castleTile.level : 1;
	const castleBonus = castleModifier(castleLevel);

	// The castle area bonus: the tiles inside the range (at most 9x9) add their output once more per range step
	const areaPart = zeroResources();
	if (castleAreaBonus(castleLevel) > 0) {
		const radius = castleRangeRadius(castleLevel);
		for (let y = CASTLE_Y - radius; y <= CASTLE_Y + radius; y++) {
			for (let x = CASTLE_X - radius; x <= CASTLE_X + radius; x++) {
				const output = calculateTileOutput(tiles, x, y, castleLevel);
				if (!output) continue;
				for (const [resource, gain] of Object.entries(output.area)) {
					base[resource as keyof Resources] += gain;
					areaPart[resource as keyof Resources] += gain;
				}
			}
		}
	}

	// Castle levels above 1 add flat XP/s
	const castleXp = CASTLE_UPGRADE.xpBonus * Math.max(castleLevel - 1, 0);
	base.xp += castleXp;

	// Each owned Plains tile provides a 5% bonus to meat production
	const plainsMod = zeroResources();
	const plainsCount = countOwnedBiomeTypes(tiles, 'plains');
	if (plainsCount > 0) plainsMod.meat = plainsCount * CHARACTER_STAT_CONFIG.plainsMeatModifier;

	// Stat-based resource modifiers, when stats are provided
	const statMod = zeroResources();
	if (characterStats) {
		Object.entries(calculateStatResourceModifiers(characterStats)).forEach(([resource, modifier]) => {
			statMod[resource as keyof Resources] += modifier;
		});
	}

	// Legacy income bonus multiplies everything; it is folded into the modifier so tooltips stay consistent
	const legacyMult = legacyIncomeMultiplier(prestige);

	const result = {} as ResourceBreakdown;
	for (const key of RESOURCE_KEYS) {
		const modifier = (1 + (castleBonus + plainsMod[key] + statMod[key])) * legacyMult - 1;
		result[key] = {
			start: start[key],
			farm: farmPart[key],
			biome: biomePart[key],
			building: buildingPart[key],
			castleArea: areaPart[key],
			castleXp: key === 'xp' ? castleXp : 0,
			base: base[key],
			castleMod: castleBonus,
			plainsMod: plainsMod[key],
			statMod: statMod[key],
			legacyMult,
			modifier,
			total: base[key] * (1 + modifier),
		};
	}
	return result;
};

export const calculateResourceRates = (
	tiles: World,
	characterStats?: CharacterStats,
	farmLevels: Record<string, number> = {},
	prestige?: PrestigeState,
	farmUpgrades?: FarmUpgrades
): ResourceRates => {
	const breakdown = calculateResourceBreakdown(tiles, characterStats, farmLevels, prestige, farmUpgrades);
	const base = zeroResources();
	const modifiers = zeroResources();
	const total = zeroResources();
	for (const key of RESOURCE_KEYS) {
		base[key] = breakdown[key].base;
		modifiers[key] = breakdown[key].modifier;
		total[key] = breakdown[key].total;
	}
	return { base, modifiers, total };
};

// Per-second output of one owned tile (biome + building, adjacency and castle area bonus, global modifiers).
// Used for the tile-tap bonus. XP is excluded on purpose.
export const calculateTileTapYield = (
	tiles: World,
	x: number,
	y: number,
	rates: ResourceRates
): Partial<Resources> => {
	const output = calculateTileOutput(tiles, x, y, castleLevelOf(tiles));
	if (!output) return {};
	const out: Partial<Resources> = {};
	for (const resource of Object.keys(output.base) as (keyof Resources)[]) {
		if (resource === 'xp') continue;
		const perSecond = (output.base[resource] || 0) + (output.neighbour[resource] || 0) + (output.area[resource] || 0);
		if (perSecond) out[resource] = perSecond * (1 + (rates.modifiers[resource] || 0));
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

export const countBuildings = (tiles: World): number => buildingCount(tiles);

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
	tiles: World,
	prestige?: PrestigeState
): Partial<Resources> => {
	const factor = buildingCostFactor(countBuildings(tiles)) * (1 - legacyEffect(prestige, 'thrift'));
	const cost: Partial<Resources> = {};
	Object.entries(BUILDING_COST.base).forEach(([resource, amount]) => {
		// finite whatever the building count (1.15^n overflows past ~4,900 buildings)
		cost[resource as keyof Resources] = Math.floor(Math.min((amount || 0) * factor, RESOURCE_CAP / 100));
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

/** What can raise what the merchant pays: the merchant bonuses now, rebirth (Legacy) effects later. A whole game state fits. */
export interface SellContext {
	merchantUpgrades?: MerchantUpgrades;
	prestige?: PrestigeState;
}

/**
 * The sources of the sell bonus, each an amount added to 1 (0.03 is +3 %). Every payout for what the player sells (resources,
 * bag gear, junk, auto-sold drops, the previews and the net-worth check) goes through `sellMultiplier`, so a new bonus (a Legacy
 * effect, a merchant level, an event) is one entry here and applies to all of them alike.
 */
export const SELL_BONUSES: ((ctx: SellContext) => number)[] = [(ctx) => merchantEffect(ctx.merchantUpgrades, 'haggler')];

/** Multiplier on every gold payout from selling to the merchant. */
export const sellMultiplier = (ctx: SellContext | undefined): number => 1 + SELL_BONUSES.reduce((sum, bonus) => sum + (ctx ? bonus(ctx) : 0), 0);

/** Gold for selling `qty` of something worth `unit` each. */
export const sellPayout = (unit: number, qty: number, ctx: SellContext | undefined): number => Math.floor(unit * qty * sellMultiplier(ctx));

/** Luck from the Lucky Charm, added to the character's Luck for chests and kills. */
export const merchantLuck = (upgrades: MerchantUpgrades | undefined): number => merchantEffect(upgrades, 'charm');

/** Bag slots a game has: the base bag plus Pack Rat. */


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
