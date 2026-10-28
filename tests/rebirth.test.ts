import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, owned, setResources, store, tileAt, rawSnapshot } from './helpers';
import {
	CASTLE_UPGRADE,
	CLICK_LADDER,
	CASTLE_X,
	CASTLE_Y,
	INITIAL_RESOURCES,
	EMBER_UPGRADES,
	REBIRTH,
	STARTING_GEMS,
	type EmberUpgradeId,
} from '../src/config/gameConfig';
import {
	calculateBuildingCost,
	calculateTileCost,
	castleUpgradeDuration,
	effectiveTileDiscount,
	calculateLevel,
	emberGain,
	rebirthStatus,
	totalStatPoints,
	emberSpent,
	emberUpgradeCost,
} from '../src/utils/gameUtils';
import { sanitizeSave } from '../src/lib/sanitizeSave';
import { patchTile } from '../src/utils/world';

const setCastleLevel = (level: number) =>
	store.setState((s) => {
		const tiles = patchTile(s.tiles, CASTLE_X, CASTLE_Y, { level });
		return { tiles };
	});

/** A run that has reached the rebirth line. */
const readyToRebirth = (castle = REBIRTH.minCastleLevel, tiles = REBIRTH.minTiles) => {
	freshGame();
	growTo(tiles);
	setCastleLevel(castle);
};

const snapshot = () => rawSnapshot();

test('rebirth needs the castle at the minimum level and no upgrade running', () => {
	freshGame();
	growTo(REBIRTH.minTiles);
	assert.equal(api().rebirth(), false);
	setCastleLevel(REBIRTH.minCastleLevel - 1);
	assert.equal(api().rebirth(), false);
	setCastleLevel(REBIRTH.minCastleLevel);
	store.setState({ castleUpgrade: { toLevel: REBIRTH.minCastleLevel + 1, remainingSec: 100 } });
	assert.equal(api().rebirth(), false);
	store.setState({ castleUpgrade: null });
	assert.equal(api().rebirth(), true);
});

test('rebirthStatus lists what is missing, and agrees with what rebirth() does', () => {
	freshGame();
	let status = rebirthStatus(api());
	assert.equal(status.canRebirth, false);
	assert.deepEqual(status.requirements.map((r) => [r.id, r.met]), [['castle', false], ['tiles', false], ['idle', true]]);
	assert.equal(status.requirements[0].needed, REBIRTH.minCastleLevel);
	assert.equal(status.requirements[1].needed, REBIRTH.minTiles);

	growTo(REBIRTH.minTiles);
	status = rebirthStatus(api());
	assert.deepEqual(status.requirements.map((r) => r.met), [false, true, true]);
	assert.equal(status.requirements[1].current, status.ownedTiles);

	setCastleLevel(REBIRTH.minCastleLevel);
	store.setState({ castleUpgrade: { toLevel: REBIRTH.minCastleLevel + 1, remainingSec: 100 } });
	status = rebirthStatus(api());
	assert.deepEqual(status.requirements.map((r) => r.met), [true, true, false]);
	assert.equal(status.canRebirth, false);

	store.setState({ castleUpgrade: null });
	status = rebirthStatus(api());
	assert.equal(status.canRebirth, true);
	assert.equal(status.gain, emberGain(REBIRTH.minCastleLevel, status.ownedTiles));
	assert.ok(status.gain >= 1);
	assert.equal(api().rebirth(), true);
});

test('rebirth grants points by the formula, resets the run and keeps the identity', () => {
	readyToRebirth(8, REBIRTH.minTiles + 5);
	const expected = emberGain(8, owned());
	assert.ok(expected >= 1);
	store.setState({ playerName: 'Hero', playerClass: 'mage', playSeconds: 12345 });
	setResources({ gold: 777 });
	const before = { xp: api().resources.xp, stats: { ...api().characterStats }, level: api().level.level };
	assert.equal(api().rebirth(), true);

	const s = api();
	assert.deepEqual(
		{ rebirths: s.prestige.rebirths, points: s.prestige.legacyPoints, earned: s.prestige.legacyEarned },
		{ rebirths: 1, points: expected, earned: expected }
	);
	assert.equal(owned(), 9, 'a rebirth starts with the castle and its 8 free neighbours');
	assert.equal(s.freeTiles, 9);
	assert.equal(tileAt(s.tiles, CASTLE_X, CASTLE_Y).level, 1);
	assert.equal(s.clickLevel, 0);
	assert.deepEqual(s.farmLevels, {});
	// the character carries over: the XP, the level it gives, the attributes with the points still to spend
	assert.equal(s.resources.xp, before.xp);
	assert.equal(s.level.level, calculateLevel(before.xp).level);
	assert.ok(s.level.level > 1);
	assert.deepEqual(
		{ ...s.characterStats, reputation: 0 },
		{ ...before.stats, availablePoints: before.stats.availablePoints + Math.max(0, totalStatPoints(s.level.level) - totalStatPoints(before.level)), reputation: 0 }
	);
	assert.equal(s.castleUpgrade, null);
	assert.equal(s.resources.gold, INITIAL_RESOURCES.gold);
	assert.equal(s.playerName, 'Hero');
	assert.equal(s.playerClass, 'mage');
	assert.equal(s.playSeconds, 12345);
	// every resource's modifier now includes the Embers income bonus
	const base = 1 + CASTLE_UPGRADE.baseResourceMultiplier + 0.025 * 10; // castle 1 + int/cha gold
	assert.ok(Math.abs(1 + s.resourceRates.modifiers.gold - base * (1 + REBIRTH.incomePerPoint * expected)) < 1e-9);
	// and the game can be played on
	api().tick(1000);
	assert.ok(api().resources.gold > INITIAL_RESOURCES.gold);
});

test('gains grow with the castle level and the territory, and a tiny run earns nothing', () => {
	assert.ok(emberGain(10, 50) > emberGain(6, 50));
	assert.ok(emberGain(6, 80) > emberGain(6, 20));
	assert.equal(emberGain(5, 100), 0);
	freshGame();
	setCastleLevel(REBIRTH.minCastleLevel);
	assert.equal(api().rebirth(), false); // 1 tile
	growTo(REBIRTH.minTiles - 1);
	assert.equal(api().rebirth(), false); // still too little territory
	growTo(REBIRTH.minTiles);
	assert.equal(api().rebirth(), true);
});

test('the shop: cost curve, max level, not enough points, validated ids', () => {
	freshGame();
	assert.equal(api().buyEmberUpgrade('thrift'), false);
	store.setState((s) => ({ prestige: { ...s.prestige, rebirths: 1, legacyPoints: 1000, legacyEarned: 1000 } }));
	assert.equal(api().buyEmberUpgrade('nonsense' as EmberUpgradeId), false);
	for (const id of Object.keys(EMBER_UPGRADES) as EmberUpgradeId[]) {
		const before = api().prestige.legacyPoints;
		assert.equal(api().buyEmberUpgrade(id), true);
		assert.equal(before - api().prestige.legacyPoints, emberUpgradeCost(id, 0));
	}
	for (let i = 0; i < 20; i++) api().buyEmberUpgrade('thrift');
	assert.equal(api().prestige.upgrades.thrift, EMBER_UPGRADES.thrift.maxLevel);
	// points are conserved
	assert.equal(api().prestige.legacyPoints + emberSpent(api().prestige.upgrades), api().prestige.legacyEarned);
	assert.ok(emberUpgradeCost('thrift', 5) > emberUpgradeCost('thrift', 0));
});

test('shop effects: thrift, master builders, click mastery, provisions', () => {
	freshGame();
	store.setState((s) => ({ prestige: { ...s.prestige, rebirths: 1, legacyPoints: 500, legacyEarned: 500 } }));
	growTo(REBIRTH.minTiles);
	const tileBefore = calculateTileCost(owned(), effectiveTileDiscount(api().characterStats, api().prestige)).gold;
	const buildingBefore = calculateBuildingCost(api().tiles, api().prestige).gold!;
	const durationBefore = castleUpgradeDuration(1, api().prestige);
	setResources({ gold: 0 });
	const clickBefore = api().clickForGold({ eventId: 1, now: 0, trusted: true });

	for (let i = 0; i < 3; i++) {
		api().buyEmberUpgrade('thrift');
		api().buyEmberUpgrade('builders');
		api().buyEmberUpgrade('mastery');
		api().buyEmberUpgrade('provisions');
	}
	const p = api().prestige;
	assert.ok(calculateTileCost(owned(), effectiveTileDiscount(api().characterStats, p)).gold < tileBefore);
	assert.ok(calculateBuildingCost(api().tiles, p).gold! < buildingBefore);
	assert.ok(castleUpgradeDuration(1, p) < durationBefore);
	assert.ok(
		Math.abs(castleUpgradeDuration(1, p) - Math.floor(durationBefore * (1 - 3 * EMBER_UPGRADES.builders.effectPerLevel))) <= 1
	);
	setResources({ gold: 0 });
	const clickAfter = api().clickForGold({ eventId: 2, now: 10_000, trusted: true });
	assert.ok(Math.abs(clickAfter / clickBefore - (1 + 3 * EMBER_UPGRADES.mastery.effectPerLevel)) < 0.05);
	assert.ok(CLICK_LADDER[0].power > 0);

	// provisions arrive with the next run
	setCastleLevel(REBIRTH.minCastleLevel);
	assert.equal(api().rebirth(), true);
	assert.equal(api().resources.gold, INITIAL_RESOURCES.gold + 3 * EMBER_UPGRADES.provisions.bundle.gold!);
	assert.equal(api().resources.wood, 3 * EMBER_UPGRADES.provisions.bundle.wood!);
});

test('thrift together with charisma can never discount more than the cap', () => {
	freshGame();
	store.setState((s) => ({
		characterStats: { ...s.characterStats, tileCostDiscount: 25 },
		prestige: { rebirths: 1, legacyPoints: 0, legacyEarned: 100, upgrades: { thrift: 10 } },
	}));
	assert.equal(effectiveTileDiscount(api().characterStats, api().prestige), REBIRTH.discountCapPercent);
});

test('a full reset (not a rebirth) wipes the Embers too', () => {
	readyToRebirth(7, REBIRTH.minTiles + 5);
	assert.equal(api().rebirth(), true);
	assert.ok(api().prestige.legacyEarned > 0);
	api().resetGame();
	assert.deepEqual(api().prestige, { rebirths: 0, legacyPoints: 0, legacyEarned: 0, upgrades: {} });
});

test('saves: prestige survives validation, forged Embers is rejected', () => {
	readyToRebirth(9, REBIRTH.minTiles + 10);
	assert.equal(api().rebirth(), true);
	api().buyEmberUpgrade('builders');
	api().buyEmberUpgrade('thrift');
	assert.equal(sanitizeSave(snapshot()).ok, true);

	const rejects = (mutate: (raw: any) => void, label: string) => { // eslint-disable-line @typescript-eslint/no-explicit-any
		const raw = snapshot();
		mutate(raw);
		assert.equal(sanitizeSave(raw).ok, false, `${label} should be rejected`);
	};
	rejects((r) => (r.prestige.legacyPoints += 1), 'free points');
	rejects((r) => (r.prestige.legacyEarned += 5), 'inflated earned points');
	rejects((r) => (r.prestige.upgrades.mastery = 4), 'shop level nobody paid for');
	rejects((r) => (r.prestige.upgrades.thrift = 99), 'level above the maximum');
	rejects((r) => (r.prestige.upgrades.hax = 1), 'unknown upgrade');
	rejects((r) => (r.prestige.rebirths = 0), 'points without a rebirth');
	rejects((r) => (r.prestige.rebirths = 999), 'more rebirths than points');
	rejects((r) => (r.prestige.legacyPoints = -1), 'negative points');
	rejects((r) => (r.prestige.legacyPoints = 1.5), 'fractional points');
	rejects((r) => (r.prestige = 'lots'), 'not an object');

	// a save from before Embers existed is still fine
	const old = snapshot();
	delete old.prestige;
	old.tiles = freshGame() && rawSnapshot().tiles;
	const reloaded = sanitizeSave({ ...rawSnapshot(), prestige: undefined });
	assert.equal(reloaded.ok, true);
	if (reloaded.ok) assert.equal(reloaded.state.prestige.legacyEarned, 0);
});

// ---- Gems: the premium currency --------------------------------------------------------------------------------

test('Gems: a new game starts with the starting purse, a rebirth keeps the balance, Embers stays separate', () => {
	readyToRebirth();
	assert.equal(api().gems, STARTING_GEMS);
	store.setState({ gems: 1234 });
	setResources({ gold: 0 });
	assert.equal(api().rebirth(), true);
	assert.equal(api().gems, 1234, 'gems are not wiped by a rebirth');
	assert.ok(api().prestige.legacyPoints > 0, 'the rebirth currency is Embers, a different balance');
});

test('Gems in saves: a save without them gets the starting purse, a saved balance is kept, junk is refused', () => {
	freshGame();
	const raw = snapshot() as Record<string, unknown>;
	delete raw.gems;
	const old = sanitizeSave(raw);
	assert.ok(old.ok && old.state.gems === STARTING_GEMS);
	const kept = sanitizeSave({ ...raw, gems: 42 });
	assert.ok(kept.ok && kept.state.gems === 42);
	for (const bad of [-1, 1.5, NaN, '1000', 1e12]) assert.equal(sanitizeSave({ ...raw, gems: bad }).ok, false, `gems ${String(bad)}`);
});
