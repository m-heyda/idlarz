import { buildingDef, buildingsOfBiome } from '@/catalog/buildings';
import {
	buildProblem,
	builtBuildings,
	buildingLevelCost,
	buildingUpgradeDuration,
	levelOfTile,
	moveProblem,
	relocationCost,
	upgradeProblem,
	type BuildingContext,
} from '@/lib/buildings';
import { castleLevelOf } from '@/lib/castleWard';
import type { ContextMenuItem } from '@/stores/uiStore';
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
		if (level >= 5) return [{ id: 'building-max', label: `${here.label}: highest level`, disabled: true, onSelect: () => {} }];
		const cost = buildingLevelCost(level + 1, ctx.ownedTiles);
		const problem = upgradeProblem(ctx, x, y) ?? (canAffordBundle(s.resources, cost) ? null : 'Not enough resources');
		return [
			{
				id: 'building-upgrade',
				label: `Upgrade ${here.label} to level ${level + 1} (${costText(cost)}, ${formatTime(buildingUpgradeDuration(level, s.prestige))})`,
				disabled: !!problem,
				hint: problem ?? undefined,
				onSelect: () => void game.getState().upgradeBuilding?.(x, y),
			},
		];
	}

	const items: ContextMenuItem[] = [];
	for (const def of buildingsOfBiome(tile.biome)) {
		const elsewhere = builtBuildings(s.tiles).find((b) => b.id === def.id);
		if (elsewhere) {
			const cost = relocationCost(elsewhere.level, ctx.ownedTiles);
			const problem = moveProblem(ctx, elsewhere.x, elsewhere.y, x, y) ?? (canAffordBundle(s.resources, cost) ? null : 'Not enough resources');
			items.push({
				id: `building-move-${def.id}`,
				label: `Move ${def.label} here (${costText(cost)})`,
				disabled: !!problem,
				hint: problem ?? undefined,
				onSelect: () => void game.getState().moveBuilding?.(elsewhere.x, elsewhere.y, x, y),
			});
		} else {
			const cost = buildingLevelCost(1, ctx.ownedTiles);
			const problem = buildProblem(ctx, x, y, def.id) ?? (canAffordBundle(s.resources, cost) ? null : 'Not enough resources');
			items.push({
				id: `building-build-${def.id}`,
				label: `Build ${def.label} (${costText(cost)})`,
				disabled: !!problem,
				hint: problem ?? undefined,
				onSelect: () => void game.getState().buildBuilding?.(x, y, def.id),
			});
		}
	}
	return items;
}
