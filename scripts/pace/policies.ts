/**
 * What the bots buy, one function per spending decision (the pace sim, `scripts/pace/run.ts`). Each takes the `Bot` (the run's state and the real store) and calls the store's own actions, exactly as a button would:
 * the Ember shop (`spendEmbers`, a plan per profile), the merchant's gold upgrades, the Gem shop (Builder #2), the castle, the buildings, click power, animals, farm upgrades, tiles and the sale of what is left over.
 * Rocks and fights are in `run.ts` because they take the clicks and the clock.
 *
 * @title The bot's spending
 * @category Pacing/The sim
 * @order 4
 */
import { ownedBounds, isOwnedAt, ownedRowMajor, tileAt } from '../../src/utils/world';
import { DAILY_BONUS_GEMS, GEM_SHOP } from '../../src/config/gemShop';
import { EMBER_UPGRADES, type EmberUpgradeId } from '../../src/config/rebirth';
import { MERCHANT_UPGRADES, type MerchantUpgradeId } from '../../src/config/merchant';
import { EMBER_PLANS, type Profile } from './profiles';
import type { GameConfig, GameUtils } from '../lib/loadGame';
import type { useGameStore } from '../../src/stores/gameStore';

export type Store = typeof useGameStore;
export type State = ReturnType<Store['getState']>;

/** What the bots build, in this order. The first affordable one whose biome the map has is built; once all stand, the bot levels the lowest one the castle allows. Wood and stone for the castle and tiles, then food, then coal. */
export const BUILD_ORDER = ['lumberyard', 'quarry', 'granary', 'coalpit', 'fishery', 'harbor', 'peatworks'];
/** The Idols (one per biome, level 1 only: their next levels need T3 materials the bots do not collect): built before the Extractors, once nothing is left to level */
export const IDOL_ORDER = [
	'idol_forest',
	'idol_swamp',
	'idol_tundra',
	'idol_lake',
	'idol_hills',
	'idol_plains',
	'idol_coast',
	'idol_jungle',
	'idol_fields',
	'idol_orchard',
	'idol_blight',
	'idol_battlefield',
];
/** The Extractors (T3 materials, nothing in the game spends them yet): built last, never levelled by the bot, so they only cost what a player who wants them would pay */
export const EXTRACTOR_ORDER = ['saptapper', 'herbgarden', 'deepmine', 'icecutter', 'pearldiver', 'saltworks', 'sporecellar'];
/** Tiles' worth of gold a bot keeps in hand when it builds */
export const BUILD_TILE_RESERVE = Number(process.env.PACE_BUILD_RESERVE ?? 20);
export const TILE_MARKS = [10, 16, 20, 25, 30, 35, 40, 50, 75, 100, 150, 200, 300, 400];
const WAIT_MARKS = [100, 150, 200, 300, 400];

/** The run's state as the policies see it: the store, the clock, the run number and the few things the bot remembers between decisions. */
export interface Bot {
	name: string;
	profile: Profile;
	cfg: GameConfig;
	utils: GameUtils;
	bld: typeof import('../../src/lib/buildings');
	store: Store;
	api: () => State;
	/** Game seconds */
	t: number;
	/** 1 = first run; after a rebirth 2, 3 ... */
	run: number;
	/** The castle level this run rebirths at (a player who rebirths at castle N does not start N+1) */
	castleCeiling: () => number;
	/** Record a milestone once per run (`rN.` prefix after the first rebirth) */
	mark: (key: string, t: number) => void;
	frontier: [number, number] | null;
	frontierDirty: boolean;
	/** Gems the daily bonus has paid (the Gem shop's balance lives on the server; the sim counts it) */
	gems: number;
	/** Builder #2 is owned (bought on day 0 or with the daily gems) */
	builder2: boolean;
	gemDay: number;
	gemStreak: number;
	gifts: { tile: boolean; castle: boolean; farm: boolean };
	tileWaits: Record<string, Record<string, number>>;
}

type Bundle = Partial<Record<string, number>>;

/** Buy missing resources from the merchant when the gold left over after paying `bundle` covers them. */
export const topUp = (b: Bot, bundle: Bundle): boolean => {
	const s = b.api();
	let goldNeeded = bundle.gold ?? 0;
	const buys: [keyof typeof s.resources, number][] = [];
	for (const [r, v] of Object.entries(bundle)) {
		if (r === 'gold' || r === 'xp') continue;
		const have = s.resources[r as keyof typeof s.resources];
		const deficit = Math.ceil((v ?? 0) - have);
		if (deficit > 0) {
			const price = (b.cfg.MERCHANT_RESOURCE_PRICES as Record<string, number>)[r];
			if (!price) return false;
			goldNeeded += Math.ceil(deficit * price * b.cfg.MERCHANT_BUY_MULTIPLIER);
			buys.push([r as keyof typeof s.resources, deficit]);
		}
	}
	if (goldNeeded > s.resources.gold) return false;
	buys.forEach(([r, n]) => b.api().buyResource(r, n));
	return true;
};

/**
 * The tutorial's starter bundles: the server pays each once per account, the bot receives them at the same events. The potions at the last step do not matter to the economy.
 */
export const gift = (
	b: Bot,
	which: 'tile' | 'castle' | 'farm',
	rewards: Record<'tile' | 'castle' | 'farm', { gold?: number; wood?: number; food?: number }>,
): void => {
	if (b.gifts[which]) return;
	b.gifts[which] = true;
	const bundle = rewards[which];
	b.store.setState((st) => ({
		resources: {
			...st.resources,
			gold: st.resources.gold + (bundle.gold ?? 0),
			wood: st.resources.wood + (bundle.wood ?? 0),
			food: st.resources.food + (bundle.food ?? 0),
		},
	}));
};

/**
 * The Ember shop: spend the Embers as they come. `starter` is Master Builders first and then Thrift, Click Mastery and Provisions level by level in step with Builders; any other plan is a strict priority list
 * ({@link EMBER_PLANS}): each upgrade is bought up to its maximum before the next one. An upgrade the plan cannot afford yet is waited for (the plan never skips ahead to a cheaper one).
 */
export const spendEmbers = (b: Bot): void => {
	const plan = b.profile.emberPlan ?? 'starter';
	for (let guard = 0; guard < 80; guard++) {
		const s = b.api();
		const level = (id: EmberUpgradeId) => s.prestige.upgrades[id] ?? 0;
		let target: EmberUpgradeId | undefined;
		if (plan === 'starter') {
			const order: EmberUpgradeId[] = ['builders', 'thrift', 'mastery', 'provisions'];
			target = order.find((id) => level(id) <= level('builders'));
		} else {
			target = EMBER_PLANS[plan].find((id) => level(id) < EMBER_UPGRADES[id].maxLevel);
		}
		if (!target || !b.api().buyEmberUpgrade(target)) break;
	}
};

/** The merchant's gold upgrades (the optimisers only): bought when the gold on hand is twice the price, so tiles and the castle keep their money. */
export const buyMerchantUpgrades = (b: Bot): void => {
	const order: MerchantUpgradeId[] = ['foreman', 'bulk', 'haggler', 'charm', 'skinner', 'packrat2'];
	for (let guard = 0; guard < 40; guard++) {
		const s = b.api();
		const target = order.find((id) => {
			const level = s.merchantUpgrades[id] ?? 0;
			const def = MERCHANT_UPGRADES[id];
			return level < def.maxLevel && s.resources.gold >= 2 * Math.ceil(def.baseCost * Math.pow(def.costGrowth, level));
		});
		if (!target || !b.api().buyMerchantUpgrade(target)) break;
	}
};

/** The price of Builder #2 in gems (the one Gem shop item that changes the pace) */
export const BUILDER2_PRICE = GEM_SHOP.find((i) => i.id === 'builder_2')?.price ?? 1000;

/**
 * The Gem shop. `day0`: Builder #2 is there from the start (the player paid for it). `daily`: the player claims the daily bonus the first time they play each game day (`DAILY_BONUS_GEMS`, seven days in a row)
 * and buys Builder #2 as soon as the gems cover its price. Gems and Builder #2 survive a rebirth.
 */
export const gemShop = (b: Bot, active: boolean): void => {
	if (b.profile.gems !== 'daily') return;
	const day = Math.floor(b.t / 86400);
	if (active && day >= b.gemDay) {
		b.gems += DAILY_BONUS_GEMS[b.gemStreak % DAILY_BONUS_GEMS.length];
		b.gemStreak++;
		b.gemDay = day + 1;
	}
	if (b.api().gemBuilders < 1 && b.gems >= BUILDER2_PRICE) {
		b.gems -= BUILDER2_PRICE;
		b.builder2 = true;
		b.store.setState({ gemBuilders: 1 });
		b.mark('builder2', b.t);
	}
};

const findFrontier = (b: Bot): [number, number] | null => {
	const { tiles } = b.api();
	let best: [number, number] | null = null;
	let bestD = Infinity;
	const bounds = ownedBounds(tiles);
	if (!bounds) return null;
	for (let y = bounds.minY - 1; y <= bounds.maxY + 1; y++) {
		for (let x = bounds.minX - 1; x <= bounds.maxX + 1; x++) {
			if (isOwnedAt(tiles, x, y)) continue;
			const adj = [
				[x - 1, y],
				[x + 1, y],
				[x, y - 1],
				[x, y + 1],
			].some(([ax, ay]) => isOwnedAt(tiles, ax, ay));
			if (!adj) continue;
			const d = Math.abs(x - b.cfg.CASTLE_X) + Math.abs(y - b.cfg.CASTLE_Y);
			if (d < bestD) {
				bestD = d;
				best = [x, y];
			}
		}
	}
	return best;
};

/** The castle: upgrade as soon as the level is allowed and the money is there (the merchant tops up what is short). */
export const castle = (b: Bot, rewards: Parameters<typeof gift>[2]): void => {
	const s = b.api();
	const c = tileAt(s.tiles, b.cfg.CASTLE_X, b.cfg.CASTLE_Y);
	if (!s.castleUpgrade && (c.level ?? 1) < b.castleCeiling() && c.upgradeCost) {
		topUp(b, c.upgradeCost as Bundle);
		if (b.api().upgradeCastle()) gift(b, 'castle', rewards);
	}
	b.mark(`castle${c.level ?? 1}`, b.t);
};

/** Buildings: level the lowest Producer or build the next of `BUILD_ORDER`, never while the castle is about to take the builder. With Builder #2 a second one runs next to the first. */
export const buildings = (b: Bot): void => {
	const { bld, cfg, utils } = b;
	let s = b.api();
	const castleNow = tileAt(s.tiles, cfg.CASTLE_X, cfg.CASTLE_Y);
	const castleNear =
		!!castleNow.upgradeCost &&
		(castleNow.level ?? 1) < cfg.CASTLE_UPGRADE.maxLevel &&
		Object.entries(castleNow.upgradeCost).every(([r, v]) => s.resources[r as keyof typeof s.resources] >= (v ?? 0) * 0.95);
	const builders = bld.builderCount({ prestige: s.prestige, gemBuilders: s.gemBuilders });
	const busy = (s.castleUpgrade ? 1 : 0) + s.buildingUpgrades.length;
	// with one builder the castle comes first; with a second one the buildings use the free hand, but still never a hand the castle is about to need
	if (busy >= builders || (castleNear && !s.castleUpgrade && busy + 1 >= builders)) return;
	const built = bld.builtBuildings(s.tiles);
	const owned = utils.economyTiles(s.tiles, s.freeTiles);
	const castleLvl = castleNow.level ?? 1;
	// a sensible player keeps buying land first: a building is paid only when the gold left over still buys the next BUILD_TILE_RESERVE tiles
	const reserve = BUILD_TILE_RESERVE * utils.calculateTileCost(owned, 0).gold;
	const pay = (cost: Bundle) => s.resources.gold >= (cost.gold ?? 0) + reserve && (utils.canAffordBundle(s.resources, cost) || topUp(b, cost));
	const busySpots = new Set(s.buildingUpgrades.map((j) => `${j.x},${j.y}`));
	const lowest = built
		.filter(
			(x) => !EXTRACTOR_ORDER.includes(x.id) && !IDOL_ORDER.includes(x.id) && x.level < bld.buildingLevelCap(castleLvl) && !busySpots.has(`${x.x},${x.y}`),
		)
		.sort((x, y) => x.level - y.level)[0];
	// Producers first, then their levels as far as the castle allows; the Extractors only once nothing is left to level (they feed crafting, which has no sink yet)
	const missing = (ids: string[]) => ids.find((id) => !built.some((x) => x.id === id));
	const next = missing(BUILD_ORDER) ?? (lowest ? undefined : (missing(IDOL_ORDER) ?? missing(EXTRACTOR_ORDER)));
	if (next) {
		const spot = ownedRowMajor(s.tiles).find(
			({ x, y, tile }) =>
				!tile.building &&
				!tile.hasChest &&
				!s.monsters.some((m) => m.x === x && m.y === y) &&
				bld.buildProblem(
					{
						tiles: s.tiles,
						monsters: s.monsters,
						castleLevel: castleLvl,
						castleUpgrade: s.castleUpgrade,
						buildingUpgrades: s.buildingUpgrades,
						ownedTiles: owned,
						builders,
					},
					x,
					y,
					next,
				) === null,
		);
		if (spot && pay(bld.buildingLevelCost(1, owned)) && b.api().buildBuilding(spot.x, spot.y, next)) {
			b.mark(`building${built.length + 1}`, b.t);
			s = b.api();
		}
	} else if (lowest && pay(bld.buildingLevelCost(lowest.level + 1, owned)) && b.api().upgradeBuilding(lowest.x, lowest.y)) {
		b.mark(`buildingLevel${lowest.level + 1}`, b.t);
	}
};

/** Click power: bought when the gold on hand is 1.3 x the price. */
export const clickPower = (b: Bot): void => {
	const s = b.api();
	const next = b.cfg.CLICK_LADDER[s.clickLevel + 1];
	if (next && s.resources.gold >= next.price * 1.3 && b.api().buyClickUpgrade()) b.mark(`click${b.api().clickLevel}`, b.t);
};

/** Animals (the first copy of each as soon as possible, more when food is plentiful) and farm upgrades (once the resources are there with room to spare, never what the castle needs). */
export const farm = (b: Bot): void => {
	const { cfg, utils } = b;
	let s = b.api();
	const c = tileAt(s.tiles, cfg.CASTLE_X, cfg.CASTLE_Y);
	const castleNeed = (c.upgradeCost ?? {}) as Bundle;
	for (const animal of cfg.ANIMALS) {
		const lvl = s.farmLevels[animal.id] || 0;
		const cost = utils.calculateAnimalCost(animal, lvl);
		const reserve = castleNeed.food ?? 0;
		if ((lvl === 0 ? s.resources.food >= cost : s.resources.food >= cost * 3 + reserve) && b.api().purchaseAnimal(animal.id)) {
			b.mark(`${animal.id}${lvl + 1}`, b.t);
			s = b.api();
		}
	}
	for (const id of Object.keys(cfg.FARM_UPGRADES) as (keyof typeof cfg.FARM_UPGRADES)[]) {
		const level = utils.farmUpgradeLevel(s.farmUpgrades, id);
		if (level >= cfg.FARM_UPGRADES[id].maxLevel) continue;
		const cost = utils.farmUpgradeCost(id, level);
		const roomy = Object.entries(cost).every(([r, v]) => s.resources[r as keyof typeof s.resources] >= (v ?? 0) * 1.5 + (castleNeed[r] ?? 0));
		if (roomy && b.api().buyFarmUpgrade(id)) s = b.api();
	}
};

/** Minutes the income needs to cover what is still missing of each part of the next tile, read at tile counts of the first run (the hide-versus-gold diagnostic). */
const recordTileWait = (b: Bot, s: State, owned: number): void => {
	const mark = WAIT_MARKS.filter((n) => owned >= n).pop();
	if (!mark) return;
	const key = String(mark);
	if (b.tileWaits[key]) return;
	const cost = b.utils.calculateTileCost(owned, b.utils.effectiveTileDiscount(s.characterStats, s.prestige, s.merchantUpgrades, s.playerClass));
	const need = b.utils.tileCostAsResources(cost) as Record<string, number>;
	const rate = s.resourceRates.total as unknown as Record<string, number>;
	const stock = s.resources as unknown as Record<string, number>;
	b.tileWaits[key] = Object.fromEntries(
		Object.entries(need).map(([r, v]) => [r, rate[r] > 0 ? Math.round(Math.max(0, v - stock[r]) / rate[r] / 60) : Infinity]),
	);
};

/** Tiles: as many as affordable (a human buys at most `tilesPerVisit`), nearest the castle first, never eating what the next castle level needs. */
export const tiles = (b: Bot, rewards: Parameters<typeof gift>[2]): void => {
	const { cfg, utils } = b;
	let s = b.api();
	for (let guard = 0; guard < (b.profile.human?.tilesPerVisit ?? (b.profile.rebirthAtMaxCastle ? 200 : 20)); guard++) {
		if (b.frontierDirty || !b.frontier) {
			b.frontier = findFrontier(b);
			b.frontierDirty = false;
		}
		if (!b.frontier) break;
		const owned = utils.economyTiles(s.tiles, s.freeTiles);
		const cost = utils.calculateTileCost(owned, utils.effectiveTileDiscount(s.characterStats, s.prestige, s.merchantUpgrades, s.playerClass));
		const bundle = utils.tileCostAsResources(cost);
		if (!utils.canAffordBundle(s.resources, bundle)) {
			if (!topUp(b, bundle)) break;
			s = b.api();
		}
		// A sensible player does not let tiles eat the resources the next castle level needs (a castle the profile never upgrades further reserves nothing)
		const castleTile = tileAt(s.tiles, cfg.CASTLE_X, cfg.CASTLE_Y);
		if (!b.profile.tilesFirst && !s.castleUpgrade && (castleTile.level ?? 1) < b.castleCeiling() && castleTile.upgradeCost) {
			const after = utils.subtractBundle(s.resources, bundle);
			const blocked = Object.entries(castleTile.upgradeCost).some(
				([r, v]) => r !== 'gold' && s.resources[r as keyof typeof s.resources] >= (v ?? 0) && after[r as keyof typeof after] < (v ?? 0),
			);
			if (blocked) break;
		}
		if (!b.api().buyTile(b.frontier[0], b.frontier[1])) break;
		gift(b, 'tile', rewards);
		gift(b, 'farm', rewards); // the farm bundle arrives when the guide meets the farm, right after the first tile
		b.frontierDirty = true;
		s = b.api();
		const ownedNow = utils.economyTiles(s.tiles, s.freeTiles);
		TILE_MARKS.forEach((n) => ownedNow >= n && b.mark(`tiles${n}`, b.t));
		if (b.run === 1) recordTileWait(b, s, ownedNow);
	}
};

/** Sell what the bot does not need (keeps a reserve for the castle and the next few tiles; a human never sells surplus, `hoard` is huge). */
export const sellExcess = (b: Bot): void => {
	const { cfg, utils } = b;
	const s = b.api();
	const hoard = b.profile.human?.hoard ?? 1;
	const c = tileAt(s.tiles, cfg.CASTLE_X, cfg.CASTLE_Y);
	const need: Record<string, number> = { ...((c.upgradeCost ?? {}) as Record<string, number>) };
	const owned = utils.economyTiles(s.tiles, s.freeTiles);
	for (let k = 0; k < 3; k++) {
		const cost = utils.calculateTileCost(owned + k, utils.effectiveTileDiscount(s.characterStats, s.prestige, s.merchantUpgrades, s.playerClass));
		Object.entries(cost.resources).forEach(([r, v]) => {
			need[r] = Math.max(need[r] ?? 0, (v ?? 0) * 1.1);
		});
	}
	(['wood', 'stone', 'coal', 'meat'] as const).forEach((r) => {
		const excess = s.resources[r] - (need[r] ?? 0) * 1.1 * hoard;
		if (excess > 50) b.api().sellResources(r, Math.floor(excess));
	});
	// Farm products: keep what the next hen house / dairy / tannery / shearing shed level needs, sell the rest
	const productUpgrade = { eggs: 'coop', milk: 'dairy', hide: 'tannery', wool: 'shearing' } as const;
	(['eggs', 'milk', 'hide', 'wool'] as const).forEach((r) => {
		const id = productUpgrade[r];
		const next = utils.farmUpgradeCost(id, utils.farmUpgradeLevel(s.farmUpgrades, id))[r] ?? 0;
		const excess = b.api().resources[r] - Math.max(next * 1.6, (need[r] ?? 0) * 1.1) * hoard; // the next tiles may cost hide too
		if (excess > 5) b.api().sellResources(r, Math.floor(excess));
	});
	// Food: keep what animals, castle and tiles might need (2 days of income) and sell the rest
	const foodKeep = (Math.max(need.food ?? 0, 0) * 1.1 + 20000) * hoard;
	const foodExcess = b.api().resources.food - foodKeep;
	if (foodExcess > 5000 && !cfg.ANIMALS.some((a) => b.api().resources.food >= utils.calculateAnimalCost(a, b.api().farmLevels[a.id] || 0)))
		b.api().sellResources('food', Math.floor(foodExcess));
};
