import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, patchTileAt, setResources, tileAt, store } from '../helpers';
import { BUILDINGS_FLAG } from '../../src/config/buildings';
import { CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import { zeroResources } from '../../src/catalog/resourceKeys';
import { computeOfflineGrant, type OfflineInput } from '../../src/lib/offline/grant';
import { applyOfflineGrant } from '../../src/lib/offline/apply';
import { pickPersisted } from '../../src/lib/sanitizeSave';
import { summarize } from '../../src/lib/cloudSave/summary';
import { verifyTransition } from '../../src/lib/cloudSave/verify';
import { patchTile } from '../../src/utils/world';
import type { Resources } from '../../src/types/game';

const withBuildings = <T>(fn: () => T): T => {
	const was = BUILDINGS_FLAG.enabled;
	BUILDINGS_FLAG.enabled = true;
	try {
		return fn();
	} finally {
		BUILDINGS_FLAG.enabled = was;
	}
};

const rates = (wood: number): Resources => ({ ...zeroResources(), wood });

const input = (over: Partial<OfflineInput>): OfflineInput => ({
	rates: rates(10),
	ratesAfterCastle: null,
	castleUpgrade: null,
	buildingUpgrade: null,
	ratesAfterBuilding: null,
	xpGainPct: 0,
	gapSec: 3600,
	capSec: 8 * 3600,
	efficiency: 0.5,
	minGapSec: 300,
	...over,
});

const job = (remainingSec: number) => ({ x: 5, y: 5, toLevel: 2, remainingSec });

test('a building upgrade that finishes while away pays the old rate until then and the new one after', () => {
	// 1 h away, the timer had 600 s left: 600 s at 10/s and 3000 s at 30/s, both at 50 % efficiency
	const grant = computeOfflineGrant(input({ buildingUpgrade: job(600), ratesAfterBuilding: rates(30) }))!;
	assert.equal(grant.resources.wood, Math.floor((10 * 600 + 30 * 3000) * 0.5));
	assert.deepEqual(grant.building, { x: 5, y: 5, toLevel: 2, finished: true });
	assert.equal(grant.castle, null);
});

test('partial progress: a timer that outlasts the absence earns the old rate throughout and is not finished', () => {
	const grant = computeOfflineGrant(input({ buildingUpgrade: job(7200), ratesAfterBuilding: rates(30) }))!;
	assert.equal(grant.resources.wood, Math.floor(10 * 3600 * 0.5));
	assert.equal(grant.building?.finished, false);
});

test('the absence is capped: a timer longer than the cap does not finish, one inside it does', () => {
	assert.equal(computeOfflineGrant(input({ gapSec: 30 * 3600, buildingUpgrade: job(9 * 3600), ratesAfterBuilding: rates(30) }))!.building?.finished, false);
	assert.equal(computeOfflineGrant(input({ gapSec: 30 * 3600, buildingUpgrade: job(7 * 3600), ratesAfterBuilding: rates(30) }))!.building?.finished, true);
});

test('the shared builder: the castle upgrade wins, a building running beside it (forged) is ignored; without a castle upgrade the building runs', () => {
	const both = computeOfflineGrant(
		input({ castleUpgrade: { toLevel: 2, remainingSec: 1800 }, ratesAfterCastle: rates(20), buildingUpgrade: job(600), ratesAfterBuilding: rates(100) }),
	)!;
	assert.equal(both.resources.wood, Math.floor((10 * 1800 + 20 * 1800) * 0.5));
	assert.equal(both.building, undefined);
	assert.deepEqual(both.castle, { toLevel: 2, finished: true });
	const only = computeOfflineGrant(input({ buildingUpgrade: job(1800), ratesAfterBuilding: rates(20) }))!;
	assert.equal(only.resources.wood, Math.floor((10 * 1800 + 20 * 1800) * 0.5));
});

test('flag off or no upgrade: the grant is the same as before the building system', () => {
	const plain = computeOfflineGrant(input({}))!;
	assert.equal('building' in plain, false);
	assert.equal(plain.resources.wood, Math.floor(10 * 3600 * 0.5));
});

/** A game with a lumberyard being upgraded to level 2, and its server-side summary. */
const upgrading = () => {
	freshGame();
	growTo(12);
	let spot: { x: number; y: number } | null = null;
	for (let y = CASTLE_Y - 6; y <= CASTLE_Y + 6 && !spot; y++)
		for (let x = CASTLE_X - 6; x <= CASTLE_X + 6 && !spot; x++)
			if (tileAt(api().tiles, x, y).isOwned && tileAt(api().tiles, x, y).biome !== 'castle') spot = { x, y };
	patchTileAt(spot!.x, spot!.y, { biome: 'forest', hasChest: false });
	store.setState((s) => ({ tiles: patchTile(s.tiles, CASTLE_X, CASTLE_Y, { level: 3 }), monsters: [] }));
	setResources({ gold: 1e15, wood: 1e15, stone: 1e15, coal: 1e15, food: 1e15, hide: 1e15 });
	assert.ok(api().buildBuilding(spot!.x, spot!.y, 'lumberyard'));
	assert.ok(api().upgradeBuilding(spot!.x, spot!.y));
	return { spot: spot!, summary: summarize(pickPersisted(api())) };
};

test('end to end: the server derives the rates after the upgrade, the grant finishes it, the client applies the new level and rates', () => {
	withBuildings(() => {
		const { spot, summary } = upgrading();
		assert.ok(summary.derived.ratesAfterBuilding && summary.derived.ratesAfterBuilding.wood > summary.rates.wood, 'the next level makes more');
		const grant = computeOfflineGrant({
			rates: summary.rates,
			ratesAfterCastle: summary.derived.ratesAfterCastle,
			castleUpgrade: summary.derived.castleUpgrade,
			buildingUpgrade: summary.derived.buildingUpgrade,
			ratesAfterBuilding: summary.derived.ratesAfterBuilding,
			xpGainPct: summary.xpGainPct,
			gapSec: 2000,
			capSec: 8 * 3600,
			efficiency: 0.5,
			minGapSec: 300,
		})!;
		assert.equal(grant.building?.finished, true);
		// more than the old rate alone would have paid: the new level counted from the moment the timer ended
		assert.ok(grant.resources.wood > Math.floor(summary.rates.wood * 2000 * 0.5));

		const state = api();
		const applied = applyOfflineGrant(state, grant);
		assert.equal(applied.summary.buildingReached, 2);
		assert.equal(applied.patch.buildingUpgrade, null);
		assert.equal(tileAt(applied.patch.tiles!, spot.x, spot.y).buildingLevel, 2);
		assert.ok(applied.patch.resourceRates!.total.wood > state.resourceRates.total.wood, 'the bonus of the new level is in the rates');
		assert.ok(applied.patch.resources!.wood > state.resources.wood);
	});
});

test('end to end: partial progress leaves the timer running with less time', () => {
	withBuildings(() => {
		const { summary } = upgrading();
		const grant = computeOfflineGrant({
			rates: summary.rates,
			ratesAfterCastle: null,
			castleUpgrade: null,
			buildingUpgrade: summary.derived.buildingUpgrade,
			ratesAfterBuilding: summary.derived.ratesAfterBuilding,
			xpGainPct: 0,
			gapSec: 400,
			capSec: 8 * 3600,
			efficiency: 0.5,
			minGapSec: 300,
		})!;
		assert.equal(grant.building?.finished, false);
		const applied = applyOfflineGrant(api(), grant);
		assert.equal(applied.patch.buildingUpgrade?.remainingSec, 200);
		assert.equal(applied.summary.buildingReached, undefined);
	});
});

test('the income of a building is part of the grant like tile income', () => {
	withBuildings(() => {
		const { summary } = upgrading();
		freshGame();
		const without = summarize(pickPersisted(api())).rates.wood;
		assert.ok(summary.rates.wood > without);
		const grant = computeOfflineGrant(input({ rates: summary.rates, gapSec: 3600 }))!;
		assert.equal(grant.resources.wood, Math.floor(summary.rates.wood * 3600 * 0.5));
	});
});

test('a forged remainingSec is rejected by timer_jump: a level claimed after an absence that was too short', () => {
	withBuildings(() => {
		const { spot, summary } = upgrading();
		const T0 = 1_000_000;
		// the client claims the level landed (and a timer of 0) only 5 s after the save that said 600 s were left
		const forged = summarize(pickPersisted({ ...api(), tiles: patchTile(api().tiles, spot.x, spot.y, { buildingLevel: 2 }), buildingUpgrade: null } as never));
		assert.equal(forged.derived.buildings?.lumberyard, 2);
		assert.equal(verifyTransition({ summary, serverSavedAt: T0 }, forged, T0 + 5000).includes('timer_jump'), true);
		// the same claim after the absence the timer needed is fine
		assert.equal(verifyTransition({ summary, serverSavedAt: T0 }, forged, T0 + 700_000).includes('timer_jump'), false);
		// a timer rewritten to nearly nothing without the time passing
		const rewritten = { ...summary, derived: { ...summary.derived, buildingUpgrade: { ...summary.derived.buildingUpgrade!, remainingSec: 1 } } };
		assert.equal(verifyTransition({ summary, serverSavedAt: T0 }, rewritten, T0 + 5000).includes('timer_jump'), true);
	});
});
