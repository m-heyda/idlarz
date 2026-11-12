import { buildingDef, buildingsOfBiome, type BuildingDef } from '@/catalog/buildings';
import { buildProblem, builtBuildings, buildingLevelCost, moveProblem, relocationCost, rememberedIdolLevel, type BuildingContext } from '@/lib/buildings';
import { castleLevelOf } from '@/lib/castleWard';
import { useUiStore, type ContextMenuItem } from '@/stores/uiStore';
import type { MapGameStore } from '@/components/game/mapSource';
import type { Resources } from '@/types/game';
import { canAffordBundle } from '@/utils/game/costs';
import { economyTiles } from '@/utils/game/tiles';
import { getTile } from '@/utils/world';

/**
 * The entries of the tile menu for the building system (only called while `BUILDINGS_FLAG` is on, see `tileMenuItems`): on a free tile of a biome with a Producer, "Build here..." (the Build window, which also offers "Move X here" when it
 * stands elsewhere). A tile with a building has one entry, "Open <building>", which opens the building window like a left click (the upgrade is there). All numbers are the rules' (`lib/buildings.ts`), nothing is decided here.
 */
export function buildingMenuItems(game: MapGameStore, x: number, y: number): ContextMenuItem[] {
	const s = game.getState();
	const tile = getTile(s.tiles, x, y);
	if (!tile) return [];

	// a tile with a building: one entry that opens its window (the same as a left click), where the upgrade is
	const here = buildingDef(tile.building);
	if (here) return [{ id: 'building-open', label: `Open ${here.label}`, onSelect: () => useUiStore.getState().openBuildingModal(x, y) }];

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
