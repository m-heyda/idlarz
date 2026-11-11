import { BIOMES } from '@/config/biomes';
import { BUILDING_RULES, BUILDINGS_FLAG, IDOL_RULES } from '@/config/buildings';
import { HARD_LIMITS } from '@/config/limits';
import { limitOf } from '@/lib/limits';
import { BUILDINGS, buildingDef, type BuildingDef } from '@/catalog/buildings';
import { calculateTileCost, tileCostAsResources } from '@/utils/game/costs';
import { emberEffect } from '@/utils/game/rebirth';
import { biomeCount, forEachOwned, getTile, setTile, type World } from '@/utils/world';
import { monsterAt } from '@/lib/monsters';
import type { BuildingUpgradeState, CastleUpgradeState, Monster, PrestigeState, Resources } from '@/types/game';

/** Whether the building system is switched on (`BUILDINGS_FLAG`, off by default). Every entry point of the system asks this first. */
export const buildingsEnabled = (): boolean => BUILDINGS_FLAG.enabled;

export { buildingOutput, extractorOutput, producerBonus, producerOutput } from '@/lib/buildingOutput';

/** The highest level a building can be bought to at this castle level: `min(maxLevel, castle level)`. */
export const buildingLevelCap = (castleLevel: number): number => Math.min(BUILDING_RULES.maxLevel, Math.max(1, Math.floor(castleLevel)));

/**
 * The highest level a building can be taken to now: Producers and Extractors `min(5, castle level)`; an Idol the same up to level 5 and, above it, only the purchased cap (`idolMaxLevel`, base 5, raised by the Ember shop's Idol Mastery,
 * never past its hard limit): the castle gates the first five levels, the shop the rest.
 */
export const upgradeCapOf = (def: BuildingDef | undefined, castleLevel: number, idolMax: number = limitOf('idolMaxLevel')): number => {
	const gate = buildingLevelCap(castleLevel);
	if (def?.kind !== 'idol') return gate;
	const cap = Math.min(idolMax, HARD_LIMITS.idolMaxLevel);
	return castleLevel < BUILDING_RULES.maxLevel ? Math.min(cap, gate) : cap;
};

/**
 * Seconds the next level takes, from `fromLevel` to `fromLevel + 1` (10 min, 45 min, 3 h, 8 h); Master Builders (Ember shop) shortens it like the castle's timer.
 *
 * @category Economy/Buildings
 * @order 5
 * @formula
 * seconds = floor(durationsSec[fromLevel - 1] x (1 - min(0.6, 0.05 x Master Builders level + Dwarf Statue %)))
 */
export const buildingUpgradeDuration = (fromLevel: number, prestige?: PrestigeState, idolBuildTimePct = 0): number => {
	const table = BUILDING_RULES.durationsSec;
	// past the base ladder (an Idol raised above level 5 by the Ember shop): the last timer x1.35 per level, at most 7 days
	const base = table[fromLevel - 1] ?? Math.min(7 * 86400, (table[table.length - 1] ?? 0) * Math.pow(1.35, fromLevel - table.length));
	return Math.floor(base * (1 - buildTimeReduction(prestige, idolBuildTimePct)));
};

/** The share of a build timer taken off: Master Builders (5 % per level) plus the Dwarf Statue, together at most `buildTimeCap` (60 %). */
export const buildTimeReduction = (prestige: PrestigeState | undefined, idolBuildTimePct = 0): number =>
	Math.min(IDOL_RULES.buildTimeCap / 100, emberEffect(prestige, 'builders') + idolBuildTimePct / 100);

/**
 * The price of reaching `level` (1 = building it): `tilePrices` times the price of the next tile at the current tile count (counted up to `priceTileCap`), times `levelGrowth` per level above 1. Gold, wood and stone like a tile.
 *
 * @category Economy/Buildings
 * @order 6
 * @formula
 * cost(level) = floor(tilePrice(min(owned tiles, priceTileCap)) x tilePrices x levelGrowth^(level - 1))   per resource
 */
export const buildingLevelCost = (level: number, ownedTiles: number, def?: BuildingDef): Partial<Resources> => {
	const { tilePrices, priceTileCap, levelGrowth } = BUILDING_RULES.cost;
	const tile = tileCostAsResources(calculateTileCost(Math.min(Math.max(1, ownedTiles), priceTileCap)));
	const mult = tilePrices * Math.pow(levelGrowth, Math.max(1, level) - 1);
	const out: Partial<Resources> = {};
	for (const [key, amount] of Object.entries(tile)) if (amount) out[key as keyof Resources] = Math.floor(amount * mult);
	// an Idol level from 3 also needs the T3 extract of its biome (where the biome has an Extractor): the Extractors feed the economy as well as crafting
	if (def?.kind === 'idol' && level >= 3) {
		const t3 = BUILDINGS.find((b) => b.kind === 'extractor' && b.biome === def.biome)?.produces[0];
		if (t3) out[t3] = IDOL_RULES.t3PerLevel * Math.pow(2, level - 3);
	}
	return out;
};

/** What a building of `level` has cost in all (level 1 up to `level`) at today's prices. */
export const buildingTotalCost = (level: number, ownedTiles: number): Partial<Resources> => {
	const out: Partial<Resources> = {};
	for (let l = 1; l <= level; l++)
		for (const [key, amount] of Object.entries(buildingLevelCost(l, ownedTiles)))
			out[key as keyof Resources] = (out[key as keyof Resources] ?? 0) + (amount ?? 0);
	return out;
};

/** The price of moving a building of `level`: `relocateShare` of {@link buildingTotalCost}. */
export const relocationCost = (level: number, ownedTiles: number): Partial<Resources> => {
	const out: Partial<Resources> = {};
	for (const [key, amount] of Object.entries(buildingTotalCost(level, ownedTiles)))
		out[key as keyof Resources] = Math.floor((amount ?? 0) * BUILDING_RULES.relocateShare);
	return out;
};

/** The level of the building on a tile (1 when the field is absent), or 0 when there is none. */
export const levelOfTile = (tile: { building?: string; buildingLevel?: number } | undefined): number =>
	tile?.building ? Math.max(1, Math.min(HARD_LIMITS.idolMaxLevel, Math.floor(tile.buildingLevel ?? 1))) : 0;

export interface BuiltBuilding {
	id: string;
	x: number;
	y: number;
	level: number;
}

/** Every building on the map (one pass over the owned tiles, so call it per action, not per frame). */
export const builtBuildings = (world: World): BuiltBuilding[] => {
	const out: BuiltBuilding[] = [];
	forEachOwned(world, (tile, x, y) => {
		if (tile.building) out.push({ id: tile.building, x, y, level: levelOfTile(tile) });
	});
	return out;
};

/** What the rules need to know about the game to judge an action. */
export interface BuildingContext {
	tiles: World;
	monsters: readonly Monster[];
	castleLevel: number;
	castleUpgrade: CastleUpgradeState | null;
	buildingUpgrade: BuildingUpgradeState | null;
	/** Tiles counted for prices (`economyTiles`) */
	ownedTiles: number;
	/** The Idol level cap in force ({@link limitOf} `idolMaxLevel` with the Ember shop's raises); absent = the base */
	idolMax?: number;
}

/** Why a tile cannot take this building, or null when it can: owned, not the castle, no building, chest or monster on it, and of the building's biome. */
const tileProblem = (ctx: BuildingContext, x: number, y: number, def: BuildingDef): string | null => {
	const tile = getTile(ctx.tiles, x, y);
	if (!tile || !tile.isOwned) return 'Not your land';
	if (tile.biome === 'castle') return 'Not on the castle';
	if (tile.building) return 'Already has a building';
	if (tile.hasChest) return 'A chest is here';
	if (monsterAt(ctx.monsters as Monster[], x, y)) return 'A monster is here';
	if (tile.biome !== def.biome) return `Needs ${BIOMES[def.biome]?.label ?? def.biome}`;
	return null;
};

/** Why the builder is busy, or null when it is free (the castle and the buildings share one). */
export const builderBusy = (ctx: Pick<BuildingContext, 'castleUpgrade' | 'buildingUpgrade'>): string | null =>
	ctx.castleUpgrade ? 'The builder is upgrading the castle' : ctx.buildingUpgrade ? 'The builder is busy with a building' : null;

/**
 * Why `id` cannot be built on tile (x, y) now, or null when it can: the system is on, the type exists, **one of each type per map**, and the tile fits.
 * Paying is the caller's check, so the menu can show the price next to the reason.
 */
export const buildProblem = (ctx: BuildingContext, x: number, y: number, id: string): string | null => {
	if (!buildingsEnabled()) return 'Buildings are not available yet';
	const def = buildingDef(id);
	if (!def) return 'Unknown building';
	if (builtBuildings(ctx.tiles).some((b) => b.id === id)) return `The ${def.label} is already built`;
	return tileProblem(ctx, x, y, def);
};

/** Why the building on tile (x, y) cannot go up a level now, or null: it must exist, be below `min(5, castle level)`, and the builder must be free. Paying is the caller's check. */
export const upgradeProblem = (ctx: BuildingContext, x: number, y: number): string | null => {
	if (!buildingsEnabled()) return 'Buildings are not available yet';
	const tile = getTile(ctx.tiles, x, y);
	if (!tile?.building || !buildingDef(tile.building)) return 'No building here';
	const level = levelOfTile(tile);
	const def = buildingDef(tile.building);
	const top = def?.kind === 'idol' ? Math.min(ctx.idolMax ?? limitOf('idolMaxLevel'), HARD_LIMITS.idolMaxLevel) : BUILDING_RULES.maxLevel;
	if (level >= top) return 'Highest level';
	if (level >= upgradeCapOf(def, ctx.castleLevel, ctx.idolMax)) return `Needs castle level ${level + 1}`;
	return builderBusy(ctx);
};

/** Why the building on (fromX, fromY) cannot move to (toX, toY), or null. Paying is the caller's check. */
export const moveProblem = (ctx: BuildingContext, fromX: number, fromY: number, toX: number, toY: number): string | null => {
	if (!buildingsEnabled()) return 'Buildings are not available yet';
	const from = getTile(ctx.tiles, fromX, fromY);
	const def = buildingDef(from?.building);
	if (!from || !def) return 'No building here';
	if (fromX === toX && fromY === toY) return 'Already here';
	if (ctx.buildingUpgrade && ctx.buildingUpgrade.x === fromX && ctx.buildingUpgrade.y === fromY) return 'It is being upgraded';
	return tileProblem(ctx, toX, toY, def);
};

/** Owned tiles of the Producer's biome: the size its output grows with. */
export const ownedOfBiome = (world: World, biome: string): number => biomeCount(world, biome);

/** The level an Idol of `biome` is placed at for free (its remembered level), or 0 when it was never learned. */
export const rememberedIdolLevel = (idolLevels: Record<string, number> | undefined, biome: string): number =>
	Math.max(0, Math.min(HARD_LIMITS.idolMaxLevel, Math.floor(idolLevels?.[biome] ?? 0)));

/**
 * A building upgrade that has finished: the tile gets its new level and, for an Idol, the account remembers the level (`idolLevels`, kept across rebirths). Shared by the tick loop and the away-time grant,
 * so a level lands the same way whether the player was watching or not. A tile that no longer has the building changes nothing.
 */
export const completeUpgrade = (
	tiles: World,
	idolLevels: Record<string, number>,
	job: { x: number; y: number; toLevel: number },
): { tiles: World; idolLevels: Record<string, number>; reached: boolean } => {
	const tile = getTile(tiles, job.x, job.y);
	if (!tile?.building) return { tiles, idolLevels, reached: false };
	const def = buildingDef(tile.building);
	return {
		tiles: setTile(tiles, job.x, job.y, { ...tile, buildingLevel: job.toLevel }),
		idolLevels: def?.kind === 'idol' ? { ...idolLevels, [def.biome]: Math.max(idolLevels[def.biome] ?? 0, job.toLevel) } : idolLevels,
		reached: true,
	};
};
