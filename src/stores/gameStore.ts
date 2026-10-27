import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
	DEFAULT_PLAYER_CLASS,
	PLAYER_CLASSES,
	type PlayerClassId,
} from '@/config/playerClasses';
import {
	ANIMALS,
	BUILDINGS,
	AMBIENT_LIFE,
	CASTLE_UPGRADE,
	CHEST,
	STARTING_GEMS,
	FARM_BONUS,
	CLICK_LADDER,
	DEFAULT_PLAYER_NAME,
	CASTLE_X,
	CASTLE_Y,
	INITIAL_CHARACTER_STATS,
	FARM_UPGRADES,
	LEGACY_UPGRADES,
	MAX_CATCHUP_SEC,
	MERCHANT_BUYABLE,
	MERCHANT_BUY_MULTIPLIER,
	MERCHANT_RESOURCE_PRICES,
	MERCHANT_SHOP_ITEMS,
	MERCHANT_UPGRADES,
	type MerchantUpgradeId,
	REBIRTH,
	RESOURCE_CAP,
	XP_CAP,
	TILE_TAP,
	type FarmUpgradeId,
	type LegacyUpgradeId,
} from '@/config/gameConfig';
import {
	affordableAnimals,
	animalBatchCost,
	calculateBuildingCost,
	canBuildOn,
	calculateCombatStats,
	calculateLevel,
	calculateResourceRates,
	calculateTileCost,
	calculateTileTapYield,
	calculateXpGain,
	canAffordBundle,
	castleUpgradeDuration,
	countOwnedTiles,
	createInitialWorld,
	economyTiles,
	EMPTY_PRESTIGE,
	effectiveTileDiscount,
	farmCap,
	farmUpgradeCost,
	farmUpgradeLevel,
	STARTER_FREE_TILES,
	legacyEffect,
	legacyGain,
	legacyUpgradeCost,
	merchantLevel,
	merchantLuck,
	merchantUpgradeCost,
	sellPayout,
	startingResources,
	subtractBundle,
	tileCostAsResources,
} from '@/utils/gameUtils';
import { rollBiome } from '@/utils/biomeRules';
import { pickChestSpot, rollChestLoot, type ChestLoot } from '@/lib/chests';
import { createClickLimiter } from '@/lib/clickLimiter';
import { createHitGuard } from '@/lib/hitGuard';
import { applyHit, armorOf, dodgeChance, leechHeal, manaRegenPerSec, maxHp, maxMana, newFight, regen, rollHit, stepFight } from '@/lib/combat';
import { emitCombat } from '@/lib/combatFx';
import { SKILLS, type SkillId } from '@/catalog/skills';
import { castRefusal, healAmount, isSkillId, tickCooldowns } from '@/lib/skills';
import { generateMerchantStock, refreshCost, rotationRng, shopPriceOf, stockDue } from '@/lib/merchant';
import { emitSaveEvent, withSaveEvents } from '@/lib/saveEvents';
import { addDrop, aggregateStats, equipFromBag, gearOf, moveSlot, organizeBag, removeFromBag, slotQty, stackOf, starterBag, unequip } from '@/lib/inventory';
import { plainItem, sellValueOf } from '@/lib/itemInstance';
import { castleLevelOf, monstersOutsideWard } from '@/lib/castleWard';
import { canSpawn } from '@/lib/spawnLimits';
import { isAutoSold, receiveDrops, rollKillLoot } from '@/lib/loot';
import { advanceMonsters, monsterAt, pickSpawnTile, spawnThreshold } from '@/lib/monsters';
import { COMBAT } from '@/config/combatConfig';
import { ITEM_CATALOG, RARITIES, STARTER_EQUIPMENT } from '@/config/itemCatalog';
import { markSaveReady, PERSIST_NAME, PERSIST_VERSION, saveStorage } from '@/lib/saveStorage';
import { pickPersisted, type PersistedGame } from '@/lib/sanitizeSave';
import type {
	BiomeType,
	CharacterStats,
	ClickInput,
	CritterGift,
	EquipmentSlot,
	FightState,
	GameState,
	GiftResult,
	MerchantStock,
	Monster,
	PrestigeState,
	Resources,
	TapResult,
} from '@/types/game';
import { MAX_OWNED_TILES, getTile, hasOwnedNeighbour, inRange, isOwnedAt, ownedCount, patchTile, setTile, type World } from '@/utils/world';

// Last tap time per tile (not persisted) - enforces TILE_TAP.cooldownMs
const lastTapAt: Record<string, number> = {};

// Last accepted critter gift per source (not persisted) - enforces the gift cooldowns
const lastGiftAt: Record<string, number> = {};

// Shared by the gold click and the tile tap: one token per physical click
const clickLimiter = createClickLimiter();
const hitGuard = createHitGuard(); // fight hits are not rate limited (see lib/hitGuard)

const BASE_STATS = [
	'strength',
	'dexterity',
	'intelligence',
	'vitality',
	'charisma',
] as const;

const isPositiveNumber = (n: unknown): n is number =>
	typeof n === 'number' && Number.isFinite(n) && n > 0;

/** A tiny seeded generator: the server and the first client render must start from the same world. */
const seededRandom = (seed: number) => () => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** All game data of a brand-new game (no actions). */
export const createInitialData = (prestige: PrestigeState = EMPTY_PRESTIGE, random: () => number = Math.random) => {
	const grid = createInitialWorld(random);
	const stats = { ...INITIAL_CHARACTER_STATS };
	Object.assign(stats, calculateCombatStats(stats)); // derived stats always follow the formulas
	const equipment = { ...STARTER_EQUIPMENT };
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
		equipment,
		bag: starterBag(),
		playerHp: maxHp(stats, equipment),
		playerMp: maxMana(stats, equipment),
		skillCd: {} as Partial<Record<SkillId, number>>,
		monsters: [] as Monster[],
		monsterSpawnTimer: 0,
		nextMonsterId: 1,
		fight: null as FightState | null,
		farmLevels: {} as Record<string, number>,
		farmUpgrades: {} as Record<string, number>,
		merchantUpgrades: {} as Record<string, number>,
		merchantStock: null as MerchantStock | null,
		isHydrated: false,
		freeTiles: STARTER_FREE_TILES,
		prestige: { ...prestige, upgrades: { ...prestige.upgrades } },
		clickLevel: 0,
		castleUpgrade: null,
		playSeconds: 0,
		chestSpawnTimer: 0,
		activeChests: 0,
		gems: STARTING_GEMS,
		lootPity: {} as Record<string, number>,
		autoSellUpTo: null as string | null,
		lastChestLoot: null as ChestLoot | null, // what the last chest held (transient: only drives the toast)
	};
};

const findCastle = (tiles: World) => {
	const tile = getTile(tiles, CASTLE_X, CASTLE_Y);
	return tile && tile.biome === 'castle' ? { tile, x: CASTLE_X, y: CASTLE_Y } : null;
};


const createGameSlice = (
	set: (
		partial: Partial<GameState> | ((state: GameState) => Partial<GameState>)
	) => void,
	get: () => GameState
) => {
	/** Charge, claim the tile, award XP + reputation. */
	const completePurchase = (x: number, y: number, biome: BiomeType): boolean => {
		const state = get();
		const owned = economyTiles(state.tiles, state.freeTiles);
		const cost = calculateTileCost(owned, effectiveTileDiscount(state.characterStats, state.prestige, state.merchantUpgrades));
		const bundle = tileCostAsResources(cost);
		if (!canAffordBundle(state.resources, bundle)) return false;

		const newTiles = setTile(state.tiles, x, y, { biome, isOwned: true });

		const newRates = calculateResourceRates(
			newTiles,
			state.characterStats,
			state.farmLevels,
				state.prestige,
				state.farmUpgrades
		);

		const xpGain =
			calculateXpGain(owned + 1) * (1 + state.characterStats.xpGainMultiplier / 100);
		const resources = subtractBundle(state.resources, bundle);
		resources.xp = Math.min(resources.xp + xpGain, XP_CAP);

		set({
			tiles: newTiles,
			resources,
			resourceRates: newRates,
			characterStats: {
				...state.characterStats,
				reputation: state.characterStats.reputation + 100,
			},
		});
		return true;
	};

	const slice = {
		// A fixed placeholder world: it is rendered on the server and before the save is read, so it must not be
		// random (that broke hydration). `merge` below replaces it with a random one for a player without a save.
		...createInitialData(EMPTY_PRESTIGE, seededRandom(1)),

		resetGame: () => {
			clickLimiter.reset();
			hitGuard.reset();
			Object.keys(lastTapAt).forEach((key) => delete lastTapAt[key]);
			Object.keys(lastGiftAt).forEach((key) => delete lastGiftAt[key]);
			set({ ...createInitialData(), isHydrated: true });
		},

		// Rebirth: restart with the Legacy bonus. Keeps name, class, play time and all Legacy.
		rebirth: () => {
			const state = get();
			const castle = findCastle(state.tiles);
			if (!castle || (castle.tile.level ?? 1) < REBIRTH.minCastleLevel || state.castleUpgrade) return false;
			const ownedTiles = economyTiles(state.tiles, state.freeTiles);
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
			hitGuard.reset();
			Object.keys(lastTapAt).forEach((key) => delete lastTapAt[key]);
			Object.keys(lastGiftAt).forEach((key) => delete lastGiftAt[key]);
			const fresh = createInitialData(prestige);
			set({
				...fresh,
				// gear is character progression: it survives a rebirth (HP is refilled)
				equipment: state.equipment,
				bag: state.bag,
				gems: state.gems, // the premium currency survives a rebirth
				lootPity: state.lootPity,
				autoSellUpTo: state.autoSellUpTo,
				// the bag survives, so does the room Pack Rat made for it; the other merchant bonuses start again
				merchantUpgrades: state.merchantUpgrades.packrat ? { packrat: state.merchantUpgrades.packrat } : {},
				playerHp: maxHp(fresh.characterStats, state.equipment),
				playerMp: maxMana(fresh.characterStats, state.equipment),
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

		// Buy animals of a kind with food (each one costs more than the last). `count` is a number or 'max' (all you can
		// afford). The pen holds at most farmCap animals per kind. Returns how many were bought.
		purchaseAnimal: (animalId: string, count: number | 'max' = 1) => {
			const state = get();
			const animal = ANIMALS.find((a) => a.id === animalId);
			if (!animal) return 0;
			if (count !== 'max' && !(Number.isInteger(count) && count > 0)) return 0;

			const owned = state.farmLevels[animalId] || 0;
			const n = affordableAnimals(
				animal,
				owned,
				state.resources.food,
				farmCap(state.farmUpgrades),
				count === 'max' ? Infinity : count
			);
			if (n <= 0 || (count !== 'max' && n < count)) return 0; // a fixed batch is all or nothing
			const cost = animalBatchCost(animal, owned, n);

			const newFarmLevels = { ...state.farmLevels, [animalId]: owned + n };
			const newRates = calculateResourceRates(
				state.tiles,
				state.characterStats,
				newFarmLevels,
				state.prestige,
				state.farmUpgrades
			);

			set({
				farmLevels: newFarmLevels,
				resources: { ...state.resources, food: state.resources.food - cost },
				resourceRates: newRates,
			});
			return n;
		},

		// One level of a farm upgrade (feed, hen house, dairy, tannery, pen), paid in resources
		buyFarmUpgrade: (id: FarmUpgradeId) => {
			const state = get();
			const def = FARM_UPGRADES[id];
			if (!def) return false;
			const level = farmUpgradeLevel(state.farmUpgrades, id);
			if (level >= def.maxLevel) return false;
			const cost = farmUpgradeCost(id, level);
			if (!canAffordBundle(state.resources, cost)) return false;

			const farmUpgrades = { ...state.farmUpgrades, [id]: level + 1 };
			const newRates = calculateResourceRates(
				state.tiles,
				state.characterStats,
				state.farmLevels,
				state.prestige,
				farmUpgrades
			);
			set({ farmUpgrades, resources: subtractBundle(state.resources, cost), resourceRates: newRates });
			return true;
		},

		addStatPoint: (stat: keyof CharacterStats) => {
			const state = get();
			if (!(BASE_STATS as readonly string[]).includes(stat)) return false;
			if (state.characterStats.availablePoints <= 0) return false;

			const newStats = { ...state.characterStats };
			newStats[stat]++;
			newStats.availablePoints--;
			Object.assign(newStats, calculateCombatStats(newStats));

			const newRates = calculateResourceRates(
				state.tiles,
				newStats,
				state.farmLevels,
				state.prestige,
				state.farmUpgrades
			);

			set({
				characterStats: newStats,
				resourceRates: newRates,
			});
			return true;
		},

		buyTile: (x: number, y: number) => {
			const state = get();
			if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
			if (!inRange(x, y) || isOwnedAt(state.tiles, x, y) || ownedCount(state.tiles) >= MAX_OWNED_TILES) return false;
			if (!hasOwnedNeighbour(state.tiles, x, y)) return false;

			const owned = economyTiles(state.tiles, state.freeTiles);
			const purchased = owned - 1;
			const cost = calculateTileCost(owned, effectiveTileDiscount(state.characterStats, state.prestige, state.merchantUpgrades));
			if (!canAffordBundle(state.resources, tileCostAsResources(cost))) return false;

			return completePurchase(x, y, rollBiome(state.tiles, x, y, purchased));
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

		// Builds on an explored tile of any biome (not the castle or a lake; one building per tile, nothing on a tile with a chest or a monster).
		// The tile keeps its biome and its output; the building adds its own. Each building costs more than the last (calculateBuildingCost).
		buildOnTile: (x: number, y: number, buildingType: string) => {
			const state = get();
			const tile = getTile(state.tiles, x, y);
			if (!tile || !canBuildOn(tile) || tile.hasChest || monsterAt(state.monsters, x, y)) return false;
			if (!(buildingType in BUILDINGS)) return false;

			const cost = calculateBuildingCost(state.tiles, state.prestige);
			if (!canAffordBundle(state.resources, cost)) return false;

			const updatedTiles = setTile(state.tiles, x, y, { ...tile, building: buildingType });
			const newRates = calculateResourceRates(
				updatedTiles,
				state.characterStats,
				state.farmLevels,
				state.prestige,
				state.farmUpgrades
			);

			set({
				tiles: updatedTiles,
				resources: subtractBundle(state.resources, cost),
				resourceRates: newRates,
			});
			return true;
		},

		// Collect a chest: gold (passive gold/s x random minutes), a lucky x1.5 gold chest, a bundle of resources, XP or a
		// gear piece - see src/lib/chests.ts. Luck improves the odds and the gold.
		collectChest: (x: number, y: number) => {
			const state = get();
			const tile = getTile(state.tiles, x, y);
			if (!tile || !tile.hasChest) return false;

			const loot = rollChestLoot({
				rates: state.resourceRates.total,
				luck: state.characterStats.luck + merchantLuck(state.merchantUpgrades) + aggregateStats(state.equipment).luck,
				goldFind: aggregateStats(state.equipment).goldFind,
				bag: state.bag,
				castleLevel: castleLevelOf(state.tiles),
				autoSellUpTo: state.autoSellUpTo,
			});

			const newTiles = setTile(state.tiles, x, y, { ...tile, hasChest: false });

			const resources = { ...state.resources };
			let bag = state.bag;
			if (loot.kind === 'gold' || loot.kind === 'boost') resources.gold += loot.gold;
			else if (loot.kind === 'bundle') loot.items.forEach((i) => (resources[i.resource] += i.amount));
			else if (loot.kind === 'xp') resources.xp = Math.min(resources.xp + loot.xp, XP_CAP);
			else {
				const received = receiveDrops(bag, [loot.drop], state.autoSellUpTo, state.merchantUpgrades);
				bag = received.bag;
				resources.gold = Math.min(resources.gold + received.autoSold.gold, RESOURCE_CAP);
			}

			set({
				tiles: newTiles,
				activeChests: Math.max(0, state.activeChests - 1),
				resources,
				bag,
				lastChestLoot: loot,
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

		// Fights. A hit must be a real click (lib/hitGuard) but is not rate limited: speed is skill, damage and crits are rolled here, and so are rewards and loot.
		startFight: (monsterId: number) => {
			const state = get();
			if (state.fight || state.playerHp <= 0) return false;
			const monster = state.monsters.find((m) => m.id === monsterId);
			if (!monster) return false;
			set({ fight: newFight(monster, castleLevelOf(state.tiles)) });
			return true;
		},

		hitMonster: (input: ClickInput) => {
			const state = get();
			const fight = state.fight;
			if (!fight || fight.phase !== 'active') return null;
			if (!hitGuard.take(input)) return null;

			const { damage, crit } = rollHit(state.characterStats, state.equipment, Math.random);
			const { fight: next, killed } = applyHit(fight, damage);
			// Life Leech: a share of the click's damage comes back as HP
			const leech = leechHeal(damage, state.equipment);
			const hpAfter = leech > 0 ? Math.min(maxHp(state.characterStats, state.equipment), state.playerHp + leech) : state.playerHp;
			emitCombat({ kind: 'hit', damage, killed, crit });
			if (!killed) {
				set({ fight: next, playerHp: hpAfter });
				return { damage, killed: false, crit };
			}

			const rates = state.resourceRates.total;
			const loot = rollKillLoot(
				{ type: fight.type, tier: fight.tier },
				{
					goldPerSec: rates.gold,
					xpPerSec: rates.xp * (1 + state.characterStats.xpGainMultiplier / 100),
					luck: state.characterStats.luck + merchantLuck(state.merchantUpgrades) + aggregateStats(state.equipment).luck,
					goldFind: aggregateStats(state.equipment).goldFind,
					owned: [
						...Object.values(state.equipment).map((item) => item?.base),
						...state.bag.map((slot) => (slot && 'item' in slot ? slot.item.base : slot?.id)),
					].filter((id): id is string => !!id),
					castleLevel: castleLevelOf(state.tiles),
					pity: state.lootPity,
				},
				Math.random
			);
			const received = receiveDrops(state.bag, loot.items, state.autoSellUpTo, state.merchantUpgrades);
			set({
				fight: { ...next, phase: 'won', summary: { gold: loot.gold, xp: loot.xp, items: received.stored, convertedGold: received.convertedGold, autoSold: received.autoSold } },
				monsters: state.monsters.filter((m) => m.id !== fight.monsterId),
				playerHp: hpAfter,
				bag: received.bag,
				lootPity: loot.pity,
				resources: {
					...state.resources,
					gold: Math.min(state.resources.gold + loot.gold + received.convertedGold + received.autoSold.gold, RESOURCE_CAP),
					xp: Math.min(state.resources.xp + loot.xp, XP_CAP),
				},
			});
			return { damage, killed: true, crit };
		},

		// Closing the fight (flee, or dismissing an end panel). The monster is never persisted damaged, so it is simply full HP again.
		leaveFight: () => set({ fight: null }),

		// Removes a monster from the map without a fight or loot (for a rat too strong to beat while the map is at its monster cap)
		dismissMonster: (id: number) => {
			const state = get();
			if (state.fight?.monsterId === id) return false;
			if (!state.monsters.some((m) => m.id === id)) return false;
			set({ monsters: state.monsters.filter((m) => m.id !== id) });
			return true;
		},

		drinkPotion: (bagIndex: number) => {
			const state = get();
			const slot = Number.isInteger(bagIndex) ? stackOf(state.bag[bagIndex]) : null;
			const healHp = slot ? ITEM_CATALOG[slot.id]?.consumable?.healHp : undefined;
			if (!slot || !healHp || slot.qty < 1) return false;
			const max = maxHp(state.characterStats, state.equipment);
			if (state.playerHp >= max) return false;
			if (state.fight && (state.fight.phase !== 'active' || state.fight.potionCd > 0)) return false;

			const healed = Math.min(healHp, max - state.playerHp);
			set({
				bag: removeFromBag(state.bag, bagIndex, 1),
				playerHp: state.playerHp + healed,
				fight: state.fight ? { ...state.fight, potionCd: COMBAT.potionCooldownSec } : null,
			});
			emitCombat({ kind: 'heal', amount: healed });
			return true;
		},

		// Skills: mana and a cooldown each. Heal works anywhere, Stun only in an active fight (see lib/skills.ts for the rules)
		castSkill: (id: SkillId) => {
			const state = get();
			if (!isSkillId(id)) return false;
			const max = maxHp(state.characterStats, state.equipment);
			const refusal = castRefusal(id, {
				level: state.level.level,
				mana: state.playerMp,
				hp: state.playerHp,
				maxHp: max,
				fight: state.fight,
				cooldowns: state.skillCd,
			});
			if (refusal) return false;
			const skill = SKILLS[id];
			const patch: Partial<GameState> = {
				playerMp: state.playerMp - skill.manaCost,
				skillCd: { ...state.skillCd, [id]: skill.cooldownSec },
			};
			if (id === 'heal') {
				const healed = Math.min(healAmount(state.characterStats, state.equipment, skill), max - state.playerHp);
				patch.playerHp = state.playerHp + healed;
				emitCombat({ kind: 'heal', amount: Math.round(healed) });
			} else if (state.fight) {
				patch.fight = { ...state.fight, stunLeftSec: skill.stunSec ?? 0 };
				emitCombat({ kind: 'stun', sec: skill.stunSec ?? 0 });
			}
			set(patch);
			return true;
		},

		// Gear actions: refused while a fight is open; max HP can drop when gear comes off, so playerHp follows it down
		equipItem: (bagIndex: number) => {
			const state = get();
			if (state.fight) return false;
			const result = equipFromBag(state.bag, state.equipment, bagIndex);
			if (!result) return false;
			set({
				bag: result.bag,
				equipment: result.equipment,
				playerHp: Math.min(state.playerHp, maxHp(state.characterStats, result.equipment)),
				playerMp: Math.min(state.playerMp, maxMana(state.characterStats, result.equipment)),
			});
			return true;
		},

		unequipItem: (slot: EquipmentSlot) => {
			const state = get();
			if (state.fight) return false;
			const result = unequip(state.bag, state.equipment, slot);
			if (!result) return false;
			set({
				bag: result.bag,
				equipment: result.equipment,
				playerHp: Math.min(state.playerHp, maxHp(state.characterStats, result.equipment)),
				playerMp: Math.min(state.playerMp, maxMana(state.characterStats, result.equipment)),
			});
			return true;
		},

		moveBagItem: (from: number, to: number) => {
			const state = get();
			if (state.fight || from === to) return false;
			const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < state.bag.length;
			if (!inRange(from) || !inRange(to)) return false;
			set({ bag: moveSlot(state.bag, from, to) });
			return true;
		},

		// Tidy the bag from the left (stacks merged, gear sorted); like every bag action, not while a fight is open
		organizeBag: () => {
			const state = get();
			if (state.fight) return false;
			set({ bag: organizeBag(state.bag) });
			return true;
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
			newResources.xp = Math.min(newResources.xp + xpGain * secondsElapsed, XP_CAP);

			let newTiles = state.tiles;
			let newRates = state.resourceRates;
			let newCastleUpgrade = state.castleUpgrade;

			// Castle upgrade timer (counted from tick deltas, so changing the clock cannot skip it)
			if (newCastleUpgrade) {
				const remaining = newCastleUpgrade.remainingSec - secondsElapsed;
				if (remaining <= 0) {
					const castle = findCastle(state.tiles);
					if (castle) {
						newTiles = setTile(state.tiles, castle.x, castle.y, {
							...castle.tile,
							level: newCastleUpgrade.toLevel,
							upgradeCost:
								CASTLE_UPGRADE.upgradeCosts[newCastleUpgrade.toLevel - 1] ?? undefined,
						});
						newRates = calculateResourceRates(
							newTiles,
							state.characterStats,
							state.farmLevels,
				state.prestige,
				state.farmUpgrades
						);
					}
					newCastleUpgrade = null;
				} else {
					newCastleUpgrade = { ...newCastleUpgrade, remainingSec: remaining };
				}
			}

			// Chests: the spawn timer only runs while monsters and chests together are below their share of the free tiles
			let newChestSpawnTimer = state.chestSpawnTimer;
			let newActiveChestsCount = state.activeChests;
			const wardLevel = castleLevelOf(newTiles);
			if (!canSpawn(newTiles, wardLevel, state.monsters.length, newActiveChestsCount)) {
				newChestSpawnTimer = 0;
			} else {
				newChestSpawnTimer += secondsElapsed;
				if (newChestSpawnTimer >= CHEST.intervalSec) {
					newChestSpawnTimer = 0;
					const monsterSpots = new Set(state.monsters.map((m) => `${m.x},${m.y}`));
					const spot = pickChestSpot(newTiles, monsterSpots, castleLevelOf(newTiles));
					if (spot) {
						const { x, y } = spot;
						newTiles = patchTile(newTiles, x, y, { hasChest: true });
						newActiveChestsCount++;
					}
				}
			}

			// Monsters: the one being fought is frozen; the spawn timer only runs with enough land and room on the map
			let newMonsters = state.monsters;
			let newMonsterSpawnTimer = state.monsterSpawnTimer;
			let newNextMonsterId = state.nextMonsterId;
			if (newMonsters.length > 0) {
				newMonsters = advanceMonsters(newMonsters, secondsElapsed, Math.random, state.fight?.monsterId ?? null);
				// the castle's ward (castle level 7+) drives monsters out; the one being fought stays until the fight ends
				newMonsters = monstersOutsideWard(newMonsters, castleLevelOf(newTiles), state.fight?.monsterId ?? null);
			}
			if (!canSpawn(newTiles, wardLevel, newMonsters.length, newActiveChestsCount) || countOwnedTiles(newTiles) < COMBAT.spawn.minOwnedTiles) {
				newMonsterSpawnTimer = 0;
			} else {
				newMonsterSpawnTimer += secondsElapsed;
				if (newMonsterSpawnTimer >= spawnThreshold(newNextMonsterId)) {
					newMonsterSpawnTimer = 0;
					const spot = pickSpawnTile(newTiles, newMonsters, Math.random);
					if (spot) {
						newMonsters = [
							...newMonsters,
							{ id: newNextMonsterId, type: 'rat', tier: 1, x: spot.x, y: spot.y, ageSec: 0 },
						];
						newNextMonsterId++;
					}
				}
			}

			// Fight step (monster attacks, king timer) or, with no active fight, HP regeneration
			let newFightState = state.fight;
			let newPlayerHp = state.playerHp;
			const playerMaxHp = maxHp(state.characterStats, state.equipment);
			if (newFightState && newFightState.phase === 'active') {
				const gearRegen = aggregateStats(state.equipment).regen;
				const step = stepFight(newFightState, secondsElapsed, newPlayerHp, armorOf(state.equipment, state.characterStats), Math.random, { perSec: gearRegen, max: playerMaxHp }, dodgeChance(state.equipment));
				newFightState = step.fight;
				newPlayerHp = step.playerHp;
				for (const event of step.events) {
					if (event.kind === 'hurt') emitCombat({ kind: 'hurt', amount: event.amount });
					if (event.kind === 'knockedOut') newPlayerHp = Math.round(playerMaxHp * COMBAT.knockoutHpFraction);
				}
			} else {
				newPlayerHp = regen(newPlayerHp, playerMaxHp, secondsElapsed, aggregateStats(state.equipment).regen);
			}
			newPlayerHp = Math.min(newPlayerHp, playerMaxHp);
			// Mana refills in and out of fights
			const newPlayerMp = Math.min(maxMana(state.characterStats, state.equipment), state.playerMp + manaRegenPerSec(state.characterStats, state.equipment) * secondsElapsed);

			const newPlaySeconds = state.playSeconds + secondsElapsed;

			// Level and stat points
			const { level, progress } = calculateLevel(newResources.xp);
			const castleFinished = !!state.castleUpgrade && !newCastleUpgrade;
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
				monsters: newMonsters,
				monsterSpawnTimer: newMonsterSpawnTimer,
				nextMonsterId: newNextMonsterId,
				fight: newFightState,
				playerHp: newPlayerHp,
				playerMp: newPlayerMp,
				skillCd: tickCooldowns(state.skillCd, secondsElapsed),
				merchantStock: stockDue(state.merchantStock, newPlaySeconds) ? generateMerchantStock(castleLevelOf(state.tiles), rotationRng(newPlaySeconds), newPlaySeconds) : state.merchantStock,
				playSeconds: newPlaySeconds,
			});
			if (castleFinished) emitSaveEvent('castleUpgraded');
			if (level > state.level.level) emitSaveEvent('levelUp');
		},

		setPlayerName: (name: string) => {
			if (name && name.trim().length > 0) {
				set({ playerName: name.trim().substring(0, 9) }); // max 9 characters
			}
		},

		setPlayerClass: (playerClass: PlayerClassId) => {
			if (PLAYER_CLASSES[playerClass]) set({ playerClass });
		},

		applyProfileToFreshGame: (name: string, playerClass: PlayerClassId) => {
			const state = get();
			const cleanName = name.trim().substring(0, 9);
			if (state.playSeconds > 0 || state.playerName !== DEFAULT_PLAYER_NAME || !cleanName || !PLAYER_CLASSES[playerClass]) return false;
			set({ playerName: cleanName, playerClass });
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

		// Sell resources to the merchant for gold. Gold and XP cannot be sold.
		sellResources: (resource: keyof Resources, amount: number) => {
			if (!(resource in MERCHANT_RESOURCE_PRICES)) return false;
			if (!isPositiveNumber(amount)) return false;

			const state = get();
			if (state.resources[resource] < amount) return false;

			const price =
				MERCHANT_RESOURCE_PRICES[resource as keyof typeof MERCHANT_RESOURCE_PRICES];
			const goldGained = sellPayout(price, amount, state.merchantUpgrades);

			set({
				resources: {
					...state.resources,
					[resource]: state.resources[resource] - amount,
					gold: Math.min(state.resources.gold + goldGained, RESOURCE_CAP),
				},
			});
			return true;
		},

		// Sell bag items for gold (flat price per item, plus Haggler). Equipped gear is not in the bag, so it is never sold.
		sellItem: (bagIndex: number, qty?: number) => {
			const state = get();
			if (state.fight) return 0;
			const slot = Number.isInteger(bagIndex) ? state.bag[bagIndex] : null;
			if (!slot) return 0;
			const gear = gearOf(slot);
			const stack = stackOf(slot);
			const unit = gear ? sellValueOf(gear) : stack ? (ITEM_CATALOG[stack.id]?.sellValue ?? 0) : 0;
			if (!unit) return 0;
			const amount = qty === undefined ? 1 : Math.floor(qty);
			if (!(amount >= 1) || amount > slotQty(slot)) return 0;
			const gold = sellPayout(unit, amount, state.merchantUpgrades);
			set({
				bag: removeFromBag(state.bag, bagIndex, amount),
				resources: { ...state.resources, gold: Math.min(state.resources.gold + gold, RESOURCE_CAP) },
			});
			return gold;
		},

		// Throw bag items away for good (no gold); `qty` defaults to one, pass the stack size to clear the slot
		discardItem: (bagIndex: number, qty?: number) => {
			const state = get();
			if (state.fight) return false;
			const slot = Number.isInteger(bagIndex) ? state.bag[bagIndex] : null;
			if (!slot) return false;
			const amount = qty === undefined ? 1 : Math.floor(qty);
			if (!(amount >= 1) || amount > slotQty(slot)) return false;
			set({ bag: removeFromBag(state.bag, bagIndex, amount) });
			return true;
		},

		// Sell every bag item of this rarity or lower that is gear (potions and stacks stay)
		sellJunk: (maxRarity: string) => {
			const state = get();
			if (state.fight) return { gold: 0, count: 0 };
			if (!Object.prototype.hasOwnProperty.call(RARITIES, maxRarity)) return { gold: 0, count: 0 };
			let bag = state.bag;
			let gold = 0;
			let count = 0;
			bag.forEach((slot, index) => {
				const item = gearOf(slot);
				if (!item || !isAutoSold(item, maxRarity)) return;
				gold += sellPayout(sellValueOf(item), 1, state.merchantUpgrades);
				count += 1;
				bag = removeFromBag(bag, index, 1);
			});
			if (count === 0) return { gold: 0, count: 0 };
			set({ bag, resources: { ...state.resources, gold: Math.min(state.resources.gold + gold, RESOURCE_CAP) } });
			return { gold, count };
		},

		// The auto-sell filter: gear of this rarity or lower is sold the moment it drops (null = keep everything)
		setAutoSell: (rarity: string | null) => {
			if (rarity !== null && !Object.prototype.hasOwnProperty.call(RARITIES, rarity)) return;
			set({ autoSellUpTo: rarity });
		},

		// Buy plain gear or potions from the shop; nothing is charged for what does not fit in the bag
		buyItem: (id: string, qty = 1) => {
			const state = get();
			const entry = MERCHANT_SHOP_ITEMS.find((item) => item.id === id);
			if (!entry || !ITEM_CATALOG[id]) return false;
			if (!Number.isInteger(qty) || qty < 1 || qty > 99) return false;
			const price = entry.price * qty;
			if (state.resources.gold < price) return false;
			let bag = state.bag;
			if (ITEM_CATALOG[id].kind === 'consumable') {
				const added = addDrop(bag, { kind: 'consumable', id, qty });
				if (added.overflow > 0) return false;
				bag = added.bag;
			} else {
				for (let i = 0; i < qty; i++) {
					const added = addDrop(bag, { kind: 'gear', item: plainItem(id) });
					if (added.overflow > 0) return false;
					bag = added.bag;
				}
			}
			set({ bag, resources: { ...state.resources, gold: state.resources.gold - price } });
			return true;
		},

		// Buy one piece of the merchant's goods at its price; nothing is charged when it does not fit in the bag
		buyOffer: (index: number) => {
			const state = get();
			const stock = state.merchantStock;
			if (!stock || !Number.isInteger(index) || index < 0 || index >= stock.offers.length) return false;
			const item = stock.offers[index];
			const price = shopPriceOf(item);
			if (state.resources.gold < price) return false;
			const added = addDrop(state.bag, { kind: 'gear', item });
			if (added.overflow > 0) return false;
			set({
				bag: added.bag,
				resources: { ...state.resources, gold: state.resources.gold - price },
				merchantStock: { ...stock, offers: stock.offers.filter((_, i) => i !== index) },
			});
			emitSaveEvent('buyOffer');
			return true;
		},

		// A new shelf of goods for gold (the free reshuffle comes with the timer, in `tick`)
		refreshMerchantStock: () => {
			const state = get();
			const castle = castleLevelOf(state.tiles);
			const cost = refreshCost(castle);
			if (state.resources.gold < cost) return false;
			set({
				resources: { ...state.resources, gold: state.resources.gold - cost },
				merchantStock: generateMerchantStock(castle, Math.random, state.playSeconds),
			});
			emitSaveEvent('refreshMerchantStock');
			return true;
		},

		// One level of a merchant bonus (Haggler, Bulk Discount, Lucky Charm, Pack Rat), paid in gold
		buyMerchantUpgrade: (id: MerchantUpgradeId) => {
			const state = get();
			const def = MERCHANT_UPGRADES[id];
			if (!def) return false;
			const level = merchantLevel(state.merchantUpgrades, id);
			if (level >= def.maxLevel) return false;
			const cost = merchantUpgradeCost(id, level);
			if (state.resources.gold < cost) return false;
			const merchantUpgrades = { ...state.merchantUpgrades, [id]: level + 1 };
			const grow = id === 'packrat' ? Array.from({ length: def.effectPerLevel }, () => null) : [];
			set({
				merchantUpgrades,
				bag: [...state.bag, ...grow],
				resources: { ...state.resources, gold: state.resources.gold - cost },
			});
			return true;
		},

		// Buy whole units of a resource from the merchant (price rounds UP in the merchant's favour)
		buyResource: (resource: keyof Resources, amount: number) => {
			if (!(resource in MERCHANT_RESOURCE_PRICES) || !(MERCHANT_BUYABLE as readonly string[]).includes(resource)) return false;
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

	// Purchases, castle upgrades, rebirth, gear changes: a successful call tells the cloud sync to save soon
	return withSaveEvents(slice);
};

export const useGameStore = create(
	persist<GameState, [], [], PersistedGame>((set, get) => createGameSlice(set, get), {
		name: PERSIST_NAME,
		version: PERSIST_VERSION,
		// One text line in localStorage (decoded and validated by sanitizeSave when it is read)
		storage: saveStorage,
		// Only game data is saved; rates, UI flags and actions are rebuilt on load
		partialize: (state) => pickPersisted(state),
		merge: (persisted, current) => {
			const saved = persisted as PersistedGame | undefined;
			if (!saved) return { ...current, ...createInitialData(), isHydrated: true };
			const rates = calculateResourceRates(
				saved.tiles,
				saved.characterStats,
				saved.farmLevels,
				saved.prestige,
				saved.farmUpgrades
			);
			return {
				...current,
				...saved,
				// an open fight belongs to the tab that opened it: after a reload or a tab take-over it is stale
				fight: null,
				resourceRates: rates,
				isHydrated: true,
			};
		},
		// From here on changes are written (nothing is saved before the first load has finished)
		onRehydrateStorage: () => () => markSaveReady(),
	})
);
