import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, owned, patchTileAt, setResources, store, tileAt, gridCells } from './helpers';
import {
	CASTLE_UPGRADE,
	CLICK_LADDER,
	CASTLE_X,
	CASTLE_Y,
	MAX_CATCHUP_SEC,
	MERCHANT_BUYABLE,
	MERCHANT_BUY_MULTIPLIER,
	MERCHANT_RESOURCE_PRICES,
	TILE_RESOURCE_COST,
} from '../src/config/gameConfig';
import { buyCost, calculateTileCost, calculateBuildingCost, effectiveTileDiscount, totalStatPoints, xpToNextLevel } from '../src/utils/gameUtils';
import type { Resources } from '../src/types/game';
import { hasOwnedNeighbour, isOwnedAt } from '../src/utils/world';

const SELLABLE = [...MERCHANT_BUYABLE]; // what can be both bought and sold; farm products only sell (see merchantShop.test.ts)
const castleLevel = () => tileAt(api().tiles, CASTLE_X, CASTLE_Y).level ?? 1;

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
	assert.equal(api().characterStats.availablePoints, totalStatPoints(level));
	api().tick(100);
	assert.equal(api().characterStats.availablePoints, totalStatPoints(level)); // no double award
});

test('tile purchase that causes a level-up still awards the stat point', () => {
	freshGame();
	setResources({ gold: 1e9, xp: xpToNextLevel(1) - 10 }); // a tile's XP carries it over the first level
	const before = api().characterStats.availablePoints;
	const frontier = [CASTLE_X + 1, CASTLE_Y] as const;
	assert.equal(api().buyTile(frontier[0], frontier[1]), true);
	api().tick(100);
	assert.ok(api().level.level >= 2);
	assert.equal(api().characterStats.availablePoints, before + totalStatPoints(api().level.level));
});

test('buyTile: only adjacent, unowned, affordable tiles; pick-a-biome flow is guarded', () => {
	freshGame({ gold: 1e9 });
	assert.equal(api().buyTile(CASTLE_X + 5, CASTLE_Y), false); // not adjacent
	assert.equal(api().buyTile(CASTLE_X, CASTLE_Y), false); // already owned
	assert.equal(api().buyTile(1.5, 2), false);
	assert.equal(api().buyTile(-1, 0), false);
	growTo(3); // the 4th purchase used to be a biome pick: now every purchase is a plain rolled purchase
	assert.equal(owned(), 3);
	const spot = (() => {
		const s = api();
		const f = gridCells(s.tiles).find(({ x, y }) => !isOwnedAt(s.tiles, x, y) && hasOwnedNeighbour(s.tiles, x, y));
		if (!f) throw new Error('no frontier');
		return [f.x, f.y];
	})();
	const gold = api().resources.gold;
	assert.equal(api().buyTile(spot[0], spot[1]), true);
	assert.ok(api().resources.gold < gold, 'the purchase is charged at once');
	assert.equal(owned(), 4);
	assert.ok(tileAt(api().tiles, spot[0], spot[1]).isOwned);
	assert.notEqual(tileAt(api().tiles, spot[0], spot[1]).biome, 'grounds','the removed Grounds biome never turns up: buildings go on any tile');
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
	const frontier = gridCells().find(({ t, x, y }) => !t.isOwned && hasOwnedNeighbour(api().tiles, x, y))!;
	assert.equal(api().buyTile(frontier.x, frontier.y), false);
	setResources({ [first.resource]: cost.resources[first.resource]! } as Partial<Resources>);
	setResources({ stone: cost.resources.stone ?? 0, wood: cost.resources.wood ?? 0 });
	const goldBefore = api().resources.gold;
	assert.equal(api().buyTile(frontier.x, frontier.y), true);
	assert.equal(api().resources[first.resource], 0, 'the resource was spent');
	assert.ok(api().resources.gold < goldBefore);
});

test('tile cost: gold stays the biggest part, wood, stone and coal are a real share, and hide joins from 120 tiles', () => {
	for (const n of [15, 30, 60, 100, 119, 120, 200, 300, 1000]) {
		const { gold, resources } = calculateTileCost(n, 0);
		for (const [key, amount] of Object.entries(resources)) assert.ok((amount ?? 0) < gold, `${key} costs less than the gold at n=${n}`);
		const raw = (resources.wood ?? 0) + (resources.stone ?? 0) + (resources.coal ?? 0);
		assert.ok(raw > gold * 0.4 || n < 30, `wood, stone and coal are about half of the gold at n=${n}`);
		assert.ok(raw < gold * 1.5, `and gold is still the biggest single part at n=${n}`);
	}
	assert.equal(calculateTileCost(119, 0).resources.hide, undefined, 'no hide before the 120th tile');
	assert.ok((calculateTileCost(120, 0).resources.hide ?? 0) > 0, 'hide from the 120th tile');
	assert.ok((calculateTileCost(30, 0).resources.coal ?? 0) > 0);
	const kept = calculateTileCost(150, 50).resources;
	const full = calculateTileCost(150, 0).resources;
	for (const key of Object.keys(full) as (keyof typeof full)[]) assert.ok((kept[key] ?? 0) <= (full[key] ?? 0) / 2 + 1, `${key} gets the Charisma discount too`);
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

test('chests: collecting needs a real chest and takes it off the map at once (what was inside is the server: see serverSpawns.test.ts)', () => {
	freshGame();
	growTo(8);
	assert.equal(api().collectChest(CASTLE_X, CASTLE_Y), false);
	patchTileAt(CASTLE_X + 1, CASTLE_Y, { hasChest: true });
	store.setState({ activeChests: 1 });
	const realFetch = globalThis.fetch;
	globalThis.fetch = (async () => new Response('{}', { status: 503 })) as typeof fetch;
	try {
		assert.equal(api().collectChest(CASTLE_X + 1, CASTLE_Y), true);
		assert.equal(api().activeChests, 0);
		assert.equal(api().collectChest(CASTLE_X + 1, CASTLE_Y), false); // gone
	} finally {
		globalThis.fetch = realFetch;
	}
});

test('buildings: cost resources, grow more expensive, and only go on free land tiles', () => {
	freshGame({ gold: 1e12, wood: 1e12, stone: 1e12 });
	growTo(4);
	const spot = gridCells().find(({ t }) => t.isOwned && t.biome !== 'castle' && t.biome !== 'lake')!;
	const first = calculateBuildingCost(api().tiles);
	assert.equal(api().buildOnTile(spot.x, spot.y, 'nonsense'), false);
	assert.equal(api().buildOnTile(CASTLE_X, CASTLE_Y, 'market'), false); // the castle
	setResources({ gold: 0, wood: 0, stone: 0 });
	assert.equal(api().buildOnTile(spot.x, spot.y, 'market'), false);
	setResources({ gold: 1e12, wood: 1e12, stone: 1e12 });
	assert.equal(api().buildOnTile(spot.x, spot.y, 'market'), true);
	assert.equal(tileAt(api().tiles, spot.x, spot.y).building, 'market');
	assert.equal(tileAt(api().tiles, spot.x, spot.y).biome, spot.t.biome, 'the tile keeps its biome');
	assert.equal(api().buildOnTile(spot.x, spot.y, 'farm'), false); // already built
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

test('buyCost: what the Resources tab shows is what buyResource charges (twice the sell price, rounded up)', () => {
	for (const resource of MERCHANT_BUYABLE) {
		for (const units of [1, 2, 3, 7, 10, 100, 12_345]) {
			assert.equal(buyCost(resource, units), Math.ceil(units * MERCHANT_RESOURCE_PRICES[resource] * MERCHANT_BUY_MULTIPLIER), `${resource} x${units}`);
			freshGame();
			setResources({ gold: 1e9, [resource]: 0 });
			const before = api().resources.gold;
			assert.equal(api().buyResource(resource, units), true);
			assert.equal(before - api().resources.gold, buyCost(resource, units), `${resource} x${units} is charged exactly what the tab shows`);
		}
	}
});
