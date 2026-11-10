import test from 'node:test';
import assert from 'node:assert/strict';
import { EMBER_MODEL, clampPrestige, settleEmbers } from '../../src/lib/cloudSave/emberModel';
import { DEFAULT_DERIVED, type SaveSummary } from '../../src/lib/cloudSave/summary';
import type { Snapshot } from '../../src/lib/cloudSave/verify';
import { emberGain, emberSpent } from '../../src/utils/game/rebirth';

interface Before {
	castleLevel?: number;
	purchased?: number;
	rebirths?: number;
	legacyEarned?: number;
	upgradingTo?: number;
}

const snapshot = (b: Before = {}): Snapshot => {
	const summary = {
		rates: {},
		gold: 0,
		xp: 0,
		gems: 0,
		level: 1,
		clickLevel: 0,
		tilesOwned: b.purchased ?? 12,
		castleLevel: b.castleLevel ?? 1,
		rebirths: b.rebirths ?? 0,
		legacyPoints: b.legacyEarned ?? 0,
		legacyEarned: b.legacyEarned ?? 0,
		xpGainPct: 0,
		playSeconds: 100_000,
		derived: {
			...DEFAULT_DERIVED,
			purchased: b.purchased ?? 12,
			castleUpgrade: b.upgradingTo ? ({ toLevel: b.upgradingTo, remainingSec: 1000 } as never) : null,
		},
	} as unknown as SaveSummary;
	return { summary, serverSavedAt: 0 };
};

const claim = (rebirths: number, legacyEarned: number, playSeconds = 200_000) => ({ rebirths, legacyEarned, playSeconds });

test('an honest first rebirth (castle 6, 400 tiles, 18 Embers) is untouched', () => {
	assert.equal(emberGain(6, 400, undefined, 0), 18);
	const verdict = settleEmbers(snapshot({ castleLevel: 6, purchased: 400 }), claim(1, 18));
	assert.deepEqual(verdict, { rebirths: 1, legacyEarned: 18, clamped: false });
});

test('an honest later rebirth is untouched, tiles bought after the last save included', () => {
	const gain = emberGain(8, 520, undefined, 2); // 45 tiles more than the previous save held
	const verdict = settleEmbers(snapshot({ castleLevel: 8, purchased: 475, rebirths: 2, legacyEarned: 60 }), claim(3, 60 + gain));
	assert.equal(verdict.clamped, false);
});

test('an upgrade that is running to castle 6 counts as castle 6', () => {
	const verdict = settleEmbers(snapshot({ castleLevel: 5, upgradingTo: 6, purchased: 400 }), claim(1, 18));
	assert.equal(verdict.clamped, false);
});

test('1,000,000 Embers and a rebirth from a save at castle 1 with 12 tiles are clamped to nothing', () => {
	assert.deepEqual(settleEmbers(snapshot(), claim(1, 1_000_000)), { rebirths: 0, legacyEarned: 0, clamped: true });
});

test('forty rebirths in one save become at most one, and the Embers at most what that rebirth pays', () => {
	const before = snapshot({ castleLevel: 6, purchased: 400 });
	const verdict = settleEmbers(before, claim(40, 900_000));
	assert.equal(verdict.clamped, true);
	assert.equal(verdict.rebirths, 1);
	assert.ok(verdict.legacyEarned >= 1 && verdict.legacyEarned < 100, `${verdict.legacyEarned}`);
});

test('inside one run the Embers ever earned cannot rise (spending them changes the unspent points, never this)', () => {
	const before = snapshot({ castleLevel: 6, purchased: 400, rebirths: 1, legacyEarned: 18 });
	assert.deepEqual(settleEmbers(before, claim(1, 5000)), { rebirths: 1, legacyEarned: 18, clamped: true });
	assert.equal(settleEmbers(before, claim(1, 18)).clamped, false);
});

test("a lower rebirth count (a New Game, an older save) is not this check's business", () => {
	const before = snapshot({ castleLevel: 8, purchased: 500, rebirths: 3, legacyEarned: 120 });
	assert.deepEqual(settleEmbers(before, claim(0, 0)), { rebirths: 0, legacyEarned: 0, clamped: false });
});

test('a first save holds a history: rebirths are bounded by the play time, Embers by the best rebirth the game can pay', () => {
	assert.deepEqual(settleEmbers(null, claim(1, 1_000_000, 1000)), { rebirths: 0, legacyEarned: 0, clamped: true });
	const hours = (h: number) => h * 3600;
	const three = settleEmbers(null, claim(3, 1_000_000, hours(3 * 5)));
	assert.equal(three.rebirths, 3);
	// the best rebirth the game can pay (castle 10, the first-save territory, Tithe maxed) three times over
	assert.ok(three.clamped && three.legacyEarned === 3 * emberGain(10, EMBER_MODEL.firstSaveTiles, { tithe: 10 }, 0), `${three.legacyEarned}`);
	assert.equal(settleEmbers(null, claim(3, 60, hours(3 * 5))).clamped, false, 'an honest early player is untouched');
	assert.equal(EMBER_MODEL.minRunSec, 4 * 3600);
});

test('clampPrestige: unspent points follow the Embers; shop levels the Embers cannot pay for are dropped', () => {
	const prestige = { rebirths: 1, legacyPoints: 5, legacyEarned: 1_000_005, upgrades: { thrift: 1 } };
	const spent = emberSpent(prestige.upgrades);
	const kept = clampPrestige({ ...prestige, legacyEarned: spent + 7 }, { rebirths: 1, legacyEarned: spent + 7, clamped: true });
	assert.equal(kept.legacyPoints, 7);
	assert.deepEqual(kept.upgrades, { thrift: 1 });
	const dropped = clampPrestige(prestige, { rebirths: 1, legacyEarned: spent - 1, clamped: true });
	assert.deepEqual(dropped.upgrades, {});
	assert.equal(dropped.legacyPoints, spent - 1);
});
