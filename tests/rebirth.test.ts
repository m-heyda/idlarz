import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, owned, setResources, store, tileAt, rawSnapshot } from './helpers';
import {
	CASTLE_UPGRADE,
	CLICK_LADDER,
	CASTLE_X,
	CASTLE_Y,
	INITIAL_RESOURCES,
	LEGACY_UPGRADES,
	REBIRTH,
	type LegacyUpgradeId,
} from '../src/config/gameConfig';
import {
	calculateBuildingCost,
	calculateTileCost,
	castleUpgradeDuration,
	effectiveTileDiscount,
	legacyGain,
	legacySpent,
	legacyUpgradeCost,
} from '../src/utils/gameUtils';
import { sanitizeSave } from '../src/lib/sanitizeSave';
import { patchTile } from '../src/utils/world';

const setCastleLevel = (level: number) =>
	store.setState((s) => {
		const tiles = patchTile(s.tiles, CASTLE_X, CASTLE_Y, { level });
		return { tiles };
	});

/** A run that has reached the rebirth line. */
const readyToRebirth = (castle = REBIRTH.minCastleLevel, tiles = 20) => {
	freshGame();
	growTo(tiles);
	setCastleLevel(castle);
};

const snapshot = () => rawSnapshot();

test('rebirth needs the castle at the minimum level and no upgrade running', () => {
	freshGame();
	growTo(20);
	assert.equal(api().rebirth(), false);
	setCastleLevel(REBIRTH.minCastleLevel - 1);
	assert.equal(api().rebirth(), false);
	setCastleLevel(REBIRTH.minCastleLevel);
	store.setState({ castleUpgrade: { toLevel: REBIRTH.minCastleLevel + 1, remainingSec: 100 } });
	assert.equal(api().rebirth(), false);
	store.setState({ castleUpgrade: null });
	assert.equal(api().rebirth(), true);
});

test('rebirth grants points by the formula, resets the run and keeps the identity', () => {
	readyToRebirth(8, 25);
	const expected = legacyGain(8, owned());
	assert.ok(expected >= 1);
	store.setState({ playerName: 'Hero', playerClass: 'mage', playSeconds: 12345 });
	setResources({ gold: 777 });
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
	assert.equal(s.level.level, 1);
	assert.equal(s.castleUpgrade, null);
	assert.equal(s.resources.gold, INITIAL_RESOURCES.gold);
	assert.equal(s.playerName, 'Hero');
	assert.equal(s.playerClass, 'mage');
	assert.equal(s.playSeconds, 12345);
	// every resource's modifier now includes the Legacy income bonus
	const base = 1 + CASTLE_UPGRADE.baseResourceMultiplier + 0.025 * 10; // castle 1 + int/cha gold
	assert.ok(Math.abs(1 + s.resourceRates.modifiers.gold - base * (1 + REBIRTH.incomePerPoint * expected)) < 1e-9);
	// and the game can be played on
	api().tick(1000);
	assert.ok(api().resources.gold > INITIAL_RESOURCES.gold);
});

test('gains grow with the castle level and the territory, and a tiny run earns nothing', () => {
	assert.ok(legacyGain(10, 50) > legacyGain(6, 50));
	assert.ok(legacyGain(6, 80) > legacyGain(6, 20));
	assert.equal(legacyGain(5, 100), 0);
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
	assert.equal(api().buyLegacyUpgrade('thrift'), false);
	store.setState((s) => ({ prestige: { ...s.prestige, rebirths: 1, legacyPoints: 1000, legacyEarned: 1000 } }));
	assert.equal(api().buyLegacyUpgrade('nonsense' as LegacyUpgradeId), false);
	for (const id of Object.keys(LEGACY_UPGRADES) as LegacyUpgradeId[]) {
		const before = api().prestige.legacyPoints;
		assert.equal(api().buyLegacyUpgrade(id), true);
		assert.equal(before - api().prestige.legacyPoints, legacyUpgradeCost(id, 0));
	}
	for (let i = 0; i < 20; i++) api().buyLegacyUpgrade('thrift');
	assert.equal(api().prestige.upgrades.thrift, LEGACY_UPGRADES.thrift.maxLevel);
	// points are conserved
	assert.equal(api().prestige.legacyPoints + legacySpent(api().prestige.upgrades), api().prestige.legacyEarned);
	assert.ok(legacyUpgradeCost('thrift', 5) > legacyUpgradeCost('thrift', 0));
});

test('shop effects: thrift, master builders, click mastery, provisions', () => {
	freshGame();
	store.setState((s) => ({ prestige: { ...s.prestige, rebirths: 1, legacyPoints: 500, legacyEarned: 500 } }));
	growTo(20);
	const tileBefore = calculateTileCost(owned(), effectiveTileDiscount(api().characterStats, api().prestige)).gold;
	const buildingBefore = calculateBuildingCost(api().tiles, api().prestige).gold!;
	const durationBefore = castleUpgradeDuration(1, api().prestige);
	setResources({ gold: 0 });
	const clickBefore = api().clickForGold({ eventId: 1, now: 0, trusted: true });

	for (let i = 0; i < 3; i++) {
		api().buyLegacyUpgrade('thrift');
		api().buyLegacyUpgrade('builders');
		api().buyLegacyUpgrade('mastery');
		api().buyLegacyUpgrade('provisions');
	}
	const p = api().prestige;
	assert.ok(calculateTileCost(owned(), effectiveTileDiscount(api().characterStats, p)).gold < tileBefore);
	assert.ok(calculateBuildingCost(api().tiles, p).gold! < buildingBefore);
	assert.ok(castleUpgradeDuration(1, p) < durationBefore);
	assert.ok(
		Math.abs(castleUpgradeDuration(1, p) - Math.floor(durationBefore * (1 - 3 * LEGACY_UPGRADES.builders.effectPerLevel))) <= 1
	);
	setResources({ gold: 0 });
	const clickAfter = api().clickForGold({ eventId: 2, now: 10_000, trusted: true });
	assert.ok(Math.abs(clickAfter / clickBefore - (1 + 3 * LEGACY_UPGRADES.mastery.effectPerLevel)) < 0.05);
	assert.ok(CLICK_LADDER[0].power > 0);

	// provisions arrive with the next run
	setCastleLevel(REBIRTH.minCastleLevel);
	assert.equal(api().rebirth(), true);
	assert.equal(api().resources.gold, INITIAL_RESOURCES.gold + 3 * LEGACY_UPGRADES.provisions.bundle.gold!);
	assert.equal(api().resources.wood, 3 * LEGACY_UPGRADES.provisions.bundle.wood!);
});

test('thrift together with charisma can never discount more than the cap', () => {
	freshGame();
	store.setState((s) => ({
		characterStats: { ...s.characterStats, tileCostDiscount: 25 },
		prestige: { rebirths: 1, legacyPoints: 0, legacyEarned: 100, upgrades: { thrift: 10 } },
	}));
	assert.equal(effectiveTileDiscount(api().characterStats, api().prestige), REBIRTH.discountCapPercent);
});

test('a full reset (not a rebirth) wipes the Legacy too', () => {
	readyToRebirth(7, 25);
	assert.equal(api().rebirth(), true);
	assert.ok(api().prestige.legacyEarned > 0);
	api().resetGame();
	assert.deepEqual(api().prestige, { rebirths: 0, legacyPoints: 0, legacyEarned: 0, upgrades: {} });
});

test('saves: prestige survives validation, forged Legacy is rejected', () => {
	readyToRebirth(9, 30);
	assert.equal(api().rebirth(), true);
	api().buyLegacyUpgrade('builders');
	api().buyLegacyUpgrade('thrift');
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

	// a save from before Legacy existed is still fine
	const old = snapshot();
	delete old.prestige;
	old.tiles = freshGame() && rawSnapshot().tiles;
	const reloaded = sanitizeSave({ ...rawSnapshot(), prestige: undefined });
	assert.equal(reloaded.ok, true);
	if (reloaded.ok) assert.equal(reloaded.state.prestige.legacyEarned, 0);
});
