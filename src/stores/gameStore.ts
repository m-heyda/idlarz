import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
	DEFAULT_PLAYER_CLASS,
	PLAYER_CLASSES,
	type PlayerClassId,
} from '@/config/playerClasses';
import {
	ANIMALS,
	BIOMES,
	BUILDINGS,
	AMBIENT_LIFE,
	CASTLE_UPGRADE,
	CHEST,
	FARM_BONUS,
	CLICK_LADDER,
	DEFAULT_PLAYER_NAME,
	EMPTY_BIOMES,
	GRID_HEIGHT,
	GRID_SIZE,
	INITIAL_CHARACTER_STATS,
	INITIAL_INVENTORY_ITEMS,
	LEGACY_UPGRADES,
	MAX_CATCHUP_SEC,
	MERCHANT_BUY_MULTIPLIER,
	MERCHANT_RESOURCE_PRICES,
	REBIRTH,
	RESOURCE_CAP,
	SPECIAL_SINGLE_TYPE_BIOMES,
	TILE_TAP,
	type LegacyUpgradeId,
} from '@/config/gameConfig';
import {
	calculateAnimalCost,
	calculateBuildingCost,
	calculateCombatStats,
	calculateLevel,
	calculateResourceRates,
	calculateTileCost,
	calculateTileTapYield,
	calculateXpGain,
	canAffordBundle,
	castleUpgradeDuration,
	countOwnedTiles,
	createInitialGrid,
	EMPTY_PRESTIGE,
	effectiveTileDiscount,
	getRandomBiome,
	legacyEffect,
	legacyGain,
	legacyUpgradeCost,
	startingResources,
	subtractBundle,
	tileCostAsResources,
} from '@/utils/gameUtils';
import { createClickLimiter } from '@/lib/clickLimiter';
import { markVaultReady, SAVE_NAME, SAVE_VERSION, vaultStorage } from '@/lib/saveVault';
import { pickPersisted, type PersistedGame } from '@/lib/sanitizeSave';
import type {
	BiomeType,
	CharacterStats,
	ClickInput,
	CritterGift,
	GameState,
	GiftResult,
	PrestigeState,
	Resources,
	TapResult,
	Tile,
} from '@/types/game';

// Last tap time per tile (not persisted) - enforces TILE_TAP.cooldownMs
const lastTapAt: Record<string, number> = {};

// Last accepted critter gift per source (not persisted) - enforces the gift cooldowns
const lastGiftAt: Record<string, number> = {};

// Shared by the gold click and the tile tap: one token per physical click
const clickLimiter = createClickLimiter();

const BASE_STATS = [
	'strength',
	'dexterity',
	'intelligence',
	'vitality',
	'charisma',
] as const;

const isPositiveNumber = (n: unknown): n is number =>
	typeof n === 'number' && Number.isFinite(n) && n > 0;

const neighbours = (x: number, y: number) => [
	[x - 1, y],
	[x + 1, y],
	[x, y - 1],
	[x, y + 1],
];

/** All game data of a brand-new game (no actions). */
export const createInitialData = (prestige: PrestigeState = EMPTY_PRESTIGE) => {
	const grid = createInitialGrid();
	const stats = { ...INITIAL_CHARACTER_STATS };
	Object.assign(stats, calculateCombatStats(stats)); // derived stats always follow the formulas
	const rates = calculateResourceRates(grid, stats, {}, prestige);
	return {
		tiles: grid,
		resources: startingResources(prestige),
		resourceRates: rates,
		level: calculateLevel(0),
		previousLevel: 0,
		playerName: DEFAULT_PLAYER_NAME,
		playerClass: DEFAULT_PLAYER_CLASS,
		characterStats: stats,
		equipment: {},
		inventory: INITIAL_INVENTORY_ITEMS.map((item) => ({ ...item })),
		farmLevels: {} as Record<string, number>,
		showCharacterWindow: false,
		showStatisticsWindow: false,
		showMerchantWindow: false,
		showFarmWindow: false,
		isHydrated: false,
		biomeSelectionActive: false,
		pendingTileCoords: null,
		selectableBiomes: null,
		prestige: { ...prestige, upgrades: { ...prestige.upgrades } },
		clickLevel: 0,
		castleUpgrade: null,
		playSeconds: 0,
		chestSpawnTimer: 0,
		activeChests: 0,
		lastChestReward: 0,
		lastChestGoldRate: 0,
		lastChestMinutesAwarded: 0,
	};
};

const findCastle = (tiles: Tile[][]) => {
	for (let y = 0; y < GRID_HEIGHT; y++) {
		for (let x = 0; x < GRID_SIZE; x++) {
			if (tiles[y][x].biome === 'castle') return { tile: tiles[y][x], x, y };
		}
	}
	return null;
};

const createGameSlice = (
	set: (
		partial: Partial<GameState> | ((state: GameState) => Partial<GameState>)
	) => void,
	get: () => GameState
) => {
	/** Shared tail of buyTile / selectBiome: charge, claim the tile, award XP + reputation. */
	const completePurchase = (x: number, y: number, biome: BiomeType): boolean => {
		const state = get();
		const owned = countOwnedTiles(state.tiles);
		const cost = calculateTileCost(owned, effectiveTileDiscount(state.characterStats, state.prestige));
		const bundle = tileCostAsResources(cost);
		if (!canAffordBundle(state.resources, bundle)) return false;

		const newTiles = state.tiles.map((row) => [...row]);
		newTiles[y][x] = { ...newTiles[y][x], biome, isOwned: true };

		const newRates = calculateResourceRates(
			newTiles,
			state.characterStats,
			state.farmLevels,
				state.prestige
		);

		const xpGain =
			calculateXpGain(owned + 1) * (1 + state.characterStats.xpGainMultiplier / 100);
		const resources = subtractBundle(state.resources, bundle);
		resources.xp += xpGain;

		set({
			tiles: newTiles,
			resources,
			resourceRates: newRates,
			characterStats: {
				...state.characterStats,
				reputation: state.characterStats.reputation + 100,
			},
			biomeSelectionActive: false,
			pendingTileCoords: null,
			selectableBiomes: null,
		});
		return true;
	};

	return {
		...createInitialData(),

		resetGame: () => {
			clickLimiter.reset();
			Object.keys(lastTapAt).forEach((key) => delete lastTapAt[key]);
			Object.keys(lastGiftAt).forEach((key) => delete lastGiftAt[key]);
			set({ ...createInitialData(), isHydrated: true });
		},

		// Rebirth: restart with the Legacy bonus. Keeps name, class, play time and all Legacy.
		rebirth: () => {
			const state = get();
			const castle = findCastle(state.tiles);
			if (!castle || (castle.tile.level ?? 1) < REBIRTH.minCastleLevel || state.castleUpgrade) return false;
			const ownedTiles = countOwnedTiles(state.tiles);
			if (ownedTiles < REBIRTH.minTiles) return false;
			const gain = legacyGain(castle.tile.level ?? 1, ownedTiles);
			if (gain < 1) return false;

			const prestige: PrestigeState = {
				...state.prestige,
				rebirths: state.prestige.rebirths + 1,
				legacyPoints: state.prestige.legacyPoints + gain,
				legacyEarned: state.prestige.legacyEarned + gain,
			};
			clickLimiter.reset();
			Object.keys(lastTapAt).forEach((key) => delete lastTapAt[key]);
			Object.keys(lastGiftAt).forEach((key) => delete lastGiftAt[key]);
			set({
				...createInitialData(prestige),
				playerName: state.playerName,
				playerClass: state.playerClass,
				playSeconds: state.playSeconds,
				isHydrated: true,
			});
			return true;
		},

		// Spend Legacy points on a permanent shop upgrade
		buyLegacyUpgrade: (id: LegacyUpgradeId) => {
			const state = get();
			const def = LEGACY_UPGRADES[id];
			if (!def) return false;
			const level = state.prestige.upgrades[id] ?? 0;
			if (level >= def.maxLevel) return false;
			const cost = legacyUpgradeCost(id, level);
			if (state.prestige.legacyPoints < cost) return false;
			set({
				prestige: {
					...state.prestige,
					legacyPoints: state.prestige.legacyPoints - cost,
					upgrades: { ...state.prestige.upgrades, [id]: level + 1 },
				},
			});
			return true;
		},

		// Buy one more animal of a kind (each purchase adds one animal)
		purchaseAnimal: (animalId: string) => {
			const state = get();
			const animal = ANIMALS.find((a) => a.id === animalId);
			if (!animal) return false;

			const currentLevel = state.farmLevels[animalId] || 0;
			const cost = calculateAnimalCost(animal, currentLevel);
			if (state.resources.food < cost) return false;

			const newFarmLevels = { ...state.farmLevels, [animalId]: currentLevel + 1 };
			const newRates = calculateResourceRates(
				state.tiles,
				state.characterStats,
				newFarmLevels,
				state.prestige
			);

			set({
				farmLevels: newFarmLevels,
				resources: { ...state.resources, food: state.resources.food - cost },
				resourceRates: newRates,
			});
			return true;
		},

		toggleFarmWindow: () => {
			set({ showFarmWindow: !get().showFarmWindow });
		},

		setShowFarmWindow: (show: boolean) => {
			set({ showFarmWindow: show });
		},

		addStatPoint: (stat: keyof CharacterStats) => {
			const state = get();
			if (!(BASE_STATS as readonly string[]).includes(stat)) return;
			if (state.characterStats.availablePoints <= 0) return;

			const newStats = { ...state.characterStats };
			newStats[stat]++;
			newStats.availablePoints--;
			Object.assign(newStats, calculateCombatStats(newStats));

			const newRates = calculateResourceRates(
				state.tiles,
				newStats,
				state.farmLevels,
				state.prestige
			);

			set({
				characterStats: newStats,
				resourceRates: newRates,
			});
		},

		buyTile: (x: number, y: number) => {
			const state = get();
			if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
			const target = state.tiles[y]?.[x];
			if (!target || target.isOwned) return false;
			if (state.biomeSelectionActive) return false;

			const isAdjacent = neighbours(x, y).some(
				([ax, ay]) => state.tiles[ay]?.[ax]?.isOwned
			);
			if (!isAdjacent) return false;

			const owned = countOwnedTiles(state.tiles);
			const cost = calculateTileCost(owned, effectiveTileDiscount(state.characterStats, state.prestige));
			if (!canAffordBundle(state.resources, tileCostAsResources(cost))) return false;

			// Every 4th owned count (3, 7, 11 ...) the player picks the biome; payment happens on selection
			if (owned % 4 === 3) {
				const availableBiomes = Object.keys(BIOMES).filter(
					(name) =>
						!SPECIAL_SINGLE_TYPE_BIOMES.includes(name as BiomeType) &&
						!EMPTY_BIOMES.includes(name as BiomeType)
				) as BiomeType[];

				set({
					biomeSelectionActive: true,
					pendingTileCoords: { x, y },
					selectableBiomes: availableBiomes,
				});
				return true;
			}

			return completePurchase(x, y, getRandomBiome(state.tiles, x, y));
		},

		selectBiome: (biome: BiomeType) => {
			const state = get();
			if (
				!state.biomeSelectionActive ||
				!state.pendingTileCoords ||
				!state.selectableBiomes ||
				!state.selectableBiomes.includes(biome)
			) {
				return false;
			}

			const { x, y } = state.pendingTileCoords;
			if (!completePurchase(x, y, biome)) {
				// Could not pay any more: drop the pending selection
				set({
					biomeSelectionActive: false,
					pendingTileCoords: null,
					selectableBiomes: null,
				});
				return false;
			}
			return true;
		},

		cancelBiomeSelection: () => {
			set({
				biomeSelectionActive: false,
				pendingTileCoords: null,
				selectableBiomes: null,
			});
		},

		// Starts the (timed) castle upgrade: resources are paid now, the level changes when the timer ends
		upgradeCastle: () => {
			const state = get();
			if (state.castleUpgrade) return false;

			const castle = findCastle(state.tiles);
			if (!castle || !castle.tile.upgradeCost || !castle.tile.level) return false;
			if (castle.tile.level >= CASTLE_UPGRADE.maxLevel) return false;
			if (!canAffordBundle(state.resources, castle.tile.upgradeCost)) return false;

			set({
				resources: subtractBundle(state.resources, castle.tile.upgradeCost),
				castleUpgrade: {
					toLevel: castle.tile.level + 1,
					remainingSec: castleUpgradeDuration(castle.tile.level, state.prestige),
				},
			});
			return true;
		},

		upgradeGroundsTile: (x: number, y: number, buildingType: string) => {
			const state = get();
			const tile = state.tiles[y]?.[x];
			if (!tile || !tile.isOwned || tile.biome !== 'grounds') return false;
			if (tile.building || !(buildingType in BUILDINGS)) return false;

			const cost = calculateBuildingCost(state.tiles, state.prestige);
			if (!canAffordBundle(state.resources, cost)) return false;

			const updatedTiles = state.tiles.map((row) => [...row]);
			updatedTiles[y][x] = { ...tile, level: 2, building: buildingType };
			const newRates = calculateResourceRates(
				updatedTiles,
				state.characterStats,
				state.farmLevels,
				state.prestige
			);

			set({
				tiles: updatedTiles,
				resources: subtractBundle(state.resources, cost),
				resourceRates: newRates,
			});
			return true;
		},

		// Collect a chest: reward = passive gold/s x random minutes, plus a small bonus per Luck
		collectChest: (x: number, y: number) => {
			const state = get();
			const tile = state.tiles[y]?.[x];
			if (!tile || !tile.isOwned || !tile.hasChest) return false;

			const goldIncomeRate = state.resourceRates.total.gold;
			const minSec = CHEST.minMinutes * 60;
			const maxSec = CHEST.maxMinutes * 60;
			const randomTimeInSeconds =
				Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec;
			const luck = 1 + state.characterStats.luck * CHEST.luckBonusPerPoint;
			const goldReward = Math.floor(goldIncomeRate * randomTimeInSeconds * luck);

			const newTiles = [...state.tiles];
			newTiles[y] = [...newTiles[y]];
			newTiles[y][x] = { ...newTiles[y][x], hasChest: false };

			set({
				tiles: newTiles,
				activeChests: Math.max(0, state.activeChests - 1),
				resources: {
					...state.resources,
					gold: state.resources.gold + goldReward,
				},
				lastChestReward: goldReward,
				lastChestGoldRate: goldIncomeRate,
				lastChestMinutesAwarded: randomTimeInSeconds / 60,
			});
			return true;
		},

		// Gold for a click on the map: gold/s x click power. Rate limited (see lib/clickLimiter).
		clickForGold: (input: ClickInput) => {
			if (!clickLimiter.take(input)) return 0;
			const state = get();
			const power =
				(CLICK_LADDER[state.clickLevel]?.power ?? CLICK_LADDER[0].power) *
				(1 + legacyEffect(state.prestige, 'mastery'));
			const gold = state.resourceRates.total.gold * power;
			if (!(gold > 0)) return 0;
			set({
				resources: { ...state.resources, gold: state.resources.gold + gold },
			});
			return gold;
		},

		// A bonus critter was clicked (farm meadow or map): a few seconds of that resource's income.
		// The amount is computed here from the current rates (the UI cannot name its own reward), the click must be a real
		// one that passes the shared limiter, and each source has a cooldown.
		claimCritterGift: (gift: CritterGift, input: ClickInput): GiftResult | null => {
			const def = FARM_BONUS.critters[gift?.type];
			if (!def || (gift.source !== 'farm' && gift.source !== 'map')) return null;
			if (!clickLimiter.take(input)) return null;

			const cooldown =
				gift.source === 'farm' ? AMBIENT_LIFE.farmGiftCooldownMs : AMBIENT_LIFE.giftCooldownMs;
			if (input.now - (lastGiftAt[gift.source] ?? -Infinity) < cooldown) return null;

			const state = get();
			const seconds = gift.source === 'farm' ? def.seconds : AMBIENT_LIFE.giftSeconds;
			const rate = state.resourceRates.total[def.resource] ?? 0;
			let amount = Math.max(def.min, rate * seconds);
			if (gift.golden) amount *= FARM_BONUS.goldenMultiplier;
			amount = Math.round(amount * 10) / 10;

			lastGiftAt[gift.source] = input.now;
			get().addResources({ [def.resource]: amount });
			return { resource: def.resource, amount };
		},

		// Tapping an owned tile yields a slice of its own output (per-tile cooldown + the shared click limiter)
		tapTile: (x: number, y: number, input?: ClickInput): TapResult | null => {
			if (!input || !clickLimiter.take(input)) return null;

			const state = get();
			const key = `${x},${y}`;
			if (input.now - (lastTapAt[key] ?? -Infinity) < TILE_TAP.cooldownMs) return null;

			const perSecond = calculateTileTapYield(state.tiles, x, y, state.resourceRates);
			const lucky =
				TILE_TAP.luckyEnabled && Math.random() * 100 < state.characterStats.critChance;
			const mult =
				TILE_TAP.seconds *
				(lucky ? 1 + state.characterStats.critDmgMultiplier / 100 : 1);

			const items = (Object.entries(perSecond) as [keyof Resources, number][])
				.map(([resource, rate]) => ({ resource, amount: rate * mult }))
				.filter((item) => item.amount > 0);
			if (items.length === 0) return null;

			lastTapAt[key] = input.now;
			const gained: Partial<Resources> = {};
			items.forEach(({ resource, amount }) => {
				gained[resource] = amount;
			});
			get().addResources(gained);
			return { items, lucky };
		},

		tick: (deltaTime: number) => {
			const state = get();
			// Bounded, never negative: editing the system clock cannot grant (or remove) progress
			const deltaMs = Number.isFinite(deltaTime) ? deltaTime : 0;
			const secondsElapsed = Math.min(Math.max(0, deltaMs), MAX_CATCHUP_SEC * 1000) / 1000;
			if (secondsElapsed === 0) return;

			// Resource accumulation (xp has its own multiplier)
			const newResources = { ...state.resources };
			(Object.entries(state.resourceRates.total) as [keyof Resources, number][]).forEach(
				([resource, rate]) => {
					if (resource === 'xp') return;
					newResources[resource] = Math.min(
						newResources[resource] + rate * secondsElapsed,
						RESOURCE_CAP
					);
				}
			);
			const xpGain =
				state.resourceRates.total.xp * (1 + state.characterStats.xpGainMultiplier / 100);
			newResources.xp += xpGain * secondsElapsed;

			let newTiles = state.tiles;
			let newRates = state.resourceRates;
			let newCastleUpgrade = state.castleUpgrade;

			// Castle upgrade timer (counted from tick deltas, so changing the clock cannot skip it)
			if (newCastleUpgrade) {
				const remaining = newCastleUpgrade.remainingSec - secondsElapsed;
				if (remaining <= 0) {
					const castle = findCastle(state.tiles);
					if (castle) {
						newTiles = state.tiles.map((row) => [...row]);
						newTiles[castle.y][castle.x] = {
							...castle.tile,
							level: newCastleUpgrade.toLevel,
							upgradeCost:
								CASTLE_UPGRADE.upgradeCosts[newCastleUpgrade.toLevel - 1] ?? undefined,
						};
						newRates = calculateResourceRates(
							newTiles,
							state.characterStats,
							state.farmLevels,
				state.prestige
						);
					}
					newCastleUpgrade = null;
				} else {
					newCastleUpgrade = { ...newCastleUpgrade, remainingSec: remaining };
				}
			}

			// Chests: the spawn timer only runs while there is room for another chest
			let newChestSpawnTimer = state.chestSpawnTimer;
			let newActiveChestsCount = state.activeChests;
			if (newActiveChestsCount >= CHEST.max) {
				newChestSpawnTimer = 0;
			} else {
				newChestSpawnTimer += secondsElapsed;
				if (newChestSpawnTimer >= CHEST.intervalSec) {
					newChestSpawnTimer = 0;
					const eligibleTiles: { x: number; y: number }[] = [];
					newTiles.forEach((row, y) => {
						row.forEach((tile, x) => {
							if (tile.isOwned && tile.biome !== 'castle' && !tile.hasChest) {
								eligibleTiles.push({ x, y });
							}
						});
					});
					if (eligibleTiles.length > 0) {
						const { x, y } =
							eligibleTiles[Math.floor(Math.random() * eligibleTiles.length)];
						newTiles = newTiles === state.tiles ? [...state.tiles] : newTiles;
						newTiles[y] = [...newTiles[y]];
						newTiles[y][x] = { ...newTiles[y][x], hasChest: true };
						newActiveChestsCount++;
					}
				}
			}

			// Level and stat points
			const { level, progress } = calculateLevel(newResources.xp);
			const newCharacterStats = { ...state.characterStats };
			if (level > state.level.level) {
				newCharacterStats.availablePoints += level - state.level.level;
			}

			set({
				resources: newResources,
				resourceRates: newRates,
				level: { level, progress },
				previousLevel: state.level.level,
				characterStats: newCharacterStats,
				tiles: newTiles,
				castleUpgrade: newCastleUpgrade,
				chestSpawnTimer: newChestSpawnTimer,
				activeChests: newActiveChestsCount,
				playSeconds: state.playSeconds + secondsElapsed,
			});
		},

		setPlayerName: (name: string) => {
			if (name && name.trim().length > 0) {
				set({ playerName: name.trim().substring(0, 9) }); // max 9 characters
			}
		},

		setPlayerClass: (playerClass: PlayerClassId) => {
			if (PLAYER_CLASSES[playerClass]) set({ playerClass });
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

		toggleCharacterWindow: () =>
			set((state) => ({ showCharacterWindow: !state.showCharacterWindow })),
		toggleStatisticsWindow: () =>
			set((state) => ({ showStatisticsWindow: !state.showStatisticsWindow })),
		toggleMerchantWindow: () => {
			// Close other windows if merchant window is being opened
			if (!get().showMerchantWindow) {
				set({
					showCharacterWindow: false,
					showStatisticsWindow: false,
					showMerchantWindow: true,
				});
			} else {
				set({ showMerchantWindow: false });
			}
		},

		// Sell resources to the merchant for gold. Gold and XP cannot be sold.
		sellResources: (resource: keyof Resources, amount: number) => {
			if (!(resource in MERCHANT_RESOURCE_PRICES)) return false;
			if (!isPositiveNumber(amount)) return false;

			const state = get();
			if (state.resources[resource] < amount) return false;

			const price =
				MERCHANT_RESOURCE_PRICES[resource as keyof typeof MERCHANT_RESOURCE_PRICES];
			const goldGained = Math.floor(amount * price);

			set({
				resources: {
					...state.resources,
					[resource]: state.resources[resource] - amount,
					gold: Math.min(state.resources.gold + goldGained, RESOURCE_CAP),
				},
			});
			return true;
		},

		// Buy whole units of a resource from the merchant (price rounds UP in the merchant's favour)
		buyResource: (resource: keyof Resources, amount: number) => {
			if (!(resource in MERCHANT_RESOURCE_PRICES)) return false;
			if (!isPositiveNumber(amount)) return false;
			const units = Math.floor(amount);
			if (units < 1) return false;

			const state = get();
			const price = Math.ceil(
				units *
					MERCHANT_RESOURCE_PRICES[resource as keyof typeof MERCHANT_RESOURCE_PRICES] *
					MERCHANT_BUY_MULTIPLIER
			);
			if (state.resources.gold < price) return false;

			set({
				resources: {
					...state.resources,
					gold: state.resources.gold - price,
					[resource]: Math.min(state.resources[resource] + units, RESOURCE_CAP),
				},
			});
			return true;
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
	};
};

export const useGameStore = create(
	persist<GameState, [], [], PersistedGame>((set, get) => createGameSlice(set, get), {
		name: SAVE_NAME,
		version: SAVE_VERSION,
		// Encrypted IndexedDB vault (already validated by sanitizeSave when it is read)
		storage: vaultStorage,
		// Only game data is saved; rates, UI flags and actions are rebuilt on load
		partialize: (state) => pickPersisted(state),
		merge: (persisted, current) => {
			const saved = persisted as PersistedGame | undefined;
			if (!saved) return { ...current, isHydrated: true };
			const rates = calculateResourceRates(
				saved.tiles,
				saved.characterStats,
				saved.farmLevels,
				saved.prestige
			);
			return {
				...current,
				...saved,
				resourceRates: rates,
				isHydrated: true,
			};
		},
		// From here on changes are written (nothing is saved before the first load has finished)
		onRehydrateStorage: () => () => markVaultReady(),
	})
);
