// buildingSlice.ts
// The per-biome building system (R7, IDL-91, IDL-92): build and level up a building. Every action refuses while BUILDINGS_FLAG is off, so a flag-off game never changes state through here.

import { buildingDef } from '@/catalog/buildings';
import {
	builderBusy,
	builderCount,
	buildProblem,
	needsConstruction,
	buildingLevelCost,
	buildingUpgradeDuration,
	levelOfTile,
	rememberedIdolLevel,
	upgradeProblem,
	type BuildingContext,
} from '@/lib/buildings';
import { castleLevelOf } from '@/lib/castleWard';
import { buildTimeCutPct } from '@/lib/buildTimeCut';
import { limitOf } from '@/lib/limits';
import { gearIncome } from '@/lib/gearEconomy';
import { canAffordBundle, subtractBundle } from '@/utils/game/costs';
import { calculateResourceRates } from '@/utils/game/income';
import { economyTiles } from '@/utils/game/tiles';
import { getTile, setTiles } from '@/utils/world';
import { limitCtx, type GameGet, type GameSet } from './base';

export const createBuildingSlice = (set: GameSet, get: GameGet) => {
	const context = (): BuildingContext => {
		const s = get();
		return {
			tiles: s.tiles,
			monsters: s.monsters,
			castleLevel: castleLevelOf(s.tiles),
			castleUpgrade: s.castleUpgrade,
			buildingUpgrades: s.buildingUpgrades,
			builders: builderCount(limitCtx(s)),
			ownedTiles: economyTiles(s.tiles, s.freeTiles),
			// the Ember shop's cap raises (Idol Mastery, Master Masonry)
			idolMax: limitOf('idolMaxLevel', { prestige: s.prestige }),
			buildingMax: limitOf('buildingMaxLevel', { prestige: s.prestige }),
			buildingCopies: limitOf('buildingCopies', limitCtx(s)),
		};
	};

	const ratesOf = (tiles: ReturnType<GameGet>['tiles']) => {
		const s = get();
		return calculateResourceRates(tiles, s.characterStats, s.farmLevels, s.prestige, s.farmUpgrades, s.merchantUpgrades, gearIncome(s.equipment));
	};

	return {
		/** Builds `id` (level 1, paid now) on tile (x, y): at once, except an Idol the account has not learned yet, which takes a builder and a timer (the tile shows it under construction and the building appears when the timer ends). */
		buildBuilding: (x: number, y: number, id: string): boolean => {
			if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
			const ctx = context();
			if (buildProblem(ctx, x, y, id)) return false;
			const s = get();
			const def = buildingDef(id);
			// an Idol the account has learned is placed again for free, at the level it remembers (docs/plan/18); the first one costs level 1
			const remembered = def?.kind === 'idol' ? rememberedIdolLevel(s.idolLevels, def.biome) : 0;
			const cost = remembered > 0 ? {} : buildingLevelCost(1, ctx.ownedTiles, def);
			if (!canAffordBundle(s.resources, cost)) return false;
			const tile = getTile(s.tiles, x, y);
			if (!tile) return false;
			if (needsConstruction(def, s.idolLevels)) {
				if (builderBusy(ctx)) return false;
				set({
					resources: subtractBundle(s.resources, cost),
					buildingUpgrades: [
						...s.buildingUpgrades,
						{
							x,
							y,
							toLevel: 1,
							remainingSec: buildingUpgradeDuration(0, s.prestige, buildTimeCutPct(s.tiles, s.idolLevels, s.equipment), 'idol'),
							building: id,
						},
					],
				});
				return true;
			}
			const level = Math.max(1, remembered);
			const tiles = setTiles(s.tiles, [{ x, y, tile: { ...tile, building: id, buildingLevel: level } }]);
			set({
				tiles,
				resources: subtractBundle(s.resources, cost),
				resourceRates: ratesOf(tiles),
			});
			return true;
		},

		/** Pays the next level of the building on (x, y) now and starts its timer; the level changes when the timer ends. */
		upgradeBuilding: (x: number, y: number): boolean => {
			if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
			const ctx = context();
			if (upgradeProblem(ctx, x, y)) return false;
			const s = get();
			const tile = getTile(s.tiles, x, y);
			const level = levelOfTile(tile);
			const cost = buildingLevelCost(level + 1, ctx.ownedTiles, buildingDef(tile?.building));
			if (!canAffordBundle(s.resources, cost)) return false;
			set({
				resources: subtractBundle(s.resources, cost),
				buildingUpgrades: [
					...s.buildingUpgrades,
					{
						x,
						y,
						toLevel: level + 1,
						building: tile?.building,
						remainingSec: buildingUpgradeDuration(
							level,
							s.prestige,
							buildTimeCutPct(s.tiles, s.idolLevels, s.equipment),
							buildingDef(tile?.building)?.kind === 'idol' ? 'idol' : 'building',
						),
					},
				],
			});
			return true;
		},
	};
};
