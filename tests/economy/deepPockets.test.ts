import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, rawSnapshot, store } from '../helpers';
import { CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import { HARD_LIMITS, LIMITS } from '../../src/config/limits';
import { MERCHANT_UPGRADES } from '../../src/config/merchant';
import { EMBER_UPGRADES, REBIRTH } from '../../src/config/rebirth';
import { limitOf } from '../../src/lib/limits';
import { rebirthKit } from '../../src/lib/inventory';
import { fitInventory, inventoryFromCore, rebirthInventory, stampInventory } from '../../src/lib/offline/inventory';
import { sanitizeSave } from '../../src/lib/sanitizeSave';
import { patchTile } from '../../src/utils/world';
import type { PrestigeState } from '../../src/types/game';

const prestige = (deeppockets: number): PrestigeState => ({ rebirths: 1, legacyPoints: 0, legacyEarned: 0, upgrades: { deeppockets } });

test('bag size: base 60, Pack Rat +8 x 6, Deep Pockets +4 x 3, all through limitOf with a ceiling', () => {
	assert.equal(LIMITS.bagSize, 60);
	assert.equal(MERCHANT_UPGRADES.packrat.maxLevel, 6);
	assert.equal(limitOf('bagSize', { merchantUpgrades: { packrat: 6 } }), 108);
	assert.equal(limitOf('bagSize', { prestige: prestige(3) }), 72);
	assert.equal(limitOf('bagSize', { merchantUpgrades: { packrat: 6 }, prestige: prestige(3) }), 120);
	assert.equal(limitOf('bagSize', { hardCap: true }), HARD_LIMITS.bagSize);
	assert.ok(120 < HARD_LIMITS.bagSize, 'room is left for the belt slots');
});

test('an old 36-slot bag is padded to the new base, not cut; a forged bag above the ceiling is refused', () => {
	freshGame();
	const raw = rawSnapshot();
	const items = raw.bag.slice(0, 36);
	raw.bag = items;
	const padded = sanitizeSave(raw);
	assert.equal(padded.ok, true, padded.ok ? '' : padded.reason);
	if (padded.ok) {
		assert.equal(padded.state.bag.length, LIMITS.bagSize);
		assert.deepEqual(padded.state.bag.slice(0, 36), items);
	}
	const forged = rawSnapshot();
	forged.bag = Array.from({ length: HARD_LIMITS.bagSize + 1 }, () => null);
	assert.equal(sanitizeSave(forged).ok, false);
	const atCeiling = rawSnapshot();
	atCeiling.bag = Array.from({ length: HARD_LIMITS.bagSize }, () => null);
	assert.equal(sanitizeSave(atCeiling).ok, true);
});

test('buying Deep Pockets adds its slots at once, survives a save and a rebirth', () => {
	freshGame({ gold: 1e12 });
	growTo(REBIRTH.minTiles);
	store.setState((st) => ({
		prestige: { ...st.prestige, rebirths: 0, legacyPoints: 200, legacyEarned: 200 },
		tiles: patchTile(st.tiles, CASTLE_X, CASTLE_Y, { level: REBIRTH.minCastleLevel }),
	}));
	const base = api().bag.length;
	for (let level = 1; level <= EMBER_UPGRADES.deeppockets.maxLevel; level++) {
		assert.equal(api().buyEmberUpgrade('deeppockets'), true);
		assert.equal(api().bag.length, base + level * EMBER_UPGRADES.deeppockets.effectPerLevel);
	}
	assert.equal(api().buyEmberUpgrade('deeppockets'), false, 'three levels only');
	const size = api().bag.length;

	assert.equal(api().rebirth(), true);
	assert.equal(api().bag.length, size, 'and a rebirth');

	const saved = sanitizeSave(rawSnapshot());
	assert.equal(saved.ok, true, saved.ok ? '' : saved.reason);
	if (saved.ok) assert.equal(saved.state.bag.length, size, 'a purchased slot survives a save (after the rebirth too)');

	assert.equal(api().prestige.upgrades.deeppockets, 3);
});

test('the server sizes the bag from Pack Rat and Deep Pockets: fit, stamp and rebirth never cut', () => {
	const core = { merchantUpgrades: { packrat: 1 }, prestige: prestige(2), bag: [] } as unknown as Record<string, unknown>;
	const inv = inventoryFromCore(core);
	const size = LIMITS.bagSize + 8 + 8;
	assert.equal(inv.bag.length, size);
	// a Deep Pockets level bought later grows the stored bag
	const more = fitInventory(inv, { ...core, prestige: prestige(3) });
	assert.equal(more.bag.length, size + 4);
	assert.ok(more.ver > inv.ver);
	// a stale upload without the Embers cannot shrink it
	assert.equal(fitInventory(more, { merchantUpgrades: {} }).bag.length, size + 4);
	const stamped = stampInventory({ ...(core as object), bag: [], equipment: {}, lootPity: {}, autoSellUpTo: null } as never, more);
	assert.equal((stamped as { bag: unknown[] }).bag.length, size + 4);
	// a rebirth keeps both
	assert.equal(rebirthInventory(more, { packrat: 1 }, prestige(3)).bag.length, size + 4);
	assert.equal(rebirthKit({ packrat: 1 }, prestige(3)).bag.length, size + 4);
});
