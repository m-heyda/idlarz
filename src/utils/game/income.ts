// Income per second: what one tile produces, and the full breakdown and rates (part of the former utils/gameUtils.ts, split in IDL-15).
import { FARM_KEYS, zeroResources } from '@/catalog/resourceKeys';
import { BASE_GENERATION_RATES, BIOME_YIELD, SCALING_CONFIG } from '@/config/economy';
import { BIOMES } from '@/config/biomes';
import { CASTLE_UPGRADE, CASTLE_X, CASTLE_Y } from '@/config/castle';
import { CHARACTER_STAT_CONFIG } from '@/config/character';
import type { BiomeType, CharacterStats, GameState, PrestigeState, ResourceRates, Resources } from '@/types/game';
import { castleAreaBonus, castleRangeRadius, inCastleRange } from '@/lib/castleWard';
import { forEachOwned, getTile, type World } from '@/utils/world';
import { castleModifier } from '@/utils/game/castle';
import { calculateStatResourceModifiers } from '@/utils/game/character';
import { calculateFarmOutput, type FarmUpgrades } from '@/utils/game/farm';
import { merchantEffect, merchantIncomeMultiplier, type MerchantUpgrades } from '@/utils/game/merchant';
import { emberIncomeMultiplier } from '@/utils/game/rebirth';
import { countOwnedBiomeTypes } from '@/utils/game/tiles';

const countAdjacentSameBiomes = (tiles: GameState['tiles'], x: number, y: number, biome: BiomeType): number =>
	(getTile(tiles, x - 1, y)?.biome === biome ? 1 : 0) +
	(getTile(tiles, x + 1, y)?.biome === biome ? 1 : 0) +
	(getTile(tiles, x, y - 1)?.biome === biome ? 1 : 0) +
	(getTile(tiles, x, y + 1)?.biome === biome ? 1 : 0);

/** Where one resource's income comes from, piece by piece. `base` and `total` are exactly what `calculateResourceRates` reports. */
export interface ResourceBreakdownEntry {
	/** Flat income of the realm itself (before any tile) */
	start: number;
	/** Farm animals */
	farm: number;
	/** Biome tiles, with the adjacency bonus and the yield scale applied */
	biome: number;
	/** What the castle area bonus adds on the tiles inside the castle range */
	castleArea: number;
	/** Flat XP from castle levels above 1 */
	castleXp: number;
	/** start + farm + biome + castleArea + castleXp */
	base: number;
	/** Percentage bonuses (0.2 = +20%), added together before the ember multiplier */
	castleMod: number;
	plainsMod: number;
	statMod: number;
	/** The rebirth income multiplier (1 = none) */
	emberMult: number;
	/** The merchant's Foreman multiplier (1 = none; never on XP) */
	merchantMult: number;
	/** The worn gear's set-bonus income multiplier (1 = none; never on XP) */
	gearMult: number;
	/** All of the above folded into one modifier, as shown in tooltips: (1 + castle + plains + stats) * ember multiplier * merchant * gear - 1 */
	modifier: number;
	total: number;
}

type ResourceBreakdown = Record<keyof Resources, ResourceBreakdownEntry>;

const RESOURCE_KEYS = Object.keys(BASE_GENERATION_RATES) as (keyof Resources)[];

/** What one tile produces per second (before the global modifiers), split into the part that is its own and the bonuses on it. */
interface TileOutput {
	/** The biome's own output (with the yield scale) */
	base: Partial<Resources>;
	/** Extra from adjacent tiles of the same biome */
	neighbour: Partial<Resources>;
	/** Extra from the castle area bonus (0 outside the range or below castle level 7) */
	area: Partial<Resources>;
	/** The adjacency step count, and the area bonus as a fraction (1 = +100%) */
	adjacent: number;
	areaBonus: number;
}

/**
 * The one place a single tile's output is priced; the tooltip, the tile tap and the castle area pass of the income all use it.
 *
 * Neighbour bonus: +25% per same-biome 4-neighbour (`SCALING_CONFIG.adjacencyBonus`). A tile inside the castle range also gets the castle area bonus ({@link castleAreaBonus}).
 *
 * @category Economy/Income
 * @order 3
 */
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
	return out;
};

/**
 * Income per second of every resource, split into its sources and modifiers (the one place the income formula lives).
 *
 * The one function that builds the income. Every number the UI shows as "per second" (header, tooltips, the tick) comes from here.
 *
 * Everything inside the first bracket is added, the three multipliers after it are multiplied. The meat and hide of the farm are multiplied by the merchant's
 * Skinner before they enter `base`. The castle tile itself gets no yield scale and no neighbour bonus.
 *
 * - `plainsMod`: +5% meat per owned Plains tile (`CHARACTER_STAT_CONFIG.plainsMeatModifier`).
 * - `statMod`: +2.5% per attribute point on the resources each attribute feeds, and +0.2% / +0.25% XP per Intelligence / Charisma point, see {@link calculateStatResourceModifiers}.
 * - `emberMult`: see {@link emberIncomeBonus}.
 * - `foreman`: the merchant upgrade, +1% per level on every resource but XP. `gearIncome`: the set bonus Income %, on every resource but XP (`src/lib/gearEconomy.ts`).
 *
 * @category Economy/Income
 * @order 2
 * @formula
 * base[r]  = BASE_GENERATION_RATES[r]
 *          + farm output (meat, eggs, milk, hide; the farm has no other source of those four)
 *          + sum over owned tiles of biome output[r] x BIOME_YIELD.scale x (1 + 0.25 x same-biome 4-neighbours)
 *          + sum over tiles inside the castle range of the same tile output x castleAreaBonus(castle level)
 *          + 0.5 x (castle level - 1)                      (xp only)
 * modifier[r] = (1 + castleModifier + plainsMod[r] + statMod[r]) x emberMult x foreman x gearIncome - 1
 * total[r] = base[r] x (1 + modifier[r])
 * @see calculateTileOutput, castleModifier, castleAreaBonus, calculateFarmOutput
 */
export const calculateResourceBreakdown = (
	tiles: World,
	characterStats?: CharacterStats,
	farmLevels: Record<string, number> = {},
	prestige?: PrestigeState,
	farmUpgrades?: FarmUpgrades,
	merchantUpgrades?: MerchantUpgrades,
	/** The worn gear's Income % (set bonuses; `gearIncomePct` in lib/gearEconomy.ts) */
	gearIncomePct = 0,
): ResourceBreakdown => {
	const base: Resources = { ...BASE_GENERATION_RATES };
	const start: Resources = { ...BASE_GENERATION_RATES };
	const farmPart = zeroResources();
	const biomePart = zeroResources();

	// Meat and the other farm products come from the animals alone (the Skinner's bonus is on the meat and the hide)
	const farm = calculateFarmOutput(farmLevels, farmUpgrades);
	const skinner = 1 + merchantEffect(merchantUpgrades, 'skinner');
	farm.meat *= skinner;
	farm.hide *= skinner;
	for (const key of FARM_KEYS) {
		base[key] = farm[key];
		start[key] = 0;
		farmPart[key] = farm[key];
	}

	/**
	 * Calculate base rates from tiles. Tiles are counted by (biome, same-biome neighbours) first and each group is
	 * priced once, so a map of tens of thousands of tiles costs one cheap pass instead of an allocation per tile.
	 */
	const biomeNames = Object.keys(BIOMES);
	const biomeSlot = new Map(biomeNames.map((name, i) => [name, i]));
	const groups = new Float64Array(biomeNames.length * 5);
	forEachOwned(tiles, (tile, x, y) => {
		const b = biomeSlot.get(tile.biome);
		if (b === undefined) return;
		const adjacent = countAdjacentSameBiomes(tiles, x, y, tile.biome);
		groups[b * 5 + adjacent]++;
	});
	for (let b = 0; b < biomeNames.length; b++) {
		const biome = BIOMES[biomeNames[b]];
		// Biome output is boosted by BIOME_YIELD.scale; the castle (unique tile) is not
		const yieldScale = biomeNames[b] === 'castle' ? 1 : BIOME_YIELD.scale;
		for (let adjacent = 0; adjacent < 5; adjacent++) {
			const adjacencyMultiplier = 1 + SCALING_CONFIG.adjacencyBonus * adjacent;
			const count = groups[b * 5 + adjacent];
			if (count === 0) continue;
			for (const [resource, rate] of Object.entries(biome.resourceGeneration)) {
				if (rate) {
					// Add to base rate with adjacency bonus
					const gain = count * rate * adjacencyMultiplier * yieldScale;
					base[resource as keyof Resources] += gain;
					biomePart[resource as keyof Resources] += gain;
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

	// Embers income bonus multiplies everything; it is folded into the modifier so tooltips stay consistent
	const emberMult = emberIncomeMultiplier(prestige);
	const foreman = merchantIncomeMultiplier(merchantUpgrades);
	const gearIncome = 1 + gearIncomePct / 100;

	const result = {} as ResourceBreakdown;
	for (const key of RESOURCE_KEYS) {
		const merchantMult = key === 'xp' ? 1 : foreman;
		const gearMult = key === 'xp' ? 1 : gearIncome;
		const modifier = (1 + (castleBonus + plainsMod[key] + statMod[key])) * emberMult * merchantMult * gearMult - 1;
		result[key] = {
			start: start[key],
			farm: farmPart[key],
			biome: biomePart[key],
			castleArea: areaPart[key],
			castleXp: key === 'xp' ? castleXp : 0,
			base: base[key],
			castleMod: castleBonus,
			plainsMod: plainsMod[key],
			statMod: statMod[key],
			emberMult,
			merchantMult,
			gearMult,
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
	farmUpgrades?: FarmUpgrades,
	merchantUpgrades?: MerchantUpgrades,
	gearIncomePct = 0,
): ResourceRates => {
	const breakdown = calculateResourceBreakdown(tiles, characterStats, farmLevels, prestige, farmUpgrades, merchantUpgrades, gearIncomePct);
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
