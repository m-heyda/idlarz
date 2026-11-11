// buildingSlice.ts
// The per-biome building system (R7, IDL-91, IDL-92): build, level up and move a building. Every action refuses while BUILDINGS_FLAG is off, so a flag-off game never changes state through here.

import { buildingDef } from '@/catalog/buildings';
import {
	buildProblem,
	buildingLevelCost,
	buildingUpgradeDuration,
	levelOfTile,
	moveProblem,
	relocationCost,
	rememberedIdolLevel,
	upgradeProblem,
	type BuildingContext,
} from '@/lib/buildings';
import { castleLevelOf } from '@/lib/castleWard';
import { idolEconomy } from '@/lib/idolEconomy';
import { gearIncomePct } from '@/lib/gearEconomy';
import { canAffordBundle, subtractBundle } from '@/utils/game/costs';
import { calculateResourceRates } from '@/utils/game/income';
import { economyTiles } from '@/utils/game/tiles';
import { getTile, setTiles } from '@/utils/world';
import type { GameGet, GameSet } from './base';

export const createBuildingSlice = (set: GameSet, get: GameGet) => {
	const context = (): BuildingContext => {
		const s = get();
		return {
			tiles: s.tiles,
			monsters: s.monsters,
			castleLevel: castleLevelOf(s.tiles),
			castleUpgrade: s.castleUpgrade,
			buildingUpgrade: s.buildingUpgrade,
			ownedTiles: economyTiles(s.tiles, s.freeTiles),
		};
	};

	const ratesOf = (tiles: ReturnType<GameGet>['tiles']) => {
		const s = get();
		return calculateResourceRates(tiles, s.characterStats, s.farmLevels, s.prestige, s.farmUpgrades, s.merchantUpgrades, gearIncomePct(s.equipment));
	};

	return {
		/** Builds `id` (level 1, paid now, no timer) on tile (x, y). */
		buildBuilding: (x: number, y: number, id: string): boolean => {
			if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
			const ctx = context();
			if (buildProblem(ctx, x, y, id)) return false;
			const s = get();
			const def = buildingDef(id);
			// an Idol the account has learned is placed again for free, at the level it remembers (docs/plan/18 section 6); the first one costs level 1
			const remembered = def?.kind === 'idol' ? rememberedIdolLevel(s.idolLevels, def.biome) : 0;
			const cost = remembered > 0 ? {} : buildingLevelCost(1, ctx.ownedTiles, def);
			if (!canAffordBundle(s.resources, cost)) return false;
			const tile = getTile(s.tiles, x, y);
			if (!tile) return false;
			const level = Math.max(1, remembered);
			const tiles = setTiles(s.tiles, [{ x, y, tile: { ...tile, building: id, buildingLevel: level } }]);
			set({
				tiles,
				resources: subtractBundle(s.resources, cost),
				resourceRates: ratesOf(tiles),
				...(def?.kind === 'idol' && remembered === 0 ? { idolLevels: { ...s.idolLevels, [def.biome]: 1 } } : {}),
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
				buildingUpgrade: {
					x,
					y,
					toLevel: level + 1,
					remainingSec: buildingUpgradeDuration(level, s.prestige, idolEconomy(s.tiles, s.idolLevels).buildTimePct),
				},
			});
			return true;
		},

		/** Moves the building to another tile of its biome for half its cost; instant, the level is kept. */
		moveBuilding: (fromX: number, fromY: number, toX: number, toY: number): boolean => {
			if (![fromX, fromY, toX, toY].every(Number.isInteger)) return false;
			const ctx = context();
			if (moveProblem(ctx, fromX, fromY, toX, toY)) return false;
			const s = get();
			const from = getTile(s.tiles, fromX, fromY);
			const to = getTile(s.tiles, toX, toY);
			const def = buildingDef(from?.building);
			if (!from || !to || !def) return false;
			const level = levelOfTile(from);
			const cost = relocationCost(level, ctx.ownedTiles);
			if (!canAffordBundle(s.resources, cost)) return false;
			const { building: _b, buildingLevel: _l, ...bare } = from;
			void _b;
			void _l;
			const tiles = setTiles(s.tiles, [
				{ x: fromX, y: fromY, tile: bare },
				{ x: toX, y: toY, tile: { ...to, building: def.id, buildingLevel: level } },
			]);
			set({ tiles, resources: subtractBundle(s.resources, cost), resourceRates: ratesOf(tiles) });
			return true;
		},
	};
};
