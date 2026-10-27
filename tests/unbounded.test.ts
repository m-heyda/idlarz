import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, setResources, store, owned } from './helpers';
import { CASTLE_X, CASTLE_Y, CHEST, RESOURCE_CAP } from '../src/config/gameConfig';
import { pickPersisted } from '../src/lib/sanitizeSave';
import { spawnCap } from '../src/lib/spawnLimits';
import { decodeSave, encodeSave } from '../src/lib/saveFormat';
import { calculateTileCost, calculateXpGain, economyTiles } from '../src/utils/gameUtils';
import { COORD_LIMIT, MAX_OWNED_TILES, getTile, isOwnedAt, ownedBounds, ownedCount, setTile } from '../src/utils/world';
import { syntheticWorld } from '../src/utils/worldGen';

// The map has no edge: tiles can be bought past x = 0 / y = 0 (negative coordinates) and as far as the limits allow.

const rich = () =>
	setResources({ gold: RESOURCE_CAP / 10, wood: RESOURCE_CAP / 10, stone: RESOURCE_CAP / 10, coal: RESOURCE_CAP / 10, food: RESOURCE_CAP / 10 });

test('a line of tiles can be bought to the left, past x = 0 and far beyond the old 50 x 50 square', () => {
	freshGame();
	let x = CASTLE_X - 1;
	let bought = 0;
	for (; x >= -120; x--) {
		rich();
		if (!api().buyTile(x, CASTLE_Y)) break;
		bought++;
	}
	assert.equal(bought, CASTLE_X - 1 + 120 + 1, 'every tile in the line was bought');
	assert.equal(ownedBounds(api().tiles)?.minX, -120);
	assert.ok(isOwnedAt(api().tiles, -120, CASTLE_Y));
	assert.equal(api().buyTile(-122, CASTLE_Y), false, 'a tile that touches nothing explored');
	assert.equal(api().buyTile(-121, CASTLE_Y), true, 'the next one in the line is fine');
});

test('upwards and downwards too: negative y', () => {
	freshGame();
	for (let y = CASTLE_Y - 1; y >= -40; y--) {
		rich();
		assert.equal(api().buyTile(CASTLE_X, y), true, `y ${y}`);
	}
	assert.equal(ownedBounds(api().tiles)?.minY, -40);
	for (let y = CASTLE_Y + 1; y <= 120; y++) {
		rich();
		assert.equal(api().buyTile(CASTLE_X, y), true, `y ${y}`);
	}
	assert.equal(ownedBounds(api().tiles)?.maxY, 120);
});

test('the limits of the coordinate range and of the tile count refuse a purchase', () => {
	freshGame();
	// land that touches the last allowed column: a tile just outside is refused whatever it costs
	store.setState((s) => ({ tiles: setTile(s.tiles, COORD_LIMIT, 0, { biome: 'plains', isOwned: true }) }));
	rich();
	assert.equal(api().buyTile(COORD_LIMIT + 1, 0), false, 'past the coordinate range');
	assert.equal(api().buyTile(COORD_LIMIT, 1), true, 'inside the range next to the same tile');

	const full = syntheticWorld(MAX_OWNED_TILES, 3);
	store.setState({ tiles: full });
	rich();
	const edge = [...full.map.keys()][full.map.size - 1];
	const spare = [
		[1, 0],
		[-1, 0],
		[0, 1],
		[0, -1],
	]
		.map(([dx, dy]) => [(edge % (2 * COORD_LIMIT + 1)) - COORD_LIMIT + dx, Math.floor(edge / (2 * COORD_LIMIT + 1)) - COORD_LIMIT + dy])
		.find(([sx, sy]) => !isOwnedAt(full, sx, sy));
	assert.ok(spare, 'an open neighbour of the newest tile');
	assert.equal(api().buyTile(spare![0], spare![1]), false, 'a full map takes no more tiles');
	assert.equal(ownedCount(api().tiles), MAX_OWNED_TILES);
});

test('the price keeps rising and stays payable on a big map', () => {
	freshGame();
	let last = 0;
	for (const n of [10, 100, 400, 2000, 10_000, 40_000]) {
		const price = calculateTileCost(n).gold;
		assert.ok(Number.isFinite(price) && price > last && price < RESOURCE_CAP, `n=${n}: ${price}`);
		last = price;
	}
	// a purchase on a big synthetic map charges that price and gives XP without ever exceeding the cap
	store.setState({ tiles: syntheticWorld(3000, 7), freeTiles: 1 });
	rich();
	const before = api().resources;
	const spot = findFrontier();
	assert.ok(spot, 'a frontier tile exists');
	assert.equal(api().buyTile(spot![0], spot![1]), true);
	const after = api().resources;
	assert.ok(after.gold < before.gold && after.xp > before.xp && after.xp <= RESOURCE_CAP);
	assert.equal(economyTiles(api().tiles, 1), ownedCount(api().tiles), 'the economy counts every explored tile');
});

const findFrontier = (): [number, number] | null => {
	const world = api().tiles;
	const b = ownedBounds(world)!;
	for (let y = b.minY - 1; y <= b.maxY + 1; y++)
		for (let x = b.minX - 1; x <= b.maxX + 1; x++)
			if (!isOwnedAt(world, x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isOwnedAt(world, x + dx, y + dy))) return [x, y];
	return null;
};

test('chests and monsters spawn on land with negative coordinates, and the game saves and loads such a map', () => {
	freshGame();
	// a map that is mostly in the negative quadrant
	const world = syntheticWorld(1200, 11);
	assert.ok((ownedBounds(world)?.minX ?? 0) < 0);
	store.setState({ tiles: world, freeTiles: 1 });
	let xp = 0;
	for (let k = 2; k <= 1200; k++) xp += calculateXpGain(k); // what those tiles would have paid, so the save below is plausible
	setResources({ xp: xp * 1.01 });
	for (let i = 0; i < 40; i++) api().tick(CHEST.intervalSec * 1000);
	const placed = [...api().tiles.map.entries()].filter(([, t]) => t.hasChest).length;
	assert.ok(placed > 0 && placed <= spawnCap(world, 1), `chests on the map: ${placed}`);
	assert.equal(api().tiles.stats.chests, placed);
	assert.ok(api().monsters.length > 0, 'monsters appeared');
	for (const m of api().monsters) assert.ok(isOwnedAt(api().tiles, m.x, m.y) && getTile(api().tiles, m.x, m.y)?.biome !== 'castle');

	const text = encodeSave(pickPersisted(api()));
	const loaded = decodeSave(text);
	assert.equal(loaded.ok, true, loaded.ok ? '' : loaded.reason);
	if (loaded.ok) {
		assert.equal(ownedCount(loaded.state.tiles), owned());
		assert.deepEqual(ownedBounds(loaded.state.tiles), ownedBounds(api().tiles));
		assert.equal(loaded.state.tiles.stats.chests, placed);
	}
});

test('rebirth and reset bring the map back to the starting ring, wherever the land was', () => {
	freshGame();
	store.setState({ tiles: syntheticWorld(800, 2), freeTiles: 1 });
	api().resetGame();
	assert.equal(ownedCount(api().tiles), 9);
	assert.deepEqual(ownedBounds(api().tiles), { minX: CASTLE_X - 1, maxX: CASTLE_X + 1, minY: CASTLE_Y - 1, maxY: CASTLE_Y + 1 });
});
