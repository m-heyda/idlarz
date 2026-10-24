import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, owned, setResources, store } from './helpers';
import {
	CASTLE_UPGRADE,
	CHEST,
	CLICK_LADDER,
	GRID_CENTER_X,
	GRID_CENTER_Y,
	MAX_CATCHUP_SEC,
	MERCHANT_BUYABLE,
	TILE_RESOURCE_COST,
} from '../src/config/gameConfig';
import { calculateTileCost, calculateBuildingCost, effectiveTileDiscount } from '../src/utils/gameUtils';
import type { Resources } from '../src/types/game';

const SELLABLE = [...MERCHANT_BUYABLE]; // what can be both bought and sold; farm products only sell (see merchantShop.test.ts)
const castleLevel = () => api().tiles[GRID_CENTER_Y][GRID_CENTER_X].level ?? 1;

test('merchant: buying then selling never makes gold, for every resource and amount', () => {
	for (const resource of SELLABLE) {
		for (let amount = 1; amount <= 300; amount++) {
			freshGame({ gold: 1_000_000 });
			const start = api().resources.gold;
			assert.equal(api().buyResource(resource, amount), true);
			assert.equal(api().sellResources(resource, api().resources[resource]), true);
			assert.ok(api().resources.gold <= start, `${resource} x${amount}: ${api().resources.gold} > ${start}`);
		}
	}
});

test('merchant: selling then buying back never makes gold either', () => {
	for (const resource of SELLABLE) {
		for (const amount of [1, 2, 3, 7, 99, 1000, 123456]) {
			freshGame({ gold: 1_000_000, [resource]: amount } as Partial<Resources>);
			const start = api().resources.gold;
			assert.equal(api().sellResources(resource, amount), true);
			const gained = api().resources.gold - start;
			assert.equal(api().buyResource(resource, amount), true);
			assert.ok(api().resources.gold <= start, `${resource} x${amount} gained ${gained}`);
		}
	}
});

test('merchant: invalid input is rejected and changes nothing', () => {
	freshGame({ gold: 1000, wood: 1000, xp: 1000 });
	const before = JSON.stringify(api().resources);
	for (const bad of [0, -5, NaN, Infinity, -Infinity, 1e300]) {
		assert.equal(api().sellResources('wood', bad), false);
		assert.equal(api().buyResource('wood', bad), false);
	}
	assert.equal(api().sellResources('gold', 10), false);
	assert.equal(api().sellResources('xp', 10), false);
	assert.equal(api().buyResource('gold', 10), false);
	assert.equal(api().sellResources('nope' as keyof Resources, 1), false);
	assert.equal(JSON.stringify(api().resources), before);
});

test('addResources rejects NaN/Infinity and never drives a stockpile negative', () => {
	freshGame({ gold: 100 });
	api().addResources({ gold: NaN });
	api().addResources({ gold: Infinity });
	api().addResources({ gold: -101 });
	api().addResources({ bogus: 5 } as unknown as Partial<Resources>);
	assert.equal(api().resources.gold, 100);
	api().addResources({ gold: -100 });
	assert.equal(api().resources.gold, 0);
});

test('tick: negative or non-finite deltas change nothing', () => {
	freshGame();
	const before = JSON.stringify(api().resources);
	api().tick(-5000);
	api().tick(NaN);
	api().tick(-Infinity);
	assert.equal(JSON.stringify(api().resources), before);
});

test('tick: a huge delta (clock moved a day forward) only grants MAX_CATCHUP_SEC of progress', () => {
	freshGame();
	const rate = api().resourceRates.total.gold;
	api().tick(86_400_000);
	const gold = api().resources.gold;
	assert.ok(Math.abs(gold - 125 - rate * MAX_CATCHUP_SEC) < 1, `gold ${gold}`);
});

test('level-ups from any source award exactly one stat point per level', () => {
	freshGame();
	api().addResources({ xp: 100_000 });
	api().tick(100);
	const level = api().level.level;
	assert.ok(level > 5);
	assert.equal(api().characterStats.availablePoints, level - 1);
	api().tick(100);
	assert.equal(api().characterStats.availablePoints, level - 1); // no double award
});

test('tile purchase that causes a level-up still awards the stat point', () => {
	freshGame();
	setResources({ gold: 1e9, xp: 740 });
	const before = api().characterStats.availablePoints;
	const frontier = [GRID_CENTER_X + 1, GRID_CENTER_Y] as const;
	assert.equal(api().buyTile(frontier[0], frontier[1]), true);
	api().tick(100);
	assert.ok(api().level.level >= 2);
	assert.equal(api().characterStats.availablePoints, before + api().level.level - 1);
});

test('buyTile: only adjacent, unowned, affordable tiles; pick-a-biome flow is guarded', () => {
	freshGame({ gold: 1e9 });
	assert.equal(api().buyTile(GRID_CENTER_X + 5, GRID_CENTER_Y), false); // not adjacent
	assert.equal(api().buyTile(GRID_CENTER_X, GRID_CENTER_Y), false); // already owned
	assert.equal(api().buyTile(1.5, 2), false);
	assert.equal(api().buyTile(-1, 0), false);
	growTo(3); // next purchase is a pick
	assert.equal(owned(), 3);
	const spot = (() => {
		const s = api();
		for (let y = 0; y < s.tiles.length; y++)
			for (let x = 0; x < s.tiles[y].length; x++)
				if (!s.tiles[y][x].isOwned && [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([ax, ay]) => s.tiles[ay]?.[ax]?.isOwned)) return [x, y];
		throw new Error('no frontier');
	})();
	const gold = api().resources.gold;
	assert.equal(api().buyTile(spot[0], spot[1]), true);
	assert.equal(api().biomeSelectionActive, true);
	assert.equal(api().resources.gold, gold, 'nothing is charged before the biome is chosen');
	assert.equal(api().selectBiome('empty'), false);
	assert.equal(api().selectBiome('castle'), false);
	assert.equal(api().biomeSelectionActive, true);
	api().cancelBiomeSelection();
	assert.equal(api().resources.gold, gold, 'cancel is free');
	assert.equal(owned(), 3);
	assert.equal(api().selectBiome('plains'), false); // no pending selection any more
});

test('tile cost: extra resources are required from the configured tile count and are paid', () => {
	freshGame({ gold: 1e12 });
	const first = TILE_RESOURCE_COST[0];
	growTo(first.from);
	assert.equal(owned(), first.from);
	const cost = calculateTileCost(owned(), effectiveTileDiscount(api().characterStats, api().prestige));
	assert.ok((cost.resources[first.resource] ?? 0) > 0);
	// enough gold, but none of the required resource
	setResources({ gold: 1e12, wood: 0, stone: 0, coal: 0, food: 0 });
	const frontier = api().tiles.flatMap((row, y) => row.map((t, x) => ({ t, x, y }))).find(({ t, x, y }) => !t.isOwned && [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([ax, ay]) => api().tiles[ay]?.[ax]?.isOwned))!;
	assert.equal(api().buyTile(frontier.x, frontier.y), false);
	setResources({ [first.resource]: cost.resources[first.resource]! } as Partial<Resources>);
	setResources({ stone: cost.resources.stone ?? 0, wood: cost.resources.wood ?? 0 });
	const goldBefore = api().resources.gold;
	if (!api().biomeSelectionActive) {
		assert.equal(api().buyTile(frontier.x, frontier.y), true);
		if (api().biomeSelectionActive) api().selectBiome('plains');
	}
	assert.equal(api().resources[first.resource], 0, 'the resource was spent');
	assert.ok(api().resources.gold < goldBefore);
});

test('castle: needs the resources, only one upgrade at a time, takes real tick time, then levels up', () => {
	freshGame();
	assert.equal(api().upgradeCastle(), false); // cannot afford
	const cost = CASTLE_UPGRADE.upgradeCosts[0] as Record<string, number>;
	setResources({ gold: cost.gold, wood: cost.wood, stone: cost.stone });
	assert.equal(api().upgradeCastle(), true);
	assert.equal(api().resources.gold, 0 + 0); // paid in full up front
	assert.equal(castleLevel(), 1, 'level changes only when the timer ends');
	assert.deepEqual(api().castleUpgrade, { toLevel: 2, remainingSec: CASTLE_UPGRADE.durationsSec[0] });
	setResources({ gold: 1e12, wood: 1e12, stone: 1e12 });
	assert.equal(api().upgradeCastle(), false); // already upgrading
	// a day of "clock" in one tick only advances MAX_CATCHUP_SEC
	api().tick(86_400_000);
	assert.equal(api().castleUpgrade!.remainingSec, CASTLE_UPGRADE.durationsSec[0] - MAX_CATCHUP_SEC);
	for (let i = 0; i < 20; i++) api().tick(MAX_CATCHUP_SEC * 1000);
	assert.equal(api().castleUpgrade, null);
	assert.equal(castleLevel(), 2);
	assert.ok(api().resourceRates.modifiers.gold >= CASTLE_UPGRADE.baseResourceMultiplier * 2);
});

test('click power: untrusted clicks pay nothing, trusted clicks pay gold/s x power, upgrades follow the ladder', () => {
	freshGame();
	setResources({ gold: 0 });
	assert.equal(api().clickForGold({ eventId: 1, now: 0, trusted: false }), 0);
	const rate = api().resourceRates.total.gold;
	const paid = api().clickForGold({ eventId: 2, now: 10_000, trusted: true });
	assert.ok(Math.abs(paid - rate * CLICK_LADDER[0].power) < 1e-9);
	setResources({ gold: 0 });
	assert.equal(api().buyClickUpgrade(), false);
	setResources({ gold: CLICK_LADDER[1].price });
	assert.equal(api().buyClickUpgrade(), true);
	assert.equal(api().clickLevel, 1);
	while (api().clickLevel < CLICK_LADDER.length - 1) {
		setResources({ gold: CLICK_LADDER[api().clickLevel + 1].price });
		assert.equal(api().buyClickUpgrade(), true);
	}
	setResources({ gold: 1e12 });
	assert.equal(api().buyClickUpgrade(), false); // max level
});

test('chests: the spawn timer pauses at the cap, collecting needs a real chest, luck raises the reward', () => {
	freshGame();
	growTo(8);
	assert.equal(api().collectChest(GRID_CENTER_X, GRID_CENTER_Y), false);
	store.setState({ activeChests: CHEST.max, chestSpawnTimer: 123 });
	api().tick(10_000);
	assert.equal(api().chestSpawnTimer, 0);
	store.setState({ activeChests: 0, chestSpawnTimer: 0 });
	for (let t = 0; t < CHEST.intervalSec; t += MAX_CATCHUP_SEC) api().tick(MAX_CATCHUP_SEC * 1000);
	assert.equal(api().activeChests, 1);
	const spot = api().tiles.flatMap((row, y) => row.map((t, x) => ({ t, x, y }))).find(({ t }) => t.hasChest)!;
	setResources({ gold: 0, wood: 0, stone: 0, coal: 0, food: 0 });
	const xpBefore = api().resources.xp;
	const bagBefore = JSON.stringify(api().bag);
	assert.equal(api().collectChest(spot.x, spot.y), true);
	assert.equal(api().collectChest(spot.x, spot.y), false); // gone
	const loot = api().lastChestLoot;
	assert.ok(loot, 'what was inside is remembered for the toast');
	const r = api().resources;
	const gained =
		r.gold > 0 || r.wood > 0 || r.stone > 0 || r.coal > 0 || r.food > 0 || r.xp > xpBefore || JSON.stringify(api().bag) !== bagBefore;
	assert.ok(gained, `a ${loot!.kind} chest pays something`);
	assert.equal(api().activeChests, 0);
});

test('buildings: cost resources, grow more expensive, and only go on free Grounds tiles', () => {
	freshGame({ gold: 1e12, wood: 1e12, stone: 1e12 });
	growTo(4);
	store.setState((s) => {
		const tiles = s.tiles.map((row) => [...row]);
		const spot = tiles.flatMap((row, y) => row.map((t, x) => ({ t, x, y }))).find(({ t }) => t.isOwned && t.biome !== 'castle')!;
		tiles[spot.y][spot.x] = { ...tiles[spot.y][spot.x], biome: 'grounds' };
		return { tiles };
	});
	const grounds = api().tiles.flatMap((row, y) => row.map((t, x) => ({ t, x, y }))).find(({ t }) => t.biome === 'grounds')!;
	const first = calculateBuildingCost(api().tiles);
	assert.equal(api().upgradeGroundsTile(grounds.x, grounds.y, 'nonsense'), false);
	assert.equal(api().upgradeGroundsTile(GRID_CENTER_X, GRID_CENTER_Y, 'market'), false);
	setResources({ gold: 0, wood: 0, stone: 0 });
	assert.equal(api().upgradeGroundsTile(grounds.x, grounds.y, 'market'), false);
	setResources({ gold: 1e12, wood: 1e12, stone: 1e12 });
	assert.equal(api().upgradeGroundsTile(grounds.x, grounds.y, 'market'), true);
	assert.equal(api().upgradeGroundsTile(grounds.x, grounds.y, 'farm'), false); // already built
	const second = calculateBuildingCost(api().tiles);
	assert.ok((second.gold ?? 0) > (first.gold ?? 0));
});

test('stat points: only the five base stats can be raised and only with points', () => {
	freshGame();
	api().addStatPoint('strength');
	assert.equal(api().characterStats.strength, 5);
	store.setState((s) => ({ characterStats: { ...s.characterStats, availablePoints: 2 } }));
	api().addStatPoint('hp');
	api().addStatPoint('availablePoints');
	assert.equal(api().characterStats.availablePoints, 2);
	api().addStatPoint('charisma');
	assert.equal(api().characterStats.charisma, 6);
	assert.equal(api().characterStats.availablePoints, 1);
});

test('farm: animals cost food and stack production', () => {
	freshGame();
	assert.equal(api().purchaseAnimal('chicken'), 0);
	assert.equal(api().purchaseAnimal('dragon'), 0);
	setResources({ food: 1e9 });
	assert.equal(api().purchaseAnimal('chicken'), 1);
	const one = api().resourceRates.base.meat;
	assert.equal(api().purchaseAnimal('chicken'), 1);
	assert.ok(Math.abs(api().resourceRates.base.meat - 2 * one) < 1e-9);
});
