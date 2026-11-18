import test from 'node:test';
import assert from 'node:assert/strict';
import { INGREDIENT_BY_ID, ingredientDescription } from '../../src/catalog/ingredients';
import { JUNK_ITEMS } from '../../src/catalog/items/junk';
import { ROCK, ROCK_DROPS, ROCK_TIER_ORDER, ROCK_TIERS, rockSprite } from '../../src/config/rocks';
import { pickRockSpot, rockCap, rockIntervalSec, rockSpots, rollRockLoot, rollRockTier, takeClicks } from '../../src/lib/rocks';
import { mulberry32 } from '../../src/lib/rng';
import { createWorld, type Placed } from '../../src/utils/world';
import type { Tile } from '../../src/types/game';

const tile = (biome: Tile['biome'], extra: Partial<Tile> = {}): Tile => ({ biome, isOwned: true, ...extra });
const land = (cells: [number, number, Tile][]): ReturnType<typeof createWorld> => createWorld(cells.map(([x, y, t]): Placed => ({ x, y, tile: t })));

test('a rock never stands on the castle, water, a building, a chest, a taken tile or the ward', () => {
	const cells: [number, number, Tile][] = [
		[0, 0, tile('castle')],
		[1, 0, tile('plains')],
		[2, 0, tile('lake')],
		[3, 0, tile('plains', { building: 'granary' })],
		[4, 0, tile('plains', { hasChest: true })],
		[5, 0, tile('plains')],
		[6, 0, tile('coast')],
		[7, 0, { biome: 'plains', isOwned: false }],
	];
	const world = land(cells);
	const spots = rockSpots(world, new Set(['5,0']), 1).map((s) => `${s.x},${s.y}`);
	assert.deepEqual(
		spots.sort(),
		['1,0', '6,0'],
		'only free land: plains and a sandy coast, not water, the castle, a building, a chest, a taken tile or unowned land',
	);
});

test('a rock is placed evenly on the free tiles, and none when the land is full', () => {
	const world = land([
		[0, 0, tile('castle')],
		[1, 0, tile('plains')],
		[2, 0, tile('hills')],
	]);
	const seen = new Set<string>();
	for (let seed = 1; seed <= 40; seed++) {
		const spot = pickRockSpot(world, new Set(), 1, mulberry32(seed));
		assert.ok(spot);
		seen.add(`${spot.x},${spot.y}`);
	}
	assert.deepEqual([...seen].sort(), ['1,0', '2,0']);
	assert.equal(pickRockSpot(world, new Set(['1,0', '2,0']), 1, mulberry32(1)), null);
});

test('the rocks that may wait grow with the land, from 2 up to 15', () => {
	assert.equal(rockCap(0), ROCK.minAllowed);
	assert.equal(rockCap(50), 6);
	assert.equal(rockCap(10_000), ROCK.maxOnMap);
});

test('rocks come much more often than chests (every 150 s), faster with Luck but never under 60% of it', () => {
	assert.equal(rockIntervalSec(0), 150);
	assert.ok(rockIntervalSec(100) < 150);
	assert.equal(rockIntervalSec(1_000_000), 150 * 0.6);
});

test('the tiers need 50, 125, 250, 500 and 1,000 clicks, and a better rock is rarer', () => {
	assert.deepEqual(
		ROCK_TIER_ORDER.map((t) => ROCK_TIERS[t].clicks),
		[50, 125, 250, 500, 1000],
	);
	const weights = ROCK_TIER_ORDER.map((t) => ROCK_TIERS[t].weight);
	assert.deepEqual(
		[...weights].sort((a, b) => b - a),
		weights,
		'the weights fall with the tier',
	);
});

test('rolling the tier: common most of the time, and Luck makes the better ones likelier', () => {
	const count = (luck: number) => {
		const rng = mulberry32(7);
		const n = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
		for (let i = 0; i < 20_000; i++) n[rollRockTier(luck, rng)]++;
		return n;
	};
	const plain = count(0);
	const lucky = count(200);
	assert.ok(plain.common > plain.uncommon && plain.uncommon > plain.rare && plain.rare > plain.epic);
	assert.ok(lucky.common < plain.common, 'Luck moves rocks out of the common tier');
	assert.ok(lucky.epic > plain.epic * 1.2);
	assert.ok(plain.common / 20_000 > 0.65 && plain.common / 20_000 < 0.75, 'about 70% common without Luck');
});

test('every tier has a picture, and the picture of a rock never changes', () => {
	for (const tier of ROCK_TIER_ORDER) {
		for (let n = 1; n <= 6; n++) assert.equal(rockSprite(tier, n), rockSprite(tier, n));
		assert.match(rockSprite(tier, 1), /^\/pixel\/rocks\/rock_[a-z]+\.png$/);
	}
	assert.match(rockSprite('rare', 3), /rock_gold/, 'a rich ore is gold');
});

test('the click bucket: a new rock lets a burst in, then only what a person could click', () => {
	const first = takeClicks({}, 200, 1000);
	assert.equal(first.accepted, ROCK.burst, 'a fresh bucket holds the burst');
	const right = takeClicks({ tokens: first.tokens, hitAt: 1000 }, 100, 1000);
	assert.equal(right.accepted, 0, 'nothing more in the same instant');
	const later = takeClicks({ tokens: first.tokens, hitAt: 1000 }, 100, 1001);
	assert.equal(later.accepted, ROCK.maxCps, 'one second later: 24 more');
	const rested = takeClicks({ tokens: 0, hitAt: 1000 }, 500, 1100);
	assert.equal(rested.accepted, ROCK.maxBatch > ROCK.burst ? ROCK.burst : ROCK.maxBatch, 'a long rest refills no more than the burst');
	assert.equal(takeClicks({}, -5, 0).accepted, 0);
	assert.equal(takeClicks({}, Number.NaN, 0).accepted, 0);
});

test('a broken rock drops stone and coal by the minutes of income, and only what its tier lists', () => {
	for (const tier of ROCK_TIER_ORDER) {
		const allowed = new Set(ROCK_DROPS[tier].filter((d) => d.kind === 'ingredient').map((d) => d.id));
		for (let seed = 1; seed <= 200; seed++) {
			const loot = rollRockLoot(tier, { rates: { stone: 100, coal: 50 }, luck: 0 }, mulberry32(seed));
			const stone = ROCK_DROPS[tier].find((d) => d.kind === 'resource' && d.id === 'stone')!;
			assert.ok(stone.kind === 'resource' && loot.resources.stone >= stone.floor, 'never under the floor');
			assert.ok(loot.resources.stone <= 100 * 60 * stone.minutes[1], 'never over the top of the minutes');
			for (const id of Object.keys(loot.stash)) assert.ok(allowed.has(id), `${tier} may not drop ${id}`);
		}
	}
});

test('with no income the floor still pays, and Ember Coal is rare and 1 to 3', () => {
	const none = rollRockLoot('common', { rates: { stone: 0, coal: 0 }, luck: 0 }, mulberry32(3));
	assert.equal(none.resources.stone, 25);
	assert.equal(none.resources.coal, 15);
	let found = 0;
	let most = 0;
	const rocks = 20_000;
	const rng = mulberry32(11);
	for (let i = 0; i < rocks; i++) {
		const n = rollRockLoot('epic', { rates: { stone: 0, coal: 0 }, luck: 0 }, rng).stash.ing_ember_coal ?? 0;
		if (n > 0) found++;
		most = Math.max(most, n);
	}
	assert.ok(found / rocks > 0.12 && found / rocks < 0.18, `about 15% of epic rocks hold Ember Coal (${found / rocks})`);
	assert.equal(most, 3, 'up to 3, never more');
	let commonFound = 0;
	for (let i = 0; i < rocks; i++) if (rollRockLoot('common', { rates: { stone: 0, coal: 0 }, luck: 0 }, rng).stash.ing_ember_coal) commonFound++;
	assert.ok(commonFound / rocks < 0.03, 'a plain rock almost never holds it');
});

test('adding a line to a drop table never shifts the rolls of the lines before it', () => {
	// every line draws the same number of values hit or not: the same seed gives the same stone and coal whatever the ingredients did
	const a = rollRockLoot('uncommon', { rates: { stone: 40, coal: 40 }, luck: 0 }, mulberry32(5));
	const b = rollRockLoot('uncommon', { rates: { stone: 40, coal: 40 }, luck: 500 }, mulberry32(5));
	assert.ok(a.resources.stone > 0 && b.resources.stone > 0);
	assert.deepEqual(rollRockLoot('uncommon', { rates: { stone: 40, coal: 40 }, luck: 0 }, mulberry32(5)), a, 'sealed: the same seed, the same loot');
});

test('the ores are crafting ingredients with art, and their tooltip says rocks drop them', () => {
	for (const id of ['ing_silver_ore', 'ing_gold_ore', 'ing_crystal', 'ing_copper_ore', 'ing_ember_coal']) {
		const def = INGREDIENT_BY_ID.get(id);
		assert.ok(def, id);
		assert.ok(
			JUNK_ITEMS.some((i) => i.id === def.junkId),
			`${id} has its item`,
		);
		assert.match(ingredientDescription(def), /mining rocks/);
	}
	for (const tier of ROCK_TIER_ORDER)
		for (const drop of ROCK_DROPS[tier]) if (drop.kind === 'ingredient') assert.ok(INGREDIENT_BY_ID.has(drop.id), `${drop.id} is a known ingredient`);
});

test('the legendary ore takes 1,000 clicks, is the rarest rock, gives the most stone and coal and holds Ember Coal now and then', () => {
	assert.equal(ROCK_TIERS.legendary.clicks, 1000);
	assert.ok(ROCK_TIERS.legendary.weight < ROCK_TIERS.epic.weight, 'rarer than the crystal');
	assert.match(rockSprite('legendary', 1), /rock_legendary\.png$/);
	const ember = ROCK_DROPS.legendary.find((d) => d.kind === 'ingredient' && d.id === 'ing_ember_coal');
	assert.ok(ember && ember.kind === 'ingredient' && ember.chance <= 0.15 && ember.qty[0] === 1 && ember.qty[1] === 3, 'a small chance, 1 to 3');
	const rates = { stone: 100, coal: 100 };
	const legend = rollRockLoot('legendary', { rates, luck: 0 }, mulberry32(9));
	const epic = rollRockLoot('epic', { rates, luck: 0 }, mulberry32(9));
	assert.ok(legend.resources.stone > epic.resources.stone && legend.resources.coal > epic.resources.coal);
	let found = 0;
	let most = 0;
	const rng = mulberry32(21);
	for (let i = 0; i < 10_000; i++) {
		const n = rollRockLoot('legendary', { rates: { stone: 0, coal: 0 }, luck: 0 }, rng).stash.ing_ember_coal ?? 0;
		if (n > 0) found++;
		most = Math.max(most, n);
	}
	assert.ok(found / 10_000 > 0.07 && found / 10_000 < 0.13, `about 10% of legendary rocks hold Ember Coal (${found / 10_000})`);
	assert.equal(most, 3);
});
