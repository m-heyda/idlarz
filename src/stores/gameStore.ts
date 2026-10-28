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
	CASTLE_UPGRADE,
	STARTING_GEMS,
	CLICK_LADDER,
	DEFAULT_PLAYER_NAME,
	CASTLE_X,
	CASTLE_Y,
	INITIAL_CHARACTER_STATS,
	FARM_UPGRADES,
	EMBER_UPGRADES,
	MAX_CATCHUP_SEC,
	MERCHANT_BUYABLE,
	MERCHANT_RESOURCE_PRICES,
	MERCHANT_SHOP_ITEMS,
	MERCHANT_UPGRADES,
	type MerchantUpgradeId,
	RESOURCE_CAP,
	XP_CAP,
	type FarmUpgradeId,
	type EmberUpgradeId,
} from '@/config/gameConfig';
import {
	affordableAnimals,
	animalBatchCost,
	calculateBuildingCost,
	canBuildOn,
	calculateCombatStats,
	calculateLevel,
	calculateResourceRates,
	buyCost,
	calculateTileCost,
	calculateXpGain,
	canAffordBundle,
	castleUpgradeDuration,
	createInitialWorld,
	economyTiles,
	EMPTY_PRESTIGE,
	effectiveTileDiscount,
	farmCap,
	farmUpgradeCost,
	farmUpgradeLevel,
	STARTER_FREE_TILES,
	emberEffect,
	rebirthStatus,
	emberUpgradeCost,
	merchantCombat,
	merchantLevel,
	reconcileCharacter,
	merchantUpgradeCost,
	sellPayout,
	startingResources,
	totalStatPoints,
	subtractBundle,
	tileCostAsResources,
} from '@/utils/gameUtils';
import { rollBiome } from '@/utils/biomeRules';
import { type ChestLoot } from '@/lib/chests';
import { createClickLimiter } from '@/lib/clickLimiter';
import { autoBattleUnlocked, manaRegenPerSec, maxHp, maxMana, regen } from '@/lib/combat';
import { writeCursor } from '@/lib/combatCursor';
import { emitCombat } from '@/lib/combatFx';
import type { SkillId } from '@/catalog/skills';
import type { LimitContext } from '@/lib/limits';
import { generateMerchantStock, refreshCost, rotationRng, shopPriceOf, stockDue } from '@/lib/merchant';
import { emitSaveEvent, withSaveEvents } from '@/lib/saveEvents';
import { gearEconomy, gearIncomePct, xpGainPct } from '@/lib/gearEconomy';
import { addDrop, aggregateStats, averageItemLevel, equipFromBag, gearOf, moveSlot, organizeBag, removeFromBag, slotQty, stackOf, starterBag, unequip } from '@/lib/inventory';
import { plainItem, sellValueOf } from '@/lib/itemInstance';
import { castleLevelOf } from '@/lib/castleWard';
import { applyOfflineGrant } from '@/lib/offline/apply';
import { reconcileTickets } from '@/lib/offline/reconcile';
import type { CombatView, FightEvent } from '@/lib/offline/fightTypes';
import type { ChestReward, ClaimResult, FightReply, Inventory, InventoryOp, InventoryReply, SyncResult } from '@/lib/offline/types';
import { newClaimId } from '@/lib/offlineClient';
import { provideInvVer, requestAuto, requestChest, requestDismiss, requestInventory, requestUse, type Reply } from '@/lib/rewardsClient';
import { signalNeedClaim, signalSyncNow } from '@/lib/serverSession';
import { useUiStore } from '@/stores/uiStore';
import { useRewardPendingStore } from '@/stores/rewardPendingStore';
import { isAutoSold } from '@/lib/loot';
import { advanceMonsters, monsterAt, monsterDef } from '@/lib/monsters';
import { ITEM_CATALOG, RARITIES, STARTER_EQUIPMENT } from '@/config/itemCatalog';
import { markSaveReady, PERSIST_NAME, PERSIST_VERSION, saveStorage } from '@/lib/saveStorage';
import { pickPersisted, type PersistedGame } from '@/lib/sanitizeSave';
import type {
	BiomeType,
	CharacterStats,
	ClickInput,
	CombatClientState,
	CombatNotice,
	Equipment,
	EquipmentSlot,
	GameState,
	MerchantStock,
	Monster,
	PrestigeState,
	Resources,
} from '@/types/game';
import { MAX_OWNED_TILES, getTile, hasOwnedNeighbour, inRange, isOwnedAt, ownedCount, setTile, type World } from '@/utils/world';


/** What can raise a limit (see config/limits.ts): the merchant bonuses and the rebirth state. */
/** The income rates for the state with this gear on (a set bonus can add income). */
const ratesWithGear = (
	state: Pick<GameState, 'tiles' | 'characterStats' | 'farmLevels' | 'prestige' | 'farmUpgrades' | 'merchantUpgrades'>,
	equipment: Equipment
) => calculateResourceRates(state.tiles, state.characterStats, state.farmLevels, state.prestige, state.farmUpgrades, state.merchantUpgrades, gearIncomePct(equipment));

const limitCtx = (state: Pick<GameState, 'merchantUpgrades' | 'prestige'>): LimitContext => ({ merchantUpgrades: state.merchantUpgrades, prestige: state.prestige });

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

/** A tiny seeded generator: the server and the first client render must start from the same world. */
const seededRandom = (seed: number) => () => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** What the browser knows about combat before the server has said anything: no fight, auto-battle off and auto-use on (the server's own defaults). */
const initialCombat = (): CombatClientState => ({
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
});

/** All game data of a brand-new game (no actions). */
const createInitialData = (prestige: PrestigeState = EMPTY_PRESTIGE, random: () => number = Math.random) => {
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
	/** Charge, claim the tile, award XP. */
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
			state.farmUpgrades,
			state.merchantUpgrades,
			gearIncomePct(state.equipment)
		);

		const xpGain =
			calculateXpGain(owned + 1) * (1 + xpGainPct(state.characterStats, state.equipment) / 100);
		const resources = subtractBundle(state.resources, bundle);
		resources.xp = Math.min(resources.xp + xpGain, XP_CAP);

		set({
			tiles: newTiles,
			resources,
			resourceRates: newRates,
		});
		return true;
	};

	// ---- the player's things are the server's -------------------------------------------------------------------------
	// The bag, the worn gear, the loot pity and the auto-sell filter belong to the server's ledger (docs/11-server-authority.md): drops, drunk
	// potions and chest items already happened there, and the player's own changes are asked of it (`/api/inventory`). The browser previews
	// each change at once and the server's answer, which carries the inventory as it stands, settles it. Changes are sent one at a time, in
	// order (a bag index means the bag as the previous change left it), and while any is on its way a picture from another answer is not taken.
	let invOpsInFlight = 0;
	let invQueue: Promise<void> = Promise.resolve();
	let invGen = 0; // a New Game starts the changes over: an answer that belongs to the game before it is dropped

	/** Takes the server's picture of the player's things, unless it is older than the one held or one of our own changes is still on its way. */
	const applyInventory = (inv: Inventory | undefined) => {
		if (!inv || invOpsInFlight > 0) return;
		const state = get();
		if (state.invVer !== null && inv.ver <= state.invVer) return;
		set({
			bag: inv.bag,
			equipment: inv.equipment,
			lootPity: inv.lootPity,
			autoSellUpTo: inv.autoSellUpTo,
			invVer: inv.ver,
			// a set bonus can change the income: the rates follow the gear
			resourceRates: ratesWithGear(state, inv.equipment),
			playerHp: Math.min(state.playerHp, maxHp(state.characterStats, inv.equipment)),
			playerMp: Math.min(state.playerMp, maxMana(state.characterStats, inv.equipment)),
		});
	};

	/**
	 * Asks the server to make one of the player's changes. `settle` runs with the answer (null: it never came) before the server's picture is
	 * taken, to put right what the preview got wrong (the gold of a sale, the price of a purchase the server refused).
	 */
	const sendInventoryOp = (op: InventoryOp, settle?: (reply: InventoryReply | null) => void) => {
		invOpsInFlight++;
		const gen = invGen;
		invQueue = invQueue.then(async () => {
			if (gen !== invGen) return;
			const key = newClaimId();
			let reply = await requestInventory(key, op);
			if (gen !== invGen) return;
			if (reply.status === 'unavailable') reply = await requestInventory(key, op);
			if (gen !== invGen) return;
			invOpsInFlight--;
			if (reply.status === 'ok') {
				settle?.(reply.value);
				if (!reply.value.ok) toast('The server did not do that: it is undone.');
				applyInventory(reply.value.inv);
				return;
			}
			settle?.(null);
			// the preview cannot be trusted any more: forget the version and ask for the real picture
			set({ invVer: null });
			if (reply.status === 'need_claim') signalNeedClaim();
			else {
				toast('Could not reach the server: the change is undone.');
				signalSyncNow();
			}
		});
	};

	/** Corrects the gold by what the server says a sale paid against what the preview paid (all of it back when the sale did not happen). */
	const settleSale = (previewGold: number) => (reply: InventoryReply | null) => {
		const delta = (reply?.ok ? reply.gold : 0) - previewGold;
		if (delta !== 0) set((state) => ({ resources: { ...state.resources, gold: Math.min(Math.max(0, state.resources.gold + delta), RESOURCE_CAP) } }));
	};

	/** Gives the price back when the server did not put the purchase in the bag. */
	const settlePurchase = (price: number, undo?: () => void) => (reply: InventoryReply | null) => {
		if (reply?.ok) return;
		set((state) => ({ resources: { ...state.resources, gold: Math.min(state.resources.gold + price, RESOURCE_CAP) } }));
		undo?.();
	};

	provideInvVer(() => get().invVer);

	/** Puts a chest's item and the gold the server paid for what did not fit (see ChestReward.received). */
	type ChestReceived = NonNullable<Extract<ChestReward, { ok: true }>['received']>;

	/** Puts what a chest held into the game: resources, XP, an item (through the auto-sell filter and the full-bag rule), and the server's gem balance when it gave one. */
	const receiveChest = (loot: ChestLoot, gemsTotal?: number, gemsFound = 0, received?: ChestReceived) => {
		const state = get();
		const resources = { ...state.resources };
		if (loot.kind === 'gold' || loot.kind === 'boost') resources.gold += loot.gold;
		else if (loot.kind === 'bundle') loot.items.forEach((i) => (resources[i.resource] += i.amount));
		else if (loot.kind === 'xp') resources.xp = Math.min(resources.xp + loot.xp, XP_CAP);
		else if (received) {
			// the server has put the item in its bag (the picture comes with the answer); the gold of what it sold or could not fit is ours
			resources.gold = Math.min(resources.gold + received.convertedGold + received.autoSold.gold, RESOURCE_CAP);
		}
		set({ resources, ...(gemsTotal !== undefined ? { gems: gemsTotal } : {}), lastChestLoot: gemsFound > 0 ? { ...loot, gems: gemsFound } : loot });
	};

	/** Puts a chest back on its tile (the server could not be reached, so nothing was opened). */
	const restoreChest = (x: number, y: number) => {
		const state = get();
		const tile = getTile(state.tiles, x, y);
		if (!tile || tile.hasChest) return;
		set({ tiles: setTile(state.tiles, x, y, { ...tile, hasChest: true }), activeChests: state.activeChests + 1 });
	};

	const toast = (text: string) => useUiStore.getState().showToast(text);

	// Chest opens and the polls that follow them cross on the way. An answer the server made BEFORE it opened our chest still counts that
	// chest, and the map would put it back ("missing") a moment after the player opened it. So a chest is only placed from an answer that is
	// not older than our own opens: none of them is still in flight, and the server's `opened` count (how many chests the run has opened
	// when it made the answer) has reached the last one we were told about. Taking extra chests off is always fine.
	let chestOpensInFlight = 0;
	let lastOwnOpen = { opened: 0, at: 0 };
	const OWN_OPEN_WINDOW_MS = 15_000; // an older answer than this cannot still be on its way (and a rebirth starts the count again)
	const chestsMayBePlaced = (tickets: SyncResult['tickets']): boolean => {
		if (chestOpensInFlight > 0) return false;
		const recent = Date.now() - lastOwnOpen.at < OWN_OPEN_WINDOW_MS;
		return !(recent && tickets.opened !== undefined && tickets.opened < lastOwnOpen.opened);
	};

	/** Opens a chest on the server (one try, one more with the same key if the answer got lost: the server replays it). */
	const openChestRemote = async (x: number, y: number) => {
		const key = newClaimId();
		chestOpensInFlight++;
		useRewardPendingStore.getState().begin(); // the little chest animation covers the wait for the loot
		let reply: Reply<ChestReward>;
		try {
			reply = await requestChest(key, x, y);
			if (reply.status === 'unavailable') reply = await requestChest(key, x, y);
		} finally {
			chestOpensInFlight--;
			useRewardPendingStore.getState().end();
		}
		if (reply.status === 'ok') {
			applyInventory(reply.value.inv);
			if (reply.value.ok) {
				lastOwnOpen = { opened: Math.max(lastOwnOpen.opened, reply.value.tickets.opened ?? 0), at: Date.now() };
				receiveChest(reply.value.loot, reply.value.gemsTotal, reply.value.gems, reply.value.received);
			} else toast('The chest crumbled: it was not a real one.');
			return;
		}
		restoreChest(x, y);
		if (reply.status === 'need_claim') {
			signalNeedClaim();
			toast('Catching up with the server, try again in a moment.');
		} else if (reply.status === 'no_save') {
			// the server has no readable save of this player yet (an older save, or the first upload is still on its way)
			toast('Your progress is still being saved to the server: the chest is still there, try again in a moment.');
		} else toast('Could not reach the server: the chest is still there.');
	};

	let noticeId = 1;
	const tauntOf = (type: Monster['type']): string | null => {
		const taunts = monsterDef(type).taunts;
		return taunts && taunts.length > 0 ? taunts[Math.floor(Math.random() * taunts.length)] : null;
	};

	/** Shows what the server says happened in a fight, with the numbers flying in the order (and roughly the rhythm) they happened. */
	const playFx = (events: FightEvent[]) => {
		const recent = events.filter((e) => ['hit', 'crit', 'super', 'hurt', 'heal', 'potion', 'stun', 'resist'].includes(e.kind));
		const first = recent[0]?.t ?? 0;
		for (const e of recent.slice(-24)) {
			const delay = Math.min(2500, Math.max(0, (e.t - first) * 1000));
			const fx = () => {
				if (e.kind === 'hit' || e.kind === 'crit' || e.kind === 'super') emitCombat({ kind: 'hit', damage: e.amount ?? 0, killed: false, crit: e.kind === 'hit' ? 'none' : e.kind });
				else if (e.kind === 'hurt') emitCombat({ kind: 'hurt', amount: e.amount ?? 0, crit: e.crit });
				else if (e.kind === 'heal' || e.kind === 'potion') emitCombat({ kind: 'heal', amount: e.amount ?? 0 });
				else if (e.kind === 'stun') emitCombat({ kind: 'stun', sec: e.amount ?? 0 });
				else if (e.kind === 'resist') emitCombat({ kind: 'resist' });
			};
			if (delay === 0) fx();
			else setTimeout(fx, delay);
		}
	};

	/**
	 * Takes the server's picture of the player's combat: HP, mana, cooldowns, the open fight and the switches replace what was shown, and
	 * every event the browser has not applied yet is applied once (a potion leaves the bag, a kill's loot goes in, a defeat is announced).
	 * An answer older than one already applied is ignored.
	 */
	const applyCombatView = (view: CombatView, gemsTotal?: number) => {
		const state = get();
		if (view.at < state.combat.at) return;
		// the log numbers start again with a new run (a rebirth): a server log that is behind the browser's cursor is a new one
		const seen = state.combat.eventNo === null ? null : view.eventNo >= state.combat.eventNo ? state.combat.eventNo : 0;
		const fresh = seen === null ? [] : view.events.filter((e) => e.no > seen);
		let notice: CombatNotice | null = state.combat.notice;
		const resources = { ...state.resources };
		for (const e of fresh) {
			if (e.kind === 'won' && e.reward && e.type) {
				// the server has put the drops where they go (the bag comes with the answer as `inv`); the gold of what it sold or could not fit is ours
				const received = { stored: e.reward.stored ?? e.reward.items, convertedGold: e.reward.convertedGold ?? 0, autoSold: e.reward.autoSold ?? { count: 0, gold: 0 } };
				resources.gold = Math.min(resources.gold + e.reward.gold + received.convertedGold + received.autoSold.gold, RESOURCE_CAP);
				resources.xp = Math.min(resources.xp + e.reward.xp, XP_CAP);
				resources.hide = Math.min(resources.hide + (e.reward.hide ?? 0), RESOURCE_CAP);
				notice = {
					id: noticeId++,
					kind: 'won',
					type: e.type,
					level: e.level ?? 1,
					summary: { gold: e.reward.gold, xp: e.reward.xp, hide: e.reward.hide, items: received.stored, convertedGold: received.convertedGold, autoSold: received.autoSold, lucky: e.reward.lucky },
					taunt: null,
				};
			} else if ((e.kind === 'defeated' || e.kind === 'timeout') && e.type) {
				notice = { id: noticeId++, kind: e.kind, type: e.type, level: e.level ?? 1, summary: null, taunt: tauntOf(e.type) };
			} else if (e.kind === 'retreat') {
				// a fled fight has no result of its own, and the one from before must not come back in its place
				notice = null;
			}
		}
		set({
			resources,
			playerHp: view.hp,
			playerMp: view.mp,
			...(gemsTotal !== undefined ? { gems: gemsTotal } : {}),
			combat: {
				fight: view.fight,
				autoBattle: view.autoBattle,
				autoUse: view.autoUse,
				cd: view.cd,
				maxHp: view.maxHp,
				maxMp: view.maxMp,
				retrySec: view.retrySec,
				autoNote: view.autoNote ?? null,
				at: view.at,
				eventNo: view.eventNo,
				notice,
				// a click waits for the server's answer; once a fight is open (or the answer came) it is over
				pending: view.fight ? null : state.combat.pending,
			},
		});
		writeCursor(view.eventNo);
		playFx(fresh);
	};

	/** The map as the server's tickets say: monsters where it put them, as many chests as it counts. */
	const reconcileMap = (tickets: SyncResult['tickets'], serverNowSec: number) => {
		const state = get();
		const map = reconcileTickets(
			{ tiles: state.tiles, monsters: state.monsters, activeChests: state.activeChests },
			tickets,
			serverNowSec,
			limitCtx(state),
			{ placeChests: chestsMayBePlaced(tickets) }
		);
		set({ tiles: map.tiles, monsters: map.monsters, activeChests: map.activeChests });
		return map;
	};

	const sinceNow = () => get().combat.eventNo ?? undefined;

	/** What to do with the answer to a combat request: apply it, or say why nothing happened. */
	const settleFight = (reply: Reply<FightReply>, refused?: string) => {
		if (reply.status === 'ok') {
			applyInventory(reply.value.inv);
			applyCombatView(reply.value.combat, reply.value.gemsTotal);
			reconcileMap(reply.value.tickets, reply.value.serverNowSec);
			if (!reply.value.accepted && refused) toast(refused);
			return;
		}
		if (reply.status === 'need_claim') signalNeedClaim();
		toast('Could not reach the server.');
	};

	const slice = {
		// A fixed placeholder world: it is rendered on the server and before the save is read, so it must not be
		// random (that broke hydration). `merge` below replaces it with a random one for a player without a save.
		...createInitialData(EMPTY_PRESTIGE, seededRandom(1)),

		resetGame: () => {
			clickLimiter.reset();
			invGen++;
			invOpsInFlight = 0;
			invQueue = Promise.resolve();
			lastOwnOpen = { opened: 0, at: 0 }; // a new run counts its chests from zero
			set({ ...createInitialData(), isHydrated: true });
		},

		// Rebirth: restart with the Ember bonus. Keeps name, class, play time, all Embers and the character (XP, level, attributes).
		rebirth: () => {
			const state = get();
			const status = rebirthStatus(state);
			if (!status.canRebirth) return false;
			const gain = status.gain;

			const prestige: PrestigeState = {
				...state.prestige,
				rebirths: state.prestige.rebirths + 1,
				legacyPoints: state.prestige.legacyPoints + gain,
				legacyEarned: state.prestige.legacyEarned + gain,
			};
			clickLimiter.reset();
			lastOwnOpen = { opened: 0, at: 0 }; // a new run counts its chests from zero
			const fresh = createInitialData(prestige);
			// settle the level first: XP bought a moment ago may not have been counted by a tick yet (its points are credited here)
			const settled = calculateLevel(state.resources.xp);
			const characterStats = {
				...state.characterStats,
				availablePoints: state.characterStats.availablePoints + Math.max(0, totalStatPoints(settled.level) - totalStatPoints(state.level.level)),
			};
			// the bag survives, so does the room Pack Rat made for it; the other merchant bonuses start again
			const merchantUpgrades: Record<string, number> = state.merchantUpgrades.packrat ? { packrat: state.merchantUpgrades.packrat } : {};
			set({
				...fresh,
				// the character is progression too: lifetime XP, the level it gives and the attributes (with the points still to spend) carry
				// over, because the level curve is paced over rebirths (level 80 around the 3rd, 100 around the 10th); the income follows the attributes
				resources: { ...fresh.resources, xp: state.resources.xp },
				level: settled,
				previousLevel: settled.level,
				characterStats,
				resourceRates: calculateResourceRates(fresh.tiles, characterStats, fresh.farmLevels, prestige, fresh.farmUpgrades, merchantUpgrades, gearIncomePct(state.equipment)),
				// gear is character progression: it survives a rebirth (HP is refilled)
				equipment: state.equipment,
				bag: state.bag,
				gems: state.gems, // the premium currency survives a rebirth
				lootPity: state.lootPity,
				autoSellUpTo: state.autoSellUpTo,
				merchantUpgrades,
				playerHp: maxHp(characterStats, state.equipment),
				playerMp: maxMana(characterStats, state.equipment),
				playerName: state.playerName,
				playerClass: state.playerClass,
				playSeconds: state.playSeconds,
				isHydrated: true,
			});
			return true;
		},

		// Spend Embers on a permanent shop upgrade
		buyEmberUpgrade: (id: EmberUpgradeId) => {
			const state = get();
			const def = EMBER_UPGRADES[id];
			if (!def) return false;
			const level = state.prestige.upgrades[id] ?? 0;
			if (level >= def.maxLevel) return false;
			const cost = emberUpgradeCost(id, level);
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
				state.farmUpgrades,
				state.merchantUpgrades,
				gearIncomePct(state.equipment)
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
				farmUpgrades,
				state.merchantUpgrades,
				gearIncomePct(state.equipment)
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
				state.farmUpgrades,
				state.merchantUpgrades,
				gearIncomePct(state.equipment)
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
				state.farmUpgrades,
				state.merchantUpgrades,
				gearIncomePct(state.equipment)
			);

			set({
				tiles: updatedTiles,
				resources: subtractBundle(state.resources, cost),
				resourceRates: newRates,
			});
			return true;
		},

		// Collect a chest: the chest leaves the map at once and what was inside is rolled by the server (sealed on the number of chests
		// opened this run, so reloading cannot roll it twice): gold (passive gold/s x random minutes), a bundle of resources, XP or a gear
		// piece - see src/lib/chests.ts. Luck improves the odds and the gold.
		collectChest: (x: number, y: number) => {
			const state = get();
			const tile = getTile(state.tiles, x, y);
			if (!tile || !tile.hasChest) return false;
			set({ tiles: setTile(state.tiles, x, y, { ...tile, hasChest: false }), activeChests: Math.max(0, state.activeChests - 1) });
			void openChestRemote(x, y);
			return true;
		},

		// Gold for a click on the map: gold/s x click power. Rate limited (see lib/clickLimiter).
		clickForGold: (input: ClickInput) => {
			if (!clickLimiter.take(input)) return 0;
			const state = get();
			const power =
				(CLICK_LADDER[state.clickLevel]?.power ?? CLICK_LADDER[0].power) *
				(1 + emberEffect(state.prestige, 'mastery')) *
				(1 + gearEconomy(state.equipment).clickPct / 100);
			const gold = state.resourceRates.total.gold * power;
			if (!(gold > 0)) return 0;
			set({
				resources: { ...state.resources, gold: state.resources.gold + gold },
			});
			return gold;
		},

		// Combat is the server's: it engages the monsters, swings both ways at each side's attack speed and pays the kills (src/lib/offline/fight.ts).
		// Nothing here hits anything. These are the few things a player may still ask for - a hotkey, a switch, a dismissal - and each is sent
		// to the server, whose answer (not a guess made here) changes the picture.
		requestPotion: (id: string) => {
			if (!ITEM_CATALOG[id]?.consumable?.healHp) return false;
			void requestUse(newClaimId(), { kind: 'potion', id }, sinceNow()).then((reply) => settleFight(reply, 'No potion was drunk.'));
			return true;
		},

		requestSkill: (id: SkillId) => {
			void requestUse(newClaimId(), { kind: 'skill', id }, sinceNow()).then((reply) => settleFight(reply, 'The skill is not ready.'));
			return true;
		},

		// A click on a monster: the server opens the fight against it (auto-battle on or off) and swings both ways from then on.
		startFight: (id: number) => {
			const state = get();
			const monster = state.monsters.find((m) => m.id === id);
			if (!monster?.ticket || state.combat.fight || state.combat.pending || state.combat.maxHp <= 0) return false;
			// the window opens at once (maximized, loading) instead of after the server's answer; the answer fills it in or closes it
			useUiStore.getState().setPref('combatMinimized', false);
			set({ combat: { ...state.combat, pending: { type: monster.type, level: monster.level } } });
			const settled = () => set((s) => (s.combat.pending ? { combat: { ...s.combat, pending: null } } : {}));
			const giveUp = setTimeout(settled, 10_000);
			void requestUse(newClaimId(), { kind: 'fight', n: monster.ticket }, sinceNow()).then((reply) => {
				clearTimeout(giveUp);
				settleFight(reply, 'The fight could not start.');
				settled();
				signalSyncNow();
			});
			return true;
		},

		// Auto-battle (the server picks the next monster itself, one after the other; off by default, a click always starts a fight) and
		// auto-use (it drinks, heals and stuns for you with fixed rules; on by default)
		setAutoBattle: (on: boolean) => {
			if (on && !autoBattleUnlocked(get().prestige.rebirths)) {
				toast('Auto-battle unlocks after your first rebirth.');
				return;
			}
			set((state) => ({ combat: { ...state.combat, autoBattle: on } }));
			void requestAuto({ autoBattle: on }, sinceNow()).then((reply) => {
				settleFight(reply);
				if (on) signalSyncNow();
			});
		},

		// Flee: the server ends the fight as a retreat (no reward, no penalty, the monster stays full), which is what switching auto-battle
		// off does; with it on the next fight would start at once, so fleeing turns it off. The window closes at once, the answer confirms.
		flee: () => {
			if (!get().combat.fight) return;
			set((state) => ({ combat: { ...state.combat, fight: null, pending: null, notice: null, autoBattle: false } }));
			void requestAuto({ autoBattle: false }, sinceNow()).then((reply) => settleFight(reply));
		},

		setAutoUse: (on: boolean) => {
			set((state) => ({ combat: { ...state.combat, autoUse: on } }));
			void requestAuto({ autoUse: on }, sinceNow()).then((reply) => settleFight(reply));
		},

		// The server kept less XP than the game held (see cloudSave/xpModel.ts): XP, the level it gives and the attribute points follow
		applyServerXp: (xp: number) => {
			const state = get();
			if (!Number.isFinite(xp) || xp < 0 || xp >= state.resources.xp) return;
			const level = calculateLevel(xp);
			const characterStats = reconcileCharacter(state.characterStats, xp);
			set({
				resources: { ...state.resources, xp },
				level,
				previousLevel: level.level,
				characterStats,
				resourceRates: calculateResourceRates(state.tiles, characterStats, state.farmLevels, state.prestige, state.farmUpgrades, state.merchantUpgrades, gearIncomePct(state.equipment)),
			});
		},

		// The server's picture of combat arrived with a sync (polling, a hotkey): see applyCombatView
		applyFightReply: (reply: FightReply) => {
			applyInventory(reply.inv);
			applyCombatView(reply.combat, reply.gemsTotal);
			reconcileMap(reply.tickets, reply.serverNowSec);
		},

		// The win or defeat notice has been read
		clearCombatNotice: () => set((state) => (state.combat.notice ? { combat: { ...state.combat, notice: null } } : {})),

		// Takes a monster off the map without a fight or loot (for a rat too strong to beat); ends the fight against it
		dismissMonster: (id: number) => {
			const monster = get().monsters.find((m) => m.id === id);
			if (!monster) return false;
			set((state) => ({ monsters: state.monsters.filter((m) => m.id !== id) }));
			if (monster.ticket !== undefined) void requestDismiss(newClaimId(), monster.ticket, sinceNow()).then((reply) => settleFight(reply));
			return true;
		},

		// Gear actions: refused while a fight is open; max HP can drop when gear comes off, so playerHp follows it down
		equipItem: (bagIndex: number) => {
			const state = get();
			if (state.combat.fight) return false;
			const result = equipFromBag(state.bag, state.equipment, bagIndex);
			if (!result) return false;
			sendInventoryOp({ action: 'equip', index: bagIndex });
			set({
				bag: result.bag,
				equipment: result.equipment,
				// a set bonus can change the income: the rates follow the gear
				resourceRates: ratesWithGear(state, result.equipment),
				playerHp: Math.min(state.playerHp, maxHp(state.characterStats, result.equipment)),
				playerMp: Math.min(state.playerMp, maxMana(state.characterStats, result.equipment)),
			});
			return true;
		},

		unequipItem: (slot: EquipmentSlot) => {
			const state = get();
			if (state.combat.fight) return false;
			const result = unequip(state.bag, state.equipment, slot);
			if (!result) return false;
			sendInventoryOp({ action: 'unequip', slot });
			set({
				bag: result.bag,
				equipment: result.equipment,
				// a set bonus can change the income: the rates follow the gear
				resourceRates: ratesWithGear(state, result.equipment),
				playerHp: Math.min(state.playerHp, maxHp(state.characterStats, result.equipment)),
				playerMp: Math.min(state.playerMp, maxMana(state.characterStats, result.equipment)),
			});
			return true;
		},

		moveBagItem: (from: number, to: number) => {
			const state = get();
			if (state.combat.fight || from === to) return false;
			const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < state.bag.length;
			if (!inRange(from) || !inRange(to)) return false;
			sendInventoryOp({ action: 'move', from, to });
			set({ bag: moveSlot(state.bag, from, to) });
			return true;
		},

		// Tidy the bag from the left (stacks merged, gear sorted); like every bag action, not while a fight is open
		organizeBag: () => {
			const state = get();
			if (state.combat.fight) return false;
			sendInventoryOp({ action: 'organize' });
			set({ bag: organizeBag(state.bag) });
			return true;
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
				state.resourceRates.total.xp * (1 + xpGainPct(state.characterStats, state.equipment) / 100);
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
							state.farmUpgrades,
							state.merchantUpgrades,
							gearIncomePct(state.equipment)
						);
					}
					newCastleUpgrade = null;
				} else {
					newCastleUpgrade = { ...newCastleUpgrade, remainingSec: remaining };
				}
			}

			// Chests and monsters come from the server (see applyServerTickets); between its answers the monsters on the map just age
			const newMonsters = state.monsters.length > 0 ? advanceMonsters(state.monsters, secondsElapsed, limitCtx(state)) : state.monsters;

			// HP and mana: the server's numbers arrive with every answer; in between they keep filling the way the server will count them
			// (in a fight the server's picture is the only one, so HP is left alone and only the cooldowns and the stun run down)
			const playerMaxHp = maxHp(state.characterStats, state.equipment);
			const inFight = state.combat.fight !== null;
			const newPlayerHp = Math.min(playerMaxHp, inFight ? state.playerHp : regen(state.playerHp, playerMaxHp, secondsElapsed, aggregateStats(state.equipment).regen + merchantCombat(state.merchantUpgrades).regen));
			const newPlayerMp = Math.min(maxMana(state.characterStats, state.equipment), state.playerMp + manaRegenPerSec(state.characterStats, state.equipment) * secondsElapsed);
			const cd = state.combat.cd;
			const cooling = cd.heal > 0 || cd.stun > 0 || cd.potion > 0 || (state.combat.fight?.stunLeft ?? 0) > 0;
			const newCombat = cooling
				? {
						...state.combat,
						cd: { heal: Math.max(0, cd.heal - secondsElapsed), stun: Math.max(0, cd.stun - secondsElapsed), potion: Math.max(0, cd.potion - secondsElapsed) },
						fight: state.combat.fight ? { ...state.combat.fight, stunLeft: Math.max(0, state.combat.fight.stunLeft - secondsElapsed) } : null,
					}
				: state.combat;

			const newPlaySeconds = state.playSeconds + secondsElapsed;

			// Level and stat points
			const { level, progress } = calculateLevel(newResources.xp);
			const castleFinished = !!state.castleUpgrade && !newCastleUpgrade;
			const newCharacterStats = { ...state.characterStats };
			if (level > state.level.level) {
				newCharacterStats.availablePoints += totalStatPoints(level) - totalStatPoints(state.level.level);
			}

			set({
				resources: newResources,
				resourceRates: newRates,
				level: { level, progress },
				previousLevel: state.level.level,
				characterStats: newCharacterStats,
				tiles: newTiles,
				castleUpgrade: newCastleUpgrade,
				monsters: newMonsters,
				combat: newCombat,
				playerHp: newPlayerHp,
				playerMp: newPlayerMp,
				merchantStock: stockDue(state.merchantStock, newPlaySeconds, limitCtx(state)) ? generateMerchantStock(castleLevelOf(state.tiles), averageItemLevel(state.equipment), rotationRng(newPlaySeconds), newPlaySeconds, limitCtx(state)) : state.merchantStock,
				playSeconds: newPlaySeconds,
			});
			if (castleFinished) emitSaveEvent('castleUpgraded');
			if (level > state.level.level) emitSaveEvent('levelUp');
		},

		// The server's view of what has appeared and of the player's combat (see /api/spawn): the map is brought in line, the gem balance and HP are the server's
		applyServerTickets: (sync: SyncResult) => {
			applyInventory(sync.inv);
			applyCombatView(sync.combat, sync.gemsTotal);
			return reconcileMap(sync.tickets, sync.serverNowSec).placed;
		},

		// Applies the server's answer to a login: what the absence paid, then the chests and monsters it made appear
		applyOfflineClaim: (result: ClaimResult) => {
			const state = get();
			let patch: Partial<GameState> = {};
			let levelsGained = 0;
			let castleReached: number | null = null;
			if (result.grant) {
				const applied = applyOfflineGrant(state, result.grant, limitCtx(state));
				patch = applied.patch;
				levelsGained = applied.summary.levelsGained;
				castleReached = applied.summary.castleReached;
			}
			const after = { ...state, ...patch } as GameState;
			const map = reconcileTickets(
				{ tiles: after.tiles, monsters: after.monsters, activeChests: after.activeChests },
				result.tickets,
				result.serverNowSec,
				limitCtx(state)
			);
			set({ ...patch, tiles: map.tiles, monsters: map.monsters, activeChests: map.activeChests, gems: result.gems });
			emitSaveEvent('offlineClaimed');
			if (!result.grant) return null;
			return {
				grant: result.grant,
				levelsGained,
				castleReached,
				chestsPlaced: map.placed.chests,
				monstersPlaced: map.placed.monsters,
				strongestMonster: map.placed.strongestLevel,
				gems: result.gems,
			};
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
			const goldGained = sellPayout(price, amount, state);

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
			if (state.combat.fight) return 0;
			const slot = Number.isInteger(bagIndex) ? state.bag[bagIndex] : null;
			if (!slot) return 0;
			const gear = gearOf(slot);
			const stack = stackOf(slot);
			const unit = gear ? sellValueOf(gear) : stack ? (ITEM_CATALOG[stack.id]?.sellValue ?? 0) : 0;
			if (!unit) return 0;
			const amount = qty === undefined ? 1 : Math.floor(qty);
			if (!(amount >= 1) || amount > slotQty(slot)) return 0;
			const gold = sellPayout(unit, amount, state);
			sendInventoryOp({ action: 'sell', index: bagIndex, qty: amount }, settleSale(gold));
			set({
				bag: removeFromBag(state.bag, bagIndex, amount),
				resources: { ...state.resources, gold: Math.min(state.resources.gold + gold, RESOURCE_CAP) },
			});
			return gold;
		},

		// Throw bag items away for good (no gold); `qty` defaults to one, pass the stack size to clear the slot
		discardItem: (bagIndex: number, qty?: number) => {
			const state = get();
			if (state.combat.fight) return false;
			const slot = Number.isInteger(bagIndex) ? state.bag[bagIndex] : null;
			if (!slot) return false;
			const amount = qty === undefined ? 1 : Math.floor(qty);
			if (!(amount >= 1) || amount > slotQty(slot)) return false;
			sendInventoryOp({ action: 'discard', index: bagIndex, qty: amount });
			set({ bag: removeFromBag(state.bag, bagIndex, amount) });
			return true;
		},

		// Sell every bag item of this rarity or lower that is gear (potions and stacks stay)
		sellJunk: (maxRarity: string) => {
			const state = get();
			if (state.combat.fight) return { gold: 0, count: 0 };
			if (!Object.prototype.hasOwnProperty.call(RARITIES, maxRarity)) return { gold: 0, count: 0 };
			let bag = state.bag;
			let gold = 0;
			let count = 0;
			bag.forEach((slot, index) => {
				const item = gearOf(slot);
				if (!item || !isAutoSold(item, maxRarity)) return;
				gold += sellPayout(sellValueOf(item), 1, state);
				count += 1;
				bag = removeFromBag(bag, index, 1);
			});
			if (count === 0) return { gold: 0, count: 0 };
			sendInventoryOp({ action: 'sellJunk', maxRarity }, settleSale(gold));
			set({ bag, resources: { ...state.resources, gold: Math.min(state.resources.gold + gold, RESOURCE_CAP) } });
			return { gold, count };
		},

		// The auto-sell filter: gear of this rarity or lower is sold the moment it drops (null = keep everything)
		setAutoSell: (rarity: string | null) => {
			if (rarity !== null && !Object.prototype.hasOwnProperty.call(RARITIES, rarity)) return;
			sendInventoryOp({ action: 'autoSell', rarity });
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
			sendInventoryOp({ action: 'buyShop', id, qty }, settlePurchase(price));
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
			// the server did not put it in the bag: the offer is back on the shelf and the price is back in the purse
			sendInventoryOp(
				{ action: 'buyOffer', item },
				settlePurchase(price, () =>
					set((s) => (s.merchantStock ? { merchantStock: { ...s.merchantStock, offers: [...s.merchantStock.offers.slice(0, index), item, ...s.merchantStock.offers.slice(index)] } } : {}))
				)
			);
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
			const cost = refreshCost(state.merchantRefreshes, limitCtx(state));
			if (state.resources.gold < cost) return false;
			set({
				resources: { ...state.resources, gold: state.resources.gold - cost },
				merchantStock: generateMerchantStock(castle, averageItemLevel(state.equipment), Math.random, state.playSeconds, limitCtx(state)),
				merchantRefreshes: state.merchantRefreshes + 1,
			});
			emitSaveEvent('refreshMerchantStock');
			return true;
		},

		// One level of a merchant bonus (see MERCHANT_UPGRADES: economy, combat and the rebirth one), paid in gold
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
				// Foreman and Skinner change the income: the rates follow at once (the other bonuses do not touch them)
				...(id === 'foreman' || id === 'skinner'
					? { resourceRates: calculateResourceRates(state.tiles, state.characterStats, state.farmLevels, state.prestige, state.farmUpgrades, merchantUpgrades, gearIncomePct(state.equipment)) }
					: {}),
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
			const price = buyCost(resource as keyof typeof MERCHANT_RESOURCE_PRICES, units);
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
				saved.farmUpgrades,
				saved.merchantUpgrades,
				gearIncomePct(saved.equipment)
			);
			return {
				...current,
				...saved,
				// combat is the server's: it is asked again as soon as the game is up
				combat: initialCombat(),
				resourceRates: rates,
				isHydrated: true,
			};
		},
		// From here on changes are written (nothing is saved before the first load has finished)
		onRehydrateStorage: () => () => markSaveReady(),
	})
);
