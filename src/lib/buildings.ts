import { BIOMES } from '@/config/biomes';
import { BUILDING_RULES, BUILDINGS_FLAG, IDOL_RULES } from '@/config/buildings';
import { HARD_LIMITS } from '@/config/limits';
import { busyBuilders } from '@/lib/builders';
import { limitOf, type LimitContext } from '@/lib/limits';
import { BUILDINGS, buildingDef, type BuildingDef } from '@/catalog/buildings';
import { calculateTileCost, tileCostAsResources } from '@/utils/game/costs';
import { emberEffect } from '@/utils/game/rebirth';
import { biomeCount, forEachOwned, getTile, setTile, type World } from '@/utils/world';
import { monsterAt } from '@/lib/monsters';
import type { BuildingUpgradeState, CastleUpgradeState, Monster, PrestigeState, Resources } from '@/types/game';

/** Whether the building system is switched on (`BUILDINGS_FLAG`, off by default). Every entry point of the system asks this first. */
export const buildingsEnabled = (): boolean => BUILDINGS_FLAG.enabled;

export { buildingOutput, extractorOutput, producerBonus, producerOutput } from '@/lib/buildingOutput';

/** The highest level a Producer or Extractor can be bought to at this castle level: `min(cap, castle level)`, where `cap` is `buildingMaxLevel` (base 5, Master Masonry raises it). */
export const buildingLevelCap = (castleLevel: number, buildingMax: number = BUILDING_RULES.maxLevel): number =>
	Math.min(Math.min(buildingMax, HARD_LIMITS.buildingMaxLevel), Math.max(1, Math.floor(castleLevel)));

/**
 * The highest level a building can be taken to now: Producers and Extractors `min(5, castle level)`; an Idol the same up to level 5 and, above it, only the purchased cap (`idolMaxLevel`, base 5, raised by the Ember shop's Idol Mastery,
 * never past its hard limit): the castle gates the first five levels, the shop the rest.
 */
export const upgradeCapOf = (
	def: BuildingDef | undefined,
	castleLevel: number,
	idolMax: number = limitOf('idolMaxLevel'),
	buildingMax: number = BUILDING_RULES.maxLevel,
): number => {
	const gate = buildingLevelCap(castleLevel, buildingMax);
	if (def?.kind !== 'idol') return gate;
	const cap = Math.min(idolMax, HARD_LIMITS.idolMaxLevel);
	return castleLevel < BUILDING_RULES.maxLevel ? Math.min(cap, gate) : cap;
};

/**
 * Seconds the next level takes, from `fromLevel` to `fromLevel + 1`. Producers and Extractors: 10 min, 45 min, 3 h, 8 h (level 1 is built at once). **Idols** are slower and have a timer from the first level: 30 min, 1 h, 4 h, 12 h, 24 h for levels 1 to 5
 * (`fromLevel` 0 is the first build), then x1.35 per level up to 7 days. Master Builders (Ember shop) and the Dwarf Statue shorten it like the castle's timer. Placing an Idol the account has learned again stays instant.
 *
 * @category Economy/Buildings
 * @order 5
 * @formula
 * seconds = floor(durationsSec[fromLevel - 1] x (1 - min(0.6, 0.05 x Master Builders level + Dwarf Statue %)))          Producer, Extractor
 * seconds = floor(IDOL_RULES.durationsSec[fromLevel] x (1 - ...))          Idol; above level 5: last x 1.35^(levels past 5), at most 7 days
 */
export const buildingUpgradeDuration = (fromLevel: number, prestige?: PrestigeState, idolBuildTimePct = 0, kind: BuildKind = 'building'): number => {
	const idol = kind === 'idol';
	const table = idol ? IDOL_RULES.durationsSec : BUILDING_RULES.durationsSec;
	const at = idol ? fromLevel : fromLevel - 1;
	// past the base ladder (an Idol raised above level 5 by the Ember shop): the last timer x1.35 per level, at most 7 days
	const base = table[at] ?? Math.min(7 * 86400, (table[table.length - 1] ?? 0) * Math.pow(1.35, at - table.length + 1));
	return Math.floor(base * (1 - buildTimeReduction(prestige, idolBuildTimePct, kind)));
};

/**
 * The shortest a timer to `toLevel` can be (no build-time cuts): the server's floor for a new upgrade; `idol` says the job's building is an Idol (longer timers). The first build (level 1) only exists for Idols.
 */
export const shortestUpgradeSec = (toLevel: number, idol = false): number =>
	toLevel <= 1 ? buildingUpgradeDuration(0, undefined, 0, 'idol') : buildingUpgradeDuration(toLevel - 1, undefined, 0, idol ? 'idol' : 'building');

/**
 * How many castle or building upgrades can run at once: 1 for everyone, +1 for the Gem shop's one-time Builder #2 (1,000 gems, permanent, kept over a rebirth) and +1 for the Ember shop's one-level Extra Builder: 3 at most (`HARD_LIMITS.builders` is only the ceiling a save may hold).
 *
 * @category Economy/Buildings
 * @order 8
 * @formula
 * builders = 1 + (Builder #2 bought ? 1 : 0) + (Extra Builder bought ? 1 : 0)
 */
export const builderCount = (ctx: LimitContext = {}): number => Math.min(HARD_LIMITS.builders, limitOf('builders', ctx));

/** What a build timer belongs to: the castle, a Producer or Extractor (`building`) or an Idol. Each has its own Ember upgrade for the cut. */
export type BuildKind = 'castle' | 'building' | 'idol';

const BUILD_TIME_UPGRADE = { castle: 'builders', building: 'buildtime', idol: 'idoltime' } as const;

/**
 * The share of a build timer taken off: the Ember upgrade of that kind (Master Builders for the castle, Mason's Guild for Producers and Extractors, Shrine Keepers for Idols; 5 % per level)
 * plus the Dwarf Statue, together at most `buildTimeCap` (60 %).
 */
export const buildTimeReduction = (prestige: PrestigeState | undefined, idolBuildTimePct = 0, kind: BuildKind = 'castle'): number =>
	Math.min(IDOL_RULES.buildTimeCap / 100, emberEffect(prestige, BUILD_TIME_UPGRADE[kind]) + idolBuildTimePct / 100);

/** The largest cut any of the three kinds has: what the server judges a saved timer against (it does not know which kind a step was). */
export const maxBuildTimeReduction = (prestige: PrestigeState | undefined, idolBuildTimePct = 0): number =>
	Math.max(
		buildTimeReduction(prestige, idolBuildTimePct, 'castle'),
		buildTimeReduction(prestige, idolBuildTimePct, 'building'),
		buildTimeReduction(prestige, idolBuildTimePct, 'idol'),
	);

/**
 * The price of reaching `level` (1 = building it): `tilePrices` times the price of the next tile at the current tile count (counted up to `priceTileCap`), times `levelGrowth` per level above 1. Gold, wood and stone like a tile.
 *
 * @category Economy/Buildings
 * @order 6
 * @formula
 * cost(level) = floor(tilePrice(min(max(owned tiles, floor(level)), priceTileCap)) x tilePrices x levelGrowth^(level - 1))   per resource
 * floor(level) = IDOL_RULES.floorTiles[level - 1], then +floorStepTiles per level (Idols only; other buildings have no floor)
 */
export const buildingLevelCost = (level: number, ownedTiles: number, def?: BuildingDef): Partial<Resources> =>
	levelCost(level, def?.kind === 'idol' ? Math.max(ownedTiles, idolFloorTiles(level)) : ownedTiles, def);

/** The tile count an Idol level is priced at least at (the price floor): the table, then `floorStepTiles` more per level, never above `priceTileCap`. */
export const idolFloorTiles = (level: number): number => {
	const { floorTiles, floorStepTiles } = IDOL_RULES;
	const l = Math.max(1, Math.floor(level));
	const raw = floorTiles[l - 1] ?? (floorTiles[floorTiles.length - 1] ?? 0) + floorStepTiles * (l - floorTiles.length);
	return Math.min(BUILDING_RULES.cost.priceTileCap, raw);
};

/** The cheapest gold a building level could ever have cost (no floor): the net-worth check's floor, so an Idol placed free after a rebirth never reads as unpaid spending. */
export const buildingMinGold = (level: number): number => {
	let gold = 0;
	for (let l = 1; l <= level; l++) gold += levelCost(l, 1).gold ?? 0;
	return gold;
};

const levelCost = (level: number, ownedTiles: number, def?: BuildingDef): Partial<Resources> => {
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
	/** The building upgrades running (a first Idol build is one: it holds a builder) */
	buildingUpgrades: readonly BuildingUpgradeState[];
	/** Builders in all ({@link builderCount}); absent = 1 */
	builders?: number;
	/** Tiles counted for prices (`economyTiles`) */
	ownedTiles: number;
	/** The Idol level cap in force ({@link limitOf} `idolMaxLevel` with the Ember shop's raises); absent = the base */
	idolMax?: number;
	/** The Producer and Extractor level cap in force ({@link limitOf} `buildingMaxLevel`); absent = the base */
	buildingMax?: number;
}

/** Why a tile cannot take this building, or null when it can: owned, not the castle, no building, chest or monster on it, and of the building's biome. */
const tileProblem = (ctx: BuildingContext, x: number, y: number, def: BuildingDef): string | null => {
	const tile = getTile(ctx.tiles, x, y);
	if (!tile || !tile.isOwned) return 'Not your land';
	if (tile.biome === 'castle') return 'Not on the castle';
	if (tile.building) return 'Already has a building';
	if (upgradeAt(ctx, x, y)) return 'Under construction';
	if (tile.hasChest) return 'A chest is here';
	if (monsterAt(ctx.monsters as Monster[], x, y)) return 'A monster is here';
	if (tile.biome !== def.biome) return `Needs ${BIOMES[def.biome]?.label ?? def.biome}`;
	return null;
};

/** Why no builder is free, or null when one is (the castle and the buildings share the builders: one timer each, at most {@link builderCount} at once). */
export const builderBusy = (ctx: Pick<BuildingContext, 'castleUpgrade' | 'buildingUpgrades' | 'builders'>): string | null => {
	const builders = Math.max(1, ctx.builders ?? 1);
	if (busyBuilders(ctx.castleUpgrade, ctx.buildingUpgrades) < builders) return null;
	if (builders > 1) return 'All builders are busy';
	return ctx.castleUpgrade ? 'The builder is upgrading the castle' : 'The builder is busy with a building';
};

/** The running upgrade of the building on (x, y), or the first Idol build waiting on that tile. */
export const upgradeAt = (ctx: Pick<BuildingContext, 'buildingUpgrades'>, x: number, y: number): BuildingUpgradeState | undefined =>
	ctx.buildingUpgrades.find((u) => u.x === x && u.y === y);

/** Whether placing this building takes a builder and a timer: an Idol the account has not learned yet (its first build). Everything else is placed at once. */
export const needsConstruction = (def: BuildingDef | undefined, idolLevels: Record<string, number> | undefined): boolean =>
	def?.kind === 'idol' && rememberedIdolLevel(idolLevels, def.biome) === 0;

/**
 * Why `id` cannot be built on tile (x, y) now, or null when it can: the system is on, the type exists, **one of each type per map**, and the tile fits.
 * Paying is the caller's check, so the menu can show the price next to the reason.
 */
export const buildProblem = (ctx: BuildingContext, x: number, y: number, id: string): string | null => {
	if (!buildingsEnabled()) return 'Buildings are not available yet';
	const def = buildingDef(id);
	if (!def) return 'Unknown building';
	if (builtBuildings(ctx.tiles).some((b) => b.id === id) || ctx.buildingUpgrades.some((u) => u.building === id)) return `The ${def.label} is already built`;
	return tileProblem(ctx, x, y, def);
};

/** Why the building on tile (x, y) cannot go up a level now, or null: it must exist, have no monster on its tile (defeat it first), be below `min(building cap, castle level)`, and the builder must be free. Paying is the caller's check. */
export const upgradeProblem = (ctx: BuildingContext, x: number, y: number): string | null => {
	if (!buildingsEnabled()) return 'Buildings are not available yet';
	const tile = getTile(ctx.tiles, x, y);
	if (!tile?.building || !buildingDef(tile.building)) return 'No building here';
	if (monsterAt(ctx.monsters as Monster[], x, y)) return 'Defeat the monster here first';
	const level = levelOfTile(tile);
	const def = buildingDef(tile.building);
	const buildingMax = ctx.buildingMax ?? BUILDING_RULES.maxLevel;
	const top =
		def?.kind === 'idol' ? Math.min(ctx.idolMax ?? limitOf('idolMaxLevel'), HARD_LIMITS.idolMaxLevel) : Math.min(buildingMax, HARD_LIMITS.buildingMaxLevel);
	if (level >= top) return 'Highest level';
	if (level >= upgradeCapOf(def, ctx.castleLevel, ctx.idolMax, buildingMax)) return `Needs castle level ${level + 1}`;
	if (upgradeAt(ctx, x, y)) return 'It is being upgraded';
	return builderBusy(ctx);
};

/** Why the building on (fromX, fromY) cannot move to (toX, toY), or null. Paying is the caller's check. */
export const moveProblem = (ctx: BuildingContext, fromX: number, fromY: number, toX: number, toY: number): string | null => {
	if (!buildingsEnabled()) return 'Buildings are not available yet';
	const from = getTile(ctx.tiles, fromX, fromY);
	const def = buildingDef(from?.building);
	if (!from || !def) return 'No building here';
	if (fromX === toX && fromY === toY) return 'Already here';
	if (monsterAt(ctx.monsters as Monster[], fromX, fromY)) return 'Defeat the monster on the building first';
	if (upgradeAt(ctx, fromX, fromY)) return 'It is being upgraded';
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
	job: { x: number; y: number; toLevel: number; building?: string },
): { tiles: World; idolLevels: Record<string, number>; reached: boolean } => {
	const tile = getTile(tiles, job.x, job.y);
	// the first build of an Idol: the tile is still empty, the timer's end puts the building there
	if (job.building && tile && !tile.building) {
		const idol = buildingDef(job.building);
		if (idol?.kind !== 'idol') return { tiles, idolLevels, reached: false };
		return {
			tiles: setTile(tiles, job.x, job.y, { ...tile, building: job.building, buildingLevel: job.toLevel }),
			idolLevels: { ...idolLevels, [idol.biome]: Math.max(idolLevels[idol.biome] ?? 0, job.toLevel) },
			reached: true,
		};
	}
	if (!tile?.building) return { tiles, idolLevels, reached: false };
	const def = buildingDef(tile.building);
	return {
		tiles: setTile(tiles, job.x, job.y, { ...tile, buildingLevel: job.toLevel }),
		idolLevels: def?.kind === 'idol' ? { ...idolLevels, [def.biome]: Math.max(idolLevels[def.biome] ?? 0, job.toLevel) } : idolLevels,
		reached: true,
	};
};
