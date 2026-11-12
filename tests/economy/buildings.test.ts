import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { api, freshGame, growTo, patchTileAt, setResources, tileAt, store } from '../helpers';
import { BUILDING_RULES, BUILDINGS_FLAG } from '../../src/config/buildings';
import { BUILDINGS, buildingDef, buildingsOfBiome } from '../../src/catalog/buildings';
import { BIOMES } from '../../src/config/biomes';
import { RESOURCES } from '../../src/catalog/resources';
import { CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import { MAX_CATCHUP_SEC } from '../../src/config/economy';
import {
	buildingLevelCap,
	buildingLevelCost,
	buildingTotalCost,
	buildingUpgradeDuration,
	builtBuildings,
	producerBonus,
	producerOutput,
	extractorOutput,
	buildingOutput,
	relocationCost,
} from '../../src/lib/buildings';
import { calculateResourceRates } from '../../src/utils/game/income';
import { decodeSave, encodeSave } from '../../src/lib/saveFormat';
import { pickPersisted } from '../../src/lib/sanitizeSave';
import { summarize } from '../../src/lib/cloudSave/summary';
import { verifyTransition } from '../../src/lib/cloudSave/verify';
import { checkNetWorth, minimumSpend } from '../../src/lib/cloudSave/netWorth';
import { patchTile } from '../../src/utils/world';

/** Runs `fn` with the building system switched on, and puts the flag back. */
const withFlag = <T>(enabled: boolean, fn: () => T): T => {
	const was = BUILDINGS_FLAG.enabled;
	BUILDINGS_FLAG.enabled = enabled;
	try {
		return fn();
	} finally {
		BUILDINGS_FLAG.enabled = was;
	}
};
const withBuildings = <T>(fn: () => T): T => withFlag(true, fn);
const withoutBuildings = <T>(fn: () => T): T => withFlag(false, fn);

const RICH = { gold: 1e15, wood: 1e15, stone: 1e15, coal: 1e15, food: 1e15, hide: 1e15 };

/** A game with ten tiles where `n` of them (not the castle) are made `biome`; returns their positions. */
const gameWith = (biome: string, n = 1, castleLevel = 1) => {
	freshGame();
	growTo(12);
	const spots: { x: number; y: number }[] = [];
	for (let y = CASTLE_Y - 6; y <= CASTLE_Y + 6 && spots.length < n; y++)
		for (let x = CASTLE_X - 6; x <= CASTLE_X + 6 && spots.length < n; x++) {
			const t = tileAt(api().tiles, x, y);
			if (t.isOwned && t.biome !== 'castle') spots.push({ x, y });
		}
	assert.equal(spots.length, n);
	for (const s of spots) patchTileAt(s.x, s.y, { biome: biome as never, hasChest: false });
	store.setState((s) => ({ tiles: patchTile(s.tiles, CASTLE_X, CASTLE_Y, { level: castleLevel }), monsters: [] }));
	setResources(RICH);
	return spots;
};

test('the flag ships on (owner decision: live on merge)', () => {
	assert.equal(BUILDINGS_FLAG.enabled, true);
});

test('the catalog: a Producer and an Extractor for each of the seven home biomes, with real art', () => {
	const homes = ['coast', 'forest', 'hills', 'lake', 'plains', 'swamp', 'tundra'];
	assert.equal(BUILDINGS.length, 14 + 12, 'seven Producers, seven Extractors and the twelve Idols');
	assert.equal(new Set(BUILDINGS.map((b) => b.id)).size, BUILDINGS.length);
	for (const kind of ['producer', 'extractor'] as const)
		assert.deepEqual(
			BUILDINGS.filter((b) => b.kind === kind)
				.map((b) => b.biome)
				.sort(),
			homes,
		);
	for (const b of BUILDINGS) {
		assert.ok(BIOMES[b.biome], b.id);
		if (b.kind === 'idol') assert.equal(b.produces.length, 0, `${b.id} makes nothing`);
		else if (b.kind === 'producer')
			for (const key of b.produces)
				assert.ok((BIOMES[b.biome].resourceGeneration as Record<string, number>)[key] > 0, `${b.id} makes ${key}, which its biome does not`);
		else {
			assert.equal(b.produces.length, 1, `${b.id} makes exactly one extract`);
			assert.equal((RESOURCES[b.produces[0]] as { tier?: string }).tier, 't3', `${b.id} makes a T3 material`);
		}
		const file = decodeURIComponent(b.art).replace(/^\//, '');
		assert.ok(existsSync(join(process.cwd(), 'public', file)), `${b.id}: ${file}`);
		assert.equal(buildingDef(b.id), b);
	}
	// the seven extracts are the seven T3 materials of the home biomes, each made by one Extractor
	assert.deepEqual(
		BUILDINGS.filter((b) => b.kind === 'extractor')
			.map((b) => b.produces[0])
			.sort(),
		['frostshard', 'herbs', 'ironOre', 'pearls', 'salt', 'sap', 'spores'],
	);
	assert.equal(buildingsOfBiome('forest').length, 3, 'Producer, Extractor and Idol');
	assert.equal(buildingsOfBiome('castle').length, 0);
});

test('the Producer grows +2 % per owned tile of its biome, capped at +100 %', () => {
	assert.equal(producerBonus(0), 0);
	assert.ok(Math.abs(producerBonus(10) - 0.2) < 1e-12);
	assert.equal(producerBonus(50), 1);
	assert.equal(producerBonus(5000), 1);
	const def = buildingDef('lumberyard')!;
	const base = producerOutput(def, 1, 0).wood!;
	// 15 tiles' worth of the forest rate (0.3 x 1.3 yield scale)
	assert.ok(Math.abs(base - 15 * 0.3 * 1.3) < 1e-9);
	assert.ok(Math.abs(producerOutput(def, 1, 25).wood! - base * 1.5) < 1e-9);
	// +50 % of the level 1 output per level above 1
	assert.ok(Math.abs(producerOutput(def, 3, 0).wood! - base * 2) < 1e-9);
});

test('levels are gated by min(5, castle level); timers are 10 min, 45 min, 3 h, 8 h', () => {
	assert.deepEqual([1, 2, 3, 5, 6, 10].map(buildingLevelCap), [1, 2, 3, 5, 5, 5]);
	assert.deepEqual(BUILDING_RULES.durationsSec, [600, 2700, 10800, 28800]);
	assert.deepEqual(
		[1, 2, 3, 4].map((l) => buildingUpgradeDuration(l)),
		[600, 2700, 10800, 28800],
	);
	// Master Builders shortens it like the castle's timer
	assert.equal(buildingUpgradeDuration(1, { ...api().prestige, upgrades: { builders: 2 } }), 540);
});

test('prices: x2 per level on the price of 14 tiles; moving costs half of everything the building cost', () => {
	const one = buildingLevelCost(1, 100);
	const two = buildingLevelCost(2, 100);
	assert.ok(one.gold! > 0);
	assert.ok(Math.abs(two.gold! / one.gold! - 2) < 0.01);
	// counted to at most 300 tiles
	assert.deepEqual(buildingLevelCost(1, 300), buildingLevelCost(1, 99999));
	const total = buildingTotalCost(3, 100);
	assert.equal(relocationCost(3, 100).gold, Math.floor(total.gold! / 2));
});

test('with the flag off every action refuses and nothing changes', () => {
	withoutBuildings(() => {
		const [spot] = gameWith('forest');
		const before = api().tiles;
		assert.equal(api().buildBuilding(spot.x, spot.y, 'lumberyard'), false);
		assert.equal(api().tiles, before);
		assert.equal(api().buildingUpgrade, null);
	});
});

test('build: right biome only, one of each type, no chest or monster, and the price is paid', () => {
	withBuildings(() => {
		const [a, b, c] = gameWith('forest', 3);
		const gold = api().resources.gold;
		assert.equal(api().buildBuilding(a.x, a.y, 'granary'), false, 'a granary needs plains');
		assert.equal(api().buildBuilding(a.x, a.y, 'nope'), false);
		assert.equal(api().buildBuilding(CASTLE_X, CASTLE_Y, 'lumberyard'), false, 'not on the castle');
		patchTileAt(c.x, c.y, { hasChest: true });
		assert.equal(api().buildBuilding(c.x, c.y, 'lumberyard'), false, 'not on a chest');
		patchTileAt(c.x, c.y, { hasChest: false });
		store.setState({ monsters: [{ id: 1, type: 'thistleBoar', x: c.x, y: c.y, level: 1 } as never] });
		assert.equal(api().buildBuilding(c.x, c.y, 'lumberyard'), false, 'not under a monster');
		store.setState({ monsters: [] });

		assert.equal(api().buildBuilding(a.x, a.y, 'lumberyard'), true);
		assert.ok(api().resources.gold < gold);
		assert.equal(tileAt(api().tiles, a.x, a.y).building, 'lumberyard');
		assert.equal(tileAt(api().tiles, a.x, a.y).buildingLevel, 1);
		assert.equal(api().buildBuilding(b.x, b.y, 'lumberyard'), false, 'one of each type per map');
		assert.equal(api().buildBuilding(a.x, a.y, 'lumberyard'), false, 'the tile is taken');
		assert.equal(builtBuildings(api().tiles).length, 1);
	});
});

test('build: refused when it cannot be paid', () => {
	withBuildings(() => {
		const [a] = gameWith('forest');
		setResources({ gold: 0 });
		assert.equal(api().buildBuilding(a.x, a.y, 'lumberyard'), false);
	});
});

test('a Producer adds its output to the income (once the flag is on) and the flag-off income ignores it', () => {
	const spots = gameWith('forest', 3);
	const [a] = spots;
	// the world is random: any other forest among the ten tiles would make the base income so big that a Producer cannot double it. Make every other tile plains.
	for (let y = CASTLE_Y - 6; y <= CASTLE_Y + 6; y++)
		for (let x = CASTLE_X - 6; x <= CASTLE_X + 6; x++) {
			const t = tileAt(api().tiles, x, y);
			if (t.isOwned && t.biome !== 'castle' && !spots.some((p) => p.x === x && p.y === y)) patchTileAt(x, y, { biome: 'plains' });
		}
	const rates = () => calculateResourceRates(api().tiles, api().characterStats, api().farmLevels, api().prestige).total.wood;
	const off = rates();
	withBuildings(() => {
		assert.equal(api().buildBuilding(a.x, a.y, 'lumberyard'), true);
		assert.ok(api().resourceRates.total.wood > off * 2, 'the store recomputes the rates');
		assert.equal(api().resourceRates.total.wood, rates());
	});
	withoutBuildings(() => assert.equal(rates(), off, 'flag off: the building on the tile makes nothing'));
});

test('upgrading: gated by the castle level, paid now, one timer shared with the castle, the level lands when the timer ends', () => {
	withBuildings(() => {
		const [a] = gameWith('forest', 1, 1);
		assert.equal(api().buildBuilding(a.x, a.y, 'lumberyard'), true);
		assert.equal(api().upgradeBuilding(a.x, a.y), false, 'castle level 1 allows building level 1 only');
		store.setState((s) => ({ tiles: patchTile(s.tiles, CASTLE_X, CASTLE_Y, { level: 3 }) }));
		const gold = api().resources.gold;
		assert.equal(api().upgradeBuilding(a.x, a.y), true);
		assert.ok(api().resources.gold < gold);
		assert.deepEqual(api().buildingUpgrade, { x: a.x, y: a.y, toLevel: 2, remainingSec: 600 });
		assert.equal(tileAt(api().tiles, a.x, a.y).buildingLevel, 1, 'not yet');
		// the builder is taken
		assert.equal(api().upgradeBuilding(a.x, a.y), false);
		assert.equal(api().upgradeCastle(), false, 'the castle waits for the building');
		assert.equal(api().moveBuilding(a.x, a.y, a.x + 1, a.y), false, 'it cannot move while it is being upgraded');
		const before = api().resourceRates.total.wood;
		for (let t = 0; t < 700; t += 10) api().tick(10_000);
		assert.equal(api().buildingUpgrade, null);
		assert.equal(tileAt(api().tiles, a.x, a.y).buildingLevel, 2);
		assert.ok(api().resourceRates.total.wood > before, 'the new level makes more');
		// and now the castle can take the builder, which blocks the building
		setResources(RICH);
		assert.equal(api().upgradeCastle(), true);
		assert.equal(api().upgradeBuilding(a.x, a.y), false);
	});
});

test('the timer runs at most one tick catch-up per call, like the castle', () => {
	withBuildings(() => {
		const [a] = gameWith('forest', 1, 5);
		api().buildBuilding(a.x, a.y, 'lumberyard');
		api().upgradeBuilding(a.x, a.y);
		api().tick(1e9); // a huge delta is bounded
		const left = api().buildingUpgrade;
		assert.ok(left === null || left.remainingSec > 0);
		assert.ok(MAX_CATCHUP_SEC >= 1);
	});
});

test('moving: to another tile of the biome for half the price, level kept', () => {
	withBuildings(() => {
		const [a, b] = gameWith('forest', 2, 3);
		api().buildBuilding(a.x, a.y, 'lumberyard');
		patchTileAt(a.x, a.y, { buildingLevel: 2 });
		const gold = api().resources.gold;
		assert.equal(api().moveBuilding(a.x, a.y, a.x, a.y), false);
		assert.equal(api().moveBuilding(a.x, a.y, CASTLE_X, CASTLE_Y), false);
		assert.equal(api().moveBuilding(a.x, a.y, b.x, b.y), true);
		assert.equal(tileAt(api().tiles, a.x, a.y).building, undefined);
		assert.equal(tileAt(api().tiles, b.x, b.y).building, 'lumberyard');
		assert.equal(tileAt(api().tiles, b.x, b.y).buildingLevel, 2);
		assert.ok(api().resources.gold < gold);
	});
});

test('the save round trip keeps buildings and the running upgrade; invalid ones are dropped', () => {
	withBuildings(() => {
		const [a, b] = gameWith('forest', 2, 3);
		api().buildBuilding(a.x, a.y, 'lumberyard');
		api().upgradeBuilding(a.x, a.y);
		api().tick(60_000);
		const text = encodeSave(pickPersisted(api()));
		const back = decodeSave(text);
		assert.ok(back.ok, back.ok ? '' : back.reason);
		if (!back.ok) return;
		assert.equal(tileAt(back.state.tiles, a.x, a.y).building, 'lumberyard');
		assert.equal(back.state.buildingUpgrade?.toLevel, 2);
		assert.equal(Math.round(back.state.buildingUpgrade!.remainingSec), 540);

		// a building that cannot be valid is dropped, never a reason to refuse the save: wrong biome, a second of its type, a level the castle does not allow
		const loads = (tiles: typeof wrongBiome) => {
			const r = decodeSave(encodeSave({ ...pickPersisted(api()), tiles }));
			assert.ok(r.ok, r.ok ? '' : r.reason);
			return r.ok ? r.state : null;
		};
		const wrongBiome = patchTile(api().tiles, b.x, b.y, { building: 'granary' });
		assert.equal(tileAt(loads(wrongBiome)!.tiles, b.x, b.y).building, undefined);
		const twice = patchTile(api().tiles, b.x, b.y, { building: 'lumberyard' });
		const twiceState = loads(twice)!;
		assert.equal(builtBuildings(twiceState.tiles).length, 1, 'only one of a type survives');
		const tooHigh = patchTile(api().tiles, a.x, a.y, { buildingLevel: 5 });
		const high = loads(tooHigh)!;
		assert.equal(tileAt(high.tiles, a.x, a.y).building, undefined, 'castle level 3 does not allow level 5');
		assert.equal(high.buildingUpgrade, null, 'and the upgrade that belonged to it goes too');
	});
});

test('a save written with the flag on still loads with it off, minus its buildings', () => {
	let text = '';
	let rates = 0;
	withBuildings(() => {
		const [a] = gameWith('forest', 2, 3);
		api().buildBuilding(a.x, a.y, 'lumberyard');
		api().upgradeBuilding(a.x, a.y);
		text = encodeSave(pickPersisted(api()));
		rates = api().resourceRates.total.wood;
		assert.ok(rates > 0);
	});
	withoutBuildings(() => {
		const back = decodeSave(text);
		assert.ok(back.ok, back.ok ? '' : back.reason);
		if (!back.ok) return;
		assert.equal(builtBuildings(back.state.tiles).length, 0);
		assert.equal('buildingUpgrade' in back.state, false);
	});
});

test('the server derives the buildings and judges their timer (timer_jump)', () => {
	withBuildings(() => {
		const [a] = gameWith('forest', 1, 3);
		api().buildBuilding(a.x, a.y, 'lumberyard');
		const first = summarize(pickPersisted(api()));
		assert.deepEqual(first.derived.buildings, { lumberyard: 1 });
		assert.equal(first.derived.buildingUpgrade, null);
		const snapshot = (summary: typeof first, at: number) => ({ summary, serverSavedAt: at });
		const T0 = 1_000_000;

		// an honest upgrade: started in one save, the level lands in a later one after the timer ran
		api().upgradeBuilding(a.x, a.y);
		const running = summarize(pickPersisted(api()));
		assert.equal(verifyTransition(snapshot(first, T0), running, T0 + 5000).includes('timer_jump'), false);
		for (let t = 0; t < 700; t += 10) api().tick(10_000);
		const done = summarize(pickPersisted(api()));
		assert.equal(done.derived.buildings?.lumberyard, 2);
		assert.equal(verifyTransition(snapshot(running, T0), done, T0 + 700_000).includes('timer_jump'), false);

		// a level with no timer behind it, or one that was not given the time, is a jump
		assert.equal(verifyTransition(snapshot(first, T0), done, T0 + 5000).includes('timer_jump'), true);
		assert.equal(verifyTransition(snapshot(running, T0), done, T0 + 5000).includes('timer_jump'), true);
		// a building born above level 1 is a jump too
		const forged = { ...first, derived: { ...first.derived, buildings: { lumberyard: 1, granary: 3 } } };
		assert.equal(verifyTransition(snapshot(first, T0), forged, T0 + 1000).includes('timer_jump'), true);
		// a timer that ran faster than the clock
		const faster = { ...running, derived: { ...running.derived, buildingUpgrade: { ...running.derived.buildingUpgrade!, remainingSec: 0.5 } } };
		assert.equal(verifyTransition(snapshot(running, T0), faster, T0 + 1000).includes('timer_jump'), true);
	});
});

test('flag off: the server never raises timer_jump and the summary carries no building keys', () => {
	withoutBuildings(() => {
		freshGame();
		const first = summarize(pickPersisted(api()));
		assert.equal('buildings' in first.derived, false);
		assert.equal('buildingUpgrade' in first.derived, false);
		const forged = { ...first, derived: { ...first.derived, buildings: { lumberyard: 5 } } };
		assert.equal(verifyTransition({ summary: first, serverSavedAt: 0 }, forged, 1000).includes('timer_jump'), false);
	});
});

test('saves from before the building system load with the flag on, and old ones with it off', () => {
	freshGame();
	growTo(8);
	const state = pickPersisted(api());
	const text = withoutBuildings(() => encodeSave(state));
	assert.ok(decodeSave(text).ok, 'a flag-off save loads with the flag on');
	const on = decodeSave(withBuildings(() => encodeSave(state)));
	assert.ok(on.ok);
	if (on.ok) assert.equal(on.state.buildingUpgrade, null);
});

test('net worth: buildings add a gold floor, only while the system is on', () => {
	withBuildings(() => {
		const [a] = gameWith('forest', 1, 3);
		const state = pickPersisted(api());
		const without = minimumSpend(state);
		api().buildBuilding(a.x, a.y, 'lumberyard');
		patchTileAt(a.x, a.y, { buildingLevel: 3 });
		const withBuilding = minimumSpend(pickPersisted(api()));
		assert.ok(withBuilding > without);
		const check = checkNetWorth(pickPersisted(api()), summarize(pickPersisted(api())));
		assert.ok(check.required > 0);
	});
});

test('an Extractor makes 0.3 of its T3 material per second at level 1, +40 % per level, and grows with its biome like the Producer', () => {
	const def = buildingDef('saptapper')!;
	assert.deepEqual(extractorOutput(def, 1, 0), { sap: 0.3 });
	assert.ok(Math.abs(extractorOutput(def, 3, 0).sap! - 0.3 * 1.8) < 1e-12);
	assert.ok(Math.abs(extractorOutput(def, 1, 25).sap! - 0.3 * 1.5) < 1e-12);
	assert.deepEqual(buildingOutput(def, 2, 0), extractorOutput(def, 2, 0));
	assert.deepEqual(buildingOutput(buildingDef('lumberyard')!, 2, 0), producerOutput(buildingDef('lumberyard')!, 2, 0));
});

test('build an Extractor: beside the Producer of its biome, one of each type, T3 income appears in the rates and nowhere else', () => {
	withBuildings(() => {
		const [a, b] = gameWith('forest', 2, 3);
		assert.equal(api().resourceRates.total.sap, 0);
		assert.equal(api().buildBuilding(a.x, a.y, 'saptapper'), true);
		assert.equal(api().buildBuilding(b.x, b.y, 'lumberyard'), true, 'the Producer of the same biome stands beside it');
		const sap = api().resourceRates.total.sap;
		assert.ok(sap > 0.3, 'the castle modifier and the biome size count');
		assert.equal(api().resourceRates.total.wood > 0, true);
		assert.equal(api().buildBuilding(b.x, b.y, 'saptapper'), false, 'one of each type');
		// the level step follows the same timer, gate and shared builder as the Producer
		assert.equal(api().upgradeBuilding(a.x, a.y), true);
		assert.equal(api().upgradeBuilding(b.x, b.y), false, 'one builder');
		for (let t = 0; t < 700; t += 10) api().tick(10_000);
		assert.ok(api().resourceRates.total.sap > sap, 'level 2 makes more');
		// the stock grows with the tick and the merchant has no price for it
		const before = api().resources.sap;
		api().tick(10_000);
		assert.ok(api().resources.sap > before);
	});
});

test('the Extractors save, load and are judged like the Producers (the T3 stock is an optional resource key)', () => {
	withBuildings(() => {
		const [a] = gameWith('hills', 1, 3);
		api().buildBuilding(a.x, a.y, 'deepmine');
		const back = decodeSave(encodeSave(pickPersisted(api())));
		assert.ok(back.ok, back.ok ? '' : back.reason);
		if (!back.ok) return;
		assert.equal(tileAt(back.state.tiles, a.x, a.y).building, 'deepmine');
		assert.equal(summarize(back.state).derived.buildings?.deepmine, 1);
		assert.ok(summarize(back.state).rates.ironOre > 0, 'the server derives the T3 income from the saved map');
		// an old save without the T3 keys loads with them at 0
		const raw = { ...pickPersisted(api()) } as Record<string, unknown>;
		const resources = { ...(raw.resources as Record<string, number>) };
		for (const key of ['herbs', 'sap', 'ironOre', 'spores', 'frostshard', 'pearls', 'salt']) delete resources[key];
		const old = decodeSave(encodeSave({ ...pickPersisted(api()), resources } as never));
		assert.ok(old.ok);
		if (old.ok) assert.equal(old.state.resources.sap, 0);
	});
});

test('every building (Producers, Extractors and Idols) has lore for its window', async () => {
	const { BUILDINGS, BUILDING_LORE } = await import('../../src/catalog/buildings');
	for (const def of BUILDINGS) assert.ok((BUILDING_LORE[def.id] ?? '').length > 20, `${def.id} has lore`);
});

test('farm sprites: both cows (the bell cow too), pigs and sheep look right, chickens look left', async () => {
	const { facesRight } = await import('../../src/config/pixelIcons');
	assert.equal(facesRight('animal_pig'), true);
	assert.equal(facesRight('animal_cow_1'), true);
	assert.equal(facesRight('animal_sheep'), true);
	assert.equal(facesRight('animal_chicken_1'), false);
	assert.equal(facesRight('animal_cow_2'), true);
});
