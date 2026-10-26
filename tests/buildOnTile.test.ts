import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, setResources, store, tileAt, gridCells, rowsOf } from './helpers';
import { BIOMES, BUILDINGS, BUILDING_COST, CASTLE_X, CASTLE_Y } from '../src/config/gameConfig';
import { buildingCostFactor, calculateBuildingCost, canBuildOn, countBuildings } from '../src/utils/gameUtils';
import { allPads, foundationBiome, isBuilt, terrainKey } from '../src/utils/terrain';
import { pickChestSpot } from '../src/lib/chests';
import { SELECTABLE_BIOMES } from '../src/utils/biomeRules';
import type { BiomeType, Tile } from '../src/types/game';
import { biomeCount, patchTile, setTile } from '../src/utils/world';

// Buildings: right-click any explored tile (not the castle or a lake) and build. One per tile, the price rises with every building.

const set = (x: number, y: number, tile: Partial<Tile>) =>
	store.setState((s) => {
		return { tiles: patchTile(s.tiles, x, y, tile) };
	});

/** The first explored non-castle tile, turned into `biome`. */
const lot = (biome: BiomeType) => {
	const spot = gridCells().find(({ t }) => t.isOwned && t.biome !== 'castle')!;
	set(spot.x, spot.y, { biome });
	return spot;
};

const ownedLots = () =>
	gridCells().filter(({ t }) => t.isOwned && t.biome !== 'castle');

test('building prices: four cheap starters, then three stages of growth, always rising', () => {
	assert.deepEqual([0, 1, 2, 3].map(buildingCostFactor), BUILDING_COST.starter);
	assert.ok(BUILDING_COST.starter[0] < 0.5 && BUILDING_COST.starter[3] <= 1, 'the first four are easier than the base price');
	for (let n = 1; n < 60; n++) assert.ok(buildingCostFactor(n) > buildingCostFactor(n - 1), `building ${n + 1}`);
	const first = BUILDING_COST.starter.length; // index of the first building of the early stage
	assert.ok(Math.abs(buildingCostFactor(first) - BUILDING_COST.growthEarly) < 1e-9, 'the first priced step is x growthEarly');
	const step = (n: number) => buildingCostFactor(n) / buildingCostFactor(n - 1);
	assert.ok(Math.abs(step(first + 1) - BUILDING_COST.growthEarly) < 1e-9);
	assert.ok(Math.abs(step(first + BUILDING_COST.earlyCount + 1) - BUILDING_COST.growthMid) < 1e-9);
	assert.ok(Math.abs(step(first + BUILDING_COST.earlyCount + BUILDING_COST.midCount + 1) - BUILDING_COST.growthLate) < 1e-9);
	// a rational curve, not a cliff: the 20th building stays below the order of the 20th tile (about 90K gold)
	assert.ok((BUILDING_COST.base.gold ?? 0) * buildingCostFactor(19) < 150_000);
});

test('buildOnTile works on every land biome, one building per tile, and the tile keeps its biome', () => {
	freshGame({ gold: 1e12, wood: 1e12, stone: 1e12 });
	growTo(10);
	const biomes: BiomeType[] = ['plains', 'forest', 'hills', 'swamp', 'tundra', 'coast', 'grounds'];
	const lots = ownedLots();
	assert.ok(lots.length >= biomes.length);
	biomes.forEach((biome, i) => {
		const { x, y } = lots[i];
		set(x, y, { biome });
		assert.equal(canBuildOn(tileAt(api().tiles, x, y)), true, biome);
		assert.equal(api().buildOnTile(x, y, 'market'), true, biome);
		assert.equal(tileAt(api().tiles, x, y).biome, biome);
		assert.equal(tileAt(api().tiles, x, y).building, 'market');
		assert.equal(api().buildOnTile(x, y, 'farm'), false, 'one building per tile');
	});
	assert.equal(api().buildOnTile(CASTLE_X, CASTLE_Y, 'market'), false, 'not on the castle');
	const spare = lots[biomes.length];
	set(spare.x, spare.y, { biome: 'lake' });
	assert.equal(canBuildOn(tileAt(api().tiles, spare.x, spare.y)), false);
	assert.equal(api().buildOnTile(spare.x, spare.y, 'market'), false, 'not on water');
	assert.equal(api().buildOnTile(0, 0, 'market'), false, 'not on unexplored land');
	assert.equal(api().buildOnTile(1.5, 1, 'market'), false);
});

test('buildOnTile refuses a tile with a chest or a monster and charges exactly the quoted price', () => {
	freshGame({ gold: 1e12, wood: 1e12, stone: 1e12 });
	growTo(6);
	const a = lot('forest');
	set(a.x, a.y, { hasChest: true });
	assert.equal(api().buildOnTile(a.x, a.y, 'mine'), false);
	set(a.x, a.y, { hasChest: false });
	store.setState({ monsters: [{ id: 1, type: 'rat', tier: 1, x: a.x, y: a.y, ageSec: 0 }], nextMonsterId: 2 });
	assert.equal(api().buildOnTile(a.x, a.y, 'mine'), false);
	store.setState({ monsters: [], nextMonsterId: 1 });
	const price = calculateBuildingCost(api().tiles, api().prestige);
	const before = { ...api().resources };
	assert.equal(api().buildOnTile(a.x, a.y, 'mine'), true);
	for (const r of ['gold', 'wood', 'stone'] as const) assert.equal(before[r] - api().resources[r], price[r], r);
	assert.equal(countBuildings(api().tiles), 1);
	setResources({ gold: 0, wood: 0, stone: 0 });
	const b = ownedLots().find(({ x, y }) => !(x === a.x && y === a.y))!;
	assert.equal(api().buildOnTile(b.x, b.y, 'mine'), false, 'cannot afford the second one');
});

test('a building adds its output on top of the biome output', () => {
	freshGame({ gold: 1e12, wood: 1e12, stone: 1e12 });
	growTo(6);
	const a = lot('forest');
	const before = api().resourceRates.total;
	assert.equal(api().buildOnTile(a.x, a.y, 'lumbermill'), true);
	const after = api().resourceRates.total;
	assert.ok(after.wood > before.wood, 'the lumber mill adds wood to the forest tile');
	assert.ok(BUILDINGS.lumbermill.resourceGeneration.wood! > 0 && BIOMES.forest.resourceGeneration.wood! > 0);
});

test('every purchase is a plain roll: Grounds never appears', () => {
	freshGame({ gold: 1e15, wood: 1e15, stone: 1e15, coal: 1e15, food: 1e15 });
	growTo(40);
	assert.equal(biomeCount(api().tiles, 'grounds'), 0);
	assert.ok(!SELECTABLE_BIOMES.includes('grounds' as BiomeType));
});

test('terrain: a building keeps its biome ground and gets a pad of that biome; an old Grounds lot still takes the ground around it', () => {
	freshGame({ gold: 1e12, wood: 1e12, stone: 1e12 });
	growTo(6);
	const a = lot('hills');
	api().buildOnTile(a.x, a.y, 'quarry');
	const tiles = api().tiles;
	const rows = rowsOf(tiles);
	assert.equal(isBuilt(tileAt(tiles, a.x, a.y)), true);
	assert.equal(foundationBiome(tiles, a.x, a.y), 'hills');
	const pad = allPads(rows).find((p) => p.x === a.x * 48);
	assert.ok(pad && pad.id.startsWith('pad_hills_'), pad?.id);
	assert.match(terrainKey(rows), /[A-Z]/); // built-on tiles are upper case, so the terrain is redrawn
	const old = setTile(tiles, a.x, a.y, { biome: 'grounds', isOwned: true, building: 'farm', level: 2 });
	assert.notEqual(foundationBiome(old, a.x, a.y), 'grounds'); // old lots resolve their foundation
});

test('chests never land on a building', () => {
	freshGame({ gold: 1e12, wood: 1e12, stone: 1e12 });
	growTo(8);
	for (const o of ownedLots().slice(1)) set(o.x, o.y, { building: 'farm' });
	for (let i = 0; i < 40; i++) {
		const spot = pickChestSpot(api().tiles, new Set(), 1, () => i / 40);
		if (spot) assert.ok(!tileAt(api().tiles, spot.x, spot.y).building);
	}
});
