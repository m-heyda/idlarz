// economySlice.ts
// Split out of gameStore.ts (IDL-14); the actions and their behaviour are unchanged.

import { CASTLE_UPGRADE } from '@/config/castle';
import { CLICK_LADDER, clickGold, RESOURCE_CAP, XP_CAP } from '@/config/economy';
import { calculateTileCost, canAffordBundle, subtractBundle, tileCostAsResources } from '@/utils/game/costs';
import { calculateResourceRates } from '@/utils/game/income';
import { calculateXpGain } from '@/utils/game/character';
import { castleUpgradeDuration } from '@/utils/game/castle';
import { economyTiles } from '@/utils/game/tiles';
import { effectiveTileDiscount, emberEffect } from '@/utils/game/rebirth';
import { rollBiome } from '@/utils/biomeRules';
import { idolEconomy } from '@/lib/idolEconomy';
import { gearEconomy, gearIncomePct, xpGainPct } from '@/lib/gearEconomy';
import type { BiomeType, ClickInput, Resources } from '@/types/game';
import { MAX_OWNED_TILES, hasOwnedNeighbour, inRange, isOwnedAt, ownedCount, setTile } from '@/utils/world';
import { clickLimiter, findCastle, type GameGet, type GameSet } from './base';

export const createEconomySlice = (set: GameSet, get: GameGet) => {
	/** Charge, claim the tile, award XP. */
	const completePurchase = (x: number, y: number, biome: BiomeType): boolean => {
		const state = get();
		const owned = economyTiles(state.tiles, state.freeTiles);
		const cost = calculateTileCost(owned, effectiveTileDiscount(state.characterStats, state.prestige, state.merchantUpgrades, state.playerClass));
		const bundle = tileCostAsResources(cost);
		if (!canAffordBundle(state.resources, bundle)) return false;

		const newTiles = setTile(state.tiles, x, y, { biome, isOwned: true });

		const newRates = calculateResourceRates(
			newTiles,
			state.characterStats,
			state.farmLevels,
			state.prestige,
			state.farmUpgrades,
			state.merchantUpgrades,
			gearIncomePct(state.equipment),
		);

		const xpGain =
			calculateXpGain(owned + 1) *
			(1 + (xpGainPct(state.characterStats, state.equipment, state.playerClass) + idolEconomy(state.tiles, state.idolLevels).xpPct) / 100);
		const resources = subtractBundle(state.resources, bundle);
		resources.xp = Math.min(resources.xp + xpGain, XP_CAP);

		set({
			tiles: newTiles,
			resources,
			resourceRates: newRates,
		});
		return true;
	};

	return {
		buyTile: (x: number, y: number) => {
			const state = get();
			if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
			if (!inRange(x, y) || isOwnedAt(state.tiles, x, y) || ownedCount(state.tiles) >= MAX_OWNED_TILES) return false;
			if (!hasOwnedNeighbour(state.tiles, x, y)) return false;

			const owned = economyTiles(state.tiles, state.freeTiles);
			const purchased = owned - 1;
			const cost = calculateTileCost(owned, effectiveTileDiscount(state.characterStats, state.prestige, state.merchantUpgrades, state.playerClass));
			if (!canAffordBundle(state.resources, tileCostAsResources(cost))) return false;

			return completePurchase(x, y, rollBiome(state.tiles, x, y, purchased, Math.random, state.prestige.rebirths));
		},

		// Starts the (timed) castle upgrade: resources are paid now, the level changes when the timer ends
		upgradeCastle: () => {
			const state = get();
			if (state.castleUpgrade) return false;
			if (state.buildingUpgrade) return false; // one builder: the castle waits for the building that is being upgraded

			const castle = findCastle(state.tiles);
			if (!castle || !castle.tile.upgradeCost || !castle.tile.level) return false;
			if (castle.tile.level >= CASTLE_UPGRADE.maxLevel) return false;
			if (!canAffordBundle(state.resources, castle.tile.upgradeCost)) return false;

			set({
				resources: subtractBundle(state.resources, castle.tile.upgradeCost),
				castleUpgrade: {
					toLevel: castle.tile.level + 1,
					remainingSec: castleUpgradeDuration(castle.tile.level, state.prestige, idolEconomy(state.tiles, state.idolLevels).buildTimePct),
				},
			});
			return true;
		},

		// Gold for a click on the map: gold/s x click power. Rate limited (see lib/clickLimiter).
		clickForGold: (input: ClickInput) => {
			if (!clickLimiter.take(input)) return 0;
			const state = get();
			const multiplier = (1 + emberEffect(state.prestige, 'mastery')) * (1 + gearEconomy(state.equipment).clickPct / 100);
			const gold = clickGold(state.resourceRates.total.gold, state.clickLevel, multiplier);
			if (!(gold > 0)) return 0;
			set({
				resources: { ...state.resources, gold: state.resources.gold + gold },
			});
			return gold;
		},

		buyClickUpgrade: () => {
			const state = get();
			const next = CLICK_LADDER[state.clickLevel + 1];
			if (!next || state.resources.gold < next.price) return false;
			set({
				resources: {
					...state.resources,
					gold: state.resources.gold - next.price,
				},
				clickLevel: state.clickLevel + 1,
			});
			return true;
		},

		// Adds (or subtracts) resources. Rejects non-finite input and never lets a stockpile go negative.
		addResources: (resourceToAdd: Partial<Resources>) => {
			const state = get();
			const next = { ...state.resources };
			for (const [key, value] of Object.entries(resourceToAdd)) {
				if (!(key in next) || typeof value !== 'number' || !Number.isFinite(value)) return;
				const k = key as keyof Resources;
				const updated = next[k] + value;
				if (updated < 0) return;
				next[k] = Math.min(updated, RESOURCE_CAP);
			}
			set({ resources: next });
		},
	};
};
