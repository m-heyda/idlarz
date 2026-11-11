import { buildingDef, buildingsOfBiome, type BuildingDef } from '@/catalog/buildings';
import {
	buildProblem,
	builtBuildings,
	buildingLevelCost,
	buildingUpgradeDuration,
	levelOfTile,
	moveProblem,
	relocationCost,
	rememberedIdolLevel,
	upgradeProblem,
	type BuildingContext,
} from '@/lib/buildings';
import { limitOf } from '@/lib/limits';
import { castleLevelOf } from '@/lib/castleWard';
import { idolEconomy } from '@/lib/idolEconomy';
import { useUiStore, type ContextMenuItem } from '@/stores/uiStore';
import type { MapGameStore } from '@/components/game/mapSource';
import type { Resources } from '@/types/game';
import { canAffordBundle } from '@/utils/game/costs';
import { economyTiles } from '@/utils/game/tiles';
import { formatNumber, formatTime } from '@/utils/formatters';
import { getTile } from '@/utils/world';

/** "1.2K gold, 300 wood": a price for a menu label. */
const costText = (cost: Partial<Resources>): string =>
	Object.entries(cost)
		.filter(([, amount]) => amount)
		.map(([key, amount]) => `${formatNumber(amount)} ${key}`)
		.join(', ');

/**
 * The entries of the tile menu for the building system (only called while `BUILDINGS_FLAG` is on, see `tileMenuItems`): on a free tile of a biome with a Producer, "Build X" (or "Move X here" when it
 * stands elsewhere); on a tile with a building, the next level with its price and timer. A refused action stays in the menu greyed out with the reason as its hint. All numbers are the rules' (`lib/buildings.ts`), nothing is decided here.
 */
export function buildingMenuItems(game: MapGameStore, x: number, y: number): ContextMenuItem[] {
	const s = game.getState();
	const ctx: BuildingContext = {
		tiles: s.tiles,
		monsters: s.monsters,
		castleLevel: castleLevelOf(s.tiles),
		castleUpgrade: s.castleUpgrade,
		buildingUpgrade: s.buildingUpgrade ?? null,
		ownedTiles: economyTiles(s.tiles, s.freeTiles),
	};
	const tile = getTile(s.tiles, x, y);
	if (!tile) return [];

	const here = buildingDef(tile.building);
	if (here) {
		const level = levelOfTile(tile);
		const running = s.buildingUpgrade && s.buildingUpgrade.x === x && s.buildingUpgrade.y === y ? s.buildingUpgrade : null;
		if (running) {
			return [
				{
					id: 'building-upgrading',
					label: `${here.label} ${level}: level ${running.toLevel} in ${formatTime(Math.max(1, Math.ceil(running.remainingSec)))}`,
					disabled: true,
					onSelect: () => {},
				},
			];
		}
		if (level >= (here.kind === 'idol' ? limitOf('idolMaxLevel') : 5))
			return [{ id: 'building-max', label: `${here.label}: highest level`, disabled: true, onSelect: () => {} }];
		const cost = buildingLevelCost(level + 1, ctx.ownedTiles, here);
		const problem = upgradeProblem(ctx, x, y) ?? (canAffordBundle(s.resources, cost) ? null : 'Not enough resources');
		return [
			{
				id: 'building-upgrade',
				label: `Upgrade ${here.label} to level ${level + 1} (${costText(cost)}, ${formatTime(buildingUpgradeDuration(level, s.prestige, idolEconomy(s.tiles, s.idolLevels ?? {}).buildTimePct))})`,
				disabled: !!problem,
				hint: problem ?? undefined,
				onSelect: () => void game.getState().upgradeBuilding?.(x, y),
			},
		];
	}

	// "Build here..." opens the Build window (components/game/overlays/BuildModal.tsx), which lists the same rows (`buildOptions`)
	const { builds } = buildOptions(game, x, y);
	if (builds.length === 0) return [];
	return [{ id: 'building-here', label: 'Build here...', onSelect: () => useUiStore.getState().openBuildModal(x, y) }];
}

/** One building of the tile's biome as the Build window shows it. `problem` is why it cannot be built now (null: it can). */
export interface BuildOption {
	def: BuildingDef;
	cost: Partial<Resources>;
	problem: string | null;
	/** An Idol the account has learned: placed for free at this level (0 = the first one, which is paid) */
	remembered?: number;
}

/** An already standing building that could be moved to the tile instead of building it again (half price, level kept). */
export interface MoveOption {
	def: BuildingDef;
	level: number;
	cost: Partial<Resources>;
	problem: string | null;
	from: { x: number; y: number };
}

/**
 * What the Build window offers on the free tile (x, y): a `BuildOption` for every building of the biome that does not stand yet (`problem` = the rules' refusal, or "Not enough resources"), and a `MoveOption` for
 * each one that stands elsewhere. Pure reads of the store; the rules and prices are `lib/buildings.ts`'s.
 */
export function buildOptions(game: MapGameStore, x: number, y: number): { builds: BuildOption[]; moves: MoveOption[] } {
	const s = game.getState();
	const tile = getTile(s.tiles, x, y);
	const out = { builds: [] as BuildOption[], moves: [] as MoveOption[] };
	if (!tile) return out;
	const ctx: BuildingContext = {
		tiles: s.tiles,
		monsters: s.monsters,
		castleLevel: castleLevelOf(s.tiles),
		castleUpgrade: s.castleUpgrade,
		buildingUpgrade: s.buildingUpgrade ?? null,
		ownedTiles: economyTiles(s.tiles, s.freeTiles),
	};
	const standing = builtBuildings(s.tiles);
	for (const def of buildingsOfBiome(tile.biome)) {
		const elsewhere = standing.find((b) => b.id === def.id);
		if (elsewhere) {
			const cost = relocationCost(elsewhere.level, ctx.ownedTiles);
			const problem = moveProblem(ctx, elsewhere.x, elsewhere.y, x, y) ?? (canAffordBundle(s.resources, cost) ? null : 'Not enough resources');
			out.moves.push({ def, level: elsewhere.level, cost, problem, from: { x: elsewhere.x, y: elsewhere.y } });
		} else {
			// an Idol learned in an earlier run is placed again for free at its remembered level
			const remembered = def.kind === 'idol' ? rememberedIdolLevel(s.idolLevels ?? {}, def.biome) : 0;
			const cost = remembered > 0 ? {} : buildingLevelCost(1, ctx.ownedTiles, def);
			out.builds.push({
				def,
				cost,
				remembered,
				problem: buildProblem(ctx, x, y, def.id) ?? (canAffordBundle(s.resources, cost) ? null : 'Not enough resources'),
			});
		}
	}
	return out;
}
