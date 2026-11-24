import { buildingDef, buildingsOfBiome, type BuildingDef } from '@/catalog/buildings';
import {
	builderBusy,
	builderCount,
	buildProblem,
	builtBuildings,
	buildingLevelCost,
	copiesAllowed,
	moveProblem,
	needsConstruction,
	relocationCost,
	rememberedIdolLevel,
	type BuildingContext,
} from '@/lib/buildings';
import { castleLevelOf } from '@/lib/castleWard';
import { limitOf } from '@/lib/limits';
import { monsterAt } from '@/lib/monsters';
import { useUiStore, type ContextMenuItem } from '@/stores/uiStore';
import type { MapGameStore } from '@/components/game/mapSource';
import type { Monster, Resources } from '@/types/game';
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
	// a monster on the tile blocks every building entry: it has to be defeated first
	if (monsterAt(s.monsters as Monster[], x, y)) return [];

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
		buildingUpgrades: s.buildingUpgrades ?? [],
		builders: builderCount({ prestige: s.prestige, gemBuilders: s.gemBuilders }),
		ownedTiles: economyTiles(s.tiles, s.freeTiles),
		buildingCopies: limitOf('buildingCopies', { prestige: s.prestige, gemCraft: s.gemCraft }),
	};
	const standing = builtBuildings(s.tiles);
	for (const def of buildingsOfBiome(tile.biome)) {
		const copies = standing.filter((b) => b.id === def.id);
		const elsewhere = copies[0];
		if (elsewhere) {
			const cost = relocationCost(elsewhere.level, ctx.ownedTiles);
			const problem = moveProblem(ctx, elsewhere.x, elsewhere.y, x, y) ?? (canAffordBundle(s.resources, cost) ? null : 'Not enough resources');
			out.moves.push({ def, level: elsewhere.level, cost, problem, from: { x: elsewhere.x, y: elsewhere.y } });
		}
		if (copies.length < copiesAllowed(def, ctx.buildingCopies)) {
			// a copy that can still be built (the first one, or one more with the Building Slots); an Idol learned in an earlier run is placed again for free at its remembered level
			const remembered = def.kind === 'idol' ? rememberedIdolLevel(s.idolLevels ?? {}, def.biome) : 0;
			const cost = remembered > 0 ? {} : buildingLevelCost(1, ctx.ownedTiles, def);
			out.builds.push({
				def,
				cost,
				remembered,
				// an Idol's first build takes a builder and a timer: no free builder is a refusal too
				problem:
					buildProblem(ctx, x, y, def.id) ??
					(needsConstruction(def, s.idolLevels) ? builderBusy(ctx) : null) ??
					(canAffordBundle(s.resources, cost) ? null : 'Not enough resources'),
			});
		}
	}
	return out;
}
