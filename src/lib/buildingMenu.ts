import { buildingDef, buildingsOfBiome, type BuildingDef } from '@/catalog/buildings';
import {
	builderBusy,
	builderCount,
	buildProblem,
	builtBuildings,
	buildingLevelCost,
	copiesAllowed,
	needsConstruction,
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
 * The entries of the tile menu for the building system (only called while `BUILDINGS_FLAG` is on, see `tileMenuItems`): on a free tile of a biome with a Producer, "Build here..." (the Build window, which also lists what already stands, in its own group). A tile with a building has one entry, "Open <building>", which opens the building window like a left click (the upgrade is there). All numbers are the rules' (`lib/buildings.ts`), nothing is decided here.
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
	/** How many copies of it already stand on the map (0: a new building; more: one more copy is allowed, see `buildingCopies`) */
	owned: number;
	/** The highest level among the standing copies (0 when none stands) */
	level: number;
}

/** A building of the biome that stands and cannot be built again (every allowed copy is built): shown in the "Already owned" group without a Buy button. */
export interface OwnedOption {
	def: BuildingDef;
	owned: number;
	level: number;
}

/**
 * What the Build window offers on the free tile (x, y): a `BuildOption` for every building of the biome that can still be built (`problem` = the rules' refusal, or "Not enough resources"; `owned` says how many copies
 * stand already), and an `OwnedOption` for each one whose copies are all built. The window groups them as "Build new" (`owned` = 0) and "Already owned" (the rest). Pure reads of the store; the rules and prices are `lib/buildings.ts`'s.
 */
export function buildOptions(game: MapGameStore, x: number, y: number): { builds: BuildOption[]; maxed: OwnedOption[] } {
	const s = game.getState();
	const tile = getTile(s.tiles, x, y);
	const out = { builds: [] as BuildOption[], maxed: [] as OwnedOption[] };
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
		const owned = copies.length;
		const level = Math.max(0, ...copies.map((b) => b.level));
		if (owned < copiesAllowed(def, ctx.buildingCopies)) {
			// a copy that can still be built (the first one, or one more with the Building Slots); an Idol learned in an earlier run is placed again for free at its remembered level
			const remembered = def.kind === 'idol' ? rememberedIdolLevel(s.idolLevels ?? {}, def.biome) : 0;
			const cost = remembered > 0 ? {} : buildingLevelCost(1, ctx.ownedTiles, def);
			out.builds.push({
				def,
				cost,
				remembered,
				owned,
				level,
				// an Idol's first build takes a builder and a timer: no free builder is a refusal too
				problem:
					buildProblem(ctx, x, y, def.id) ??
					(needsConstruction(def, s.idolLevels) ? builderBusy(ctx) : null) ??
					(canAffordBundle(s.resources, cost) ? null : 'Not enough resources'),
			});
		} else if (owned > 0) {
			out.maxed.push({ def, owned, level });
		}
	}
	return out;
}
