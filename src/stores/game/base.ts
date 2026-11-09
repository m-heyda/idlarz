// base.ts
// Split out of gameStore.ts (IDL-14); the actions and their behaviour are unchanged.

import { LIMITS } from '@/config/limits';
import { DEFAULT_PLAYER_CLASS } from '@/config/playerClasses';
import { STARTING_GEMS } from '@/config/economy';
import { DEFAULT_PLAYER_NAME, INITIAL_CHARACTER_STATS } from '@/config/character';
import { CASTLE_X, CASTLE_Y } from '@/config/castle';
import { calculateCombatStats, calculateLevel } from '@/utils/game/character';
import { calculateResourceRates } from '@/utils/game/income';
import { createInitialWorld, STARTER_FREE_TILES } from '@/utils/game/tiles';
import { EMPTY_PRESTIGE, startingResources } from '@/utils/game/rebirth';
import { type ChestLoot } from '@/lib/chests';
import { createClickLimiter } from '@/lib/clickLimiter';
import { maxHp, maxMana } from '@/lib/combat';
import type { LimitContext } from '@/lib/limits';
import { gearIncomePct } from '@/lib/gearEconomy';
import { starterBag } from '@/lib/inventory';
import { useUiStore } from '@/stores/uiStore';
import { STARTER_EQUIPMENT } from '@/config/itemCatalog';
import type { CombatClientState, Equipment, GameState, MerchantRefresh, MerchantStock, Monster, PrestigeState } from '@/types/game';
import { getTile, type World } from '@/utils/world';

export type GameSet = (partial: Partial<GameState> | ((state: GameState) => Partial<GameState>)) => void;
export type GameGet = () => GameState;

/** The income rates for the state with this gear on (a set bonus can add income). */
export const ratesWithGear = (
	state: Pick<GameState, 'tiles' | 'characterStats' | 'farmLevels' | 'prestige' | 'farmUpgrades' | 'merchantUpgrades'>,
	equipment: Equipment,
) =>
	calculateResourceRates(
		state.tiles,
		state.characterStats,
		state.farmLevels,
		state.prestige,
		state.farmUpgrades,
		state.merchantUpgrades,
		gearIncomePct(equipment),
	);

/** What can raise a limit (see config/limits.ts): the merchant bonuses and the rebirth state. */
export const limitCtx = (state: Pick<GameState, 'merchantUpgrades' | 'prestige'>): LimitContext => ({
	merchantUpgrades: state.merchantUpgrades,
	prestige: state.prestige,
});

// Shared by the gold click and the tile tap: one token per physical click
export const clickLimiter = createClickLimiter();

export const BASE_STATS = ['strength', 'dexterity', 'intelligence', 'vitality', 'charisma'] as const;

export const isPositiveNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** What the browser knows about combat before the server has said anything: no fight, auto-battle off and auto-use on (the server's own defaults). */
export const initialCombat = (): CombatClientState => ({
	fight: null,
	autoBattle: false,
	autoUse: true,
	cd: { heal: 0, stun: 0, potion: 0 },
	maxHp: 0,
	maxMp: 0,
	retrySec: 0,
	autoNote: null,
	at: 0,
	eventNo: null,
	notice: null,
	pending: null,
	queue: [],
	resting: false,
	restSec: 0,
	restEndsAt: null,
	queueMax: LIMITS.battleQueue,
	buffs: [],
});

/** All game data of a brand-new game (no actions). */
export const createInitialData = (prestige: PrestigeState = EMPTY_PRESTIGE, random: () => number = Math.random) => {
	const grid = createInitialWorld(random);
	const stats = { ...INITIAL_CHARACTER_STATS };
	Object.assign(stats, calculateCombatStats(stats)); // derived stats always follow the formulas
	const equipment = { ...STARTER_EQUIPMENT };
	const rates = calculateResourceRates(grid, stats, {}, prestige, undefined, undefined, gearIncomePct(equipment));
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
		monsters: [] as Monster[],
		combat: initialCombat(),
		farmLevels: {} as Record<string, number>,
		farmUpgrades: {} as Record<string, number>,
		merchantUpgrades: {} as Record<string, number>,
		merchantStock: null as MerchantStock | null,
		merchantRefreshes: 0,
		merchantRefresh: { windowAt: 0, freeUsed: 0, lastAt: 0 } as MerchantRefresh,
		isHydrated: false,
		freeTiles: STARTER_FREE_TILES,
		prestige: { ...prestige, upgrades: { ...prestige.upgrades } },
		clickLevel: 0,
		castleUpgrade: null,
		playSeconds: 0,
		activeChests: 0,
		gems: STARTING_GEMS, // a new game's gift; once the account has a ledger the server's balance replaces it on every answer
		lootPity: {} as Record<string, number>,
		autoSellUpTo: null as string | null,
		invVer: null as number | null, // the inventory version the server last gave (transient)
		lastChestLoot: null as ChestLoot | null, // what the last chest held (transient: only drives the toast)
	};
};

export const findCastle = (tiles: World) => {
	const tile = getTile(tiles, CASTLE_X, CASTLE_Y);
	return tile && tile.biome === 'castle' ? { tile, x: CASTLE_X, y: CASTLE_Y } : null;
};

export const toast = (text: string) => useUiStore.getState().showToast(text);
