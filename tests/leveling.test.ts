import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { api, freshGame, growTo, store } from './helpers';
import { INITIAL_CHARACTER_STATS, LEVELING, MAX_LEVEL, XP_CAP } from '../src/config/gameConfig';
import { calculateLevel, cumulativeXp, totalStatPoints, xpToNextLevel } from '../src/utils/gameUtils';
import { decodeSave, encodeSave, sealWire } from '../src/lib/saveFormat';
import { maxHp, maxMana } from '../src/lib/combat';
import { pickPersisted } from '../src/lib/sanitizeSave';

// The character level curve (LEVELING in the config): slow, written down as anchors measured with the sim bot, and carried over rebirths.

test('the curve hits its anchors: level 10 / 30 / 80 / 90 / 100 need the XP the config says', () => {
	for (const [level, xp] of LEVELING.anchors) {
		const total = cumulativeXp(level);
		assert.ok(Math.abs(total - xp) / xp < 1e-3, `level ${level}: ${total} vs ${xp}`);
		assert.equal(calculateLevel(total).level, level, `level ${level} is reached at its anchor`);
		assert.equal(calculateLevel(total - 1).level, level - 1, `and not a point before`);
	}
	assert.equal(LEVELING.anchors[LEVELING.anchors.length - 1][0], MAX_LEVEL);
});

test('every step is a whole number of XP and never smaller than the step before (also across the anchors)', () => {
	let last = 0;
	for (let level = 1; level < MAX_LEVEL; level++) {
		const step = xpToNextLevel(level);
		assert.ok(Number.isInteger(step) && step > 0, `level ${level}`);
		assert.ok(step >= last, `level ${level} (${step}) is not cheaper than the one before (${last})`);
		last = step;
	}
	assert.equal(xpToNextLevel(MAX_LEVEL), Infinity);
	assert.equal(xpToNextLevel(0), xpToNextLevel(1), 'a nonsense level reads as the first');
});

test('the pace: level 10 is hours of play, the soft cap is far beyond the first run, and no level costs less than the one before', () => {
	// the sim bot earns ~1.4e5 XP in 4-5 hours, ~1e8 by day 2, ~3e9 by its third rebirth (day ~10) and ~2e10 by its tenth (day ~25)
	assert.ok(cumulativeXp(10) >= 1e5 && cumulativeXp(10) <= 3e5, `level 10 = ${cumulativeXp(10)}`);
	assert.ok(cumulativeXp(30) >= 3e7 && cumulativeXp(30) <= 3e8, `level 30 = ${cumulativeXp(30)}`);
	assert.ok(cumulativeXp(LEVELING.softCapLevel) > 1e9, 'the soft cap is a multi-rebirth goal');
	assert.ok(cumulativeXp(100) > 4 * cumulativeXp(LEVELING.softCapLevel), 'the maximum is far past the soft cap');
	for (let level = 1; level < MAX_LEVEL - 1; level++) assert.ok(xpToNextLevel(level + 1) >= xpToNextLevel(level), `level ${level}`);
});

test('levels: any XP gives a level between 1 and the maximum; at the maximum the bar is full', () => {
	assert.deepEqual(calculateLevel(0), { level: 1, progress: 0 });
	for (const xp of [-5, NaN, Infinity, 1e300, XP_CAP, XP_CAP * 1e30]) {
		const { level, progress } = calculateLevel(xp);
		assert.ok(level >= 1 && level <= MAX_LEVEL && progress >= 0 && progress <= 1, `xp ${xp}`);
	}
	assert.deepEqual(calculateLevel(cumulativeXp(MAX_LEVEL)), { level: MAX_LEVEL, progress: 1 });
	assert.deepEqual(calculateLevel(XP_CAP), { level: MAX_LEVEL, progress: 1 });
	// monotonic
	let level = 1;
	for (let xp = 0; xp < 1e12; xp = xp * 1.3 + 500) {
		const next = calculateLevel(xp).level;
		assert.ok(next >= level);
		level = next;
	}
});

test('attribute points: a level gives 1, the early levels give extra, and the total is the same however the levels are reached', () => {
	assert.equal(totalStatPoints(1), 0);
	assert.equal(totalStatPoints(2), 1 + LEVELING.earlyBonusPoints);
	assert.equal(totalStatPoints(LEVELING.earlyBonusUntil), (LEVELING.earlyBonusUntil - 1) * (1 + LEVELING.earlyBonusPoints));
	assert.equal(totalStatPoints(LEVELING.earlyBonusUntil + 1), totalStatPoints(LEVELING.earlyBonusUntil) + 1, 'a plain level gives one');
	assert.equal(totalStatPoints(MAX_LEVEL), MAX_LEVEL - 1 + (LEVELING.earlyBonusUntil - 1) * LEVELING.earlyBonusPoints);
	assert.equal(totalStatPoints(MAX_LEVEL + 50), totalStatPoints(MAX_LEVEL), 'nothing past the maximum');
	assert.equal(totalStatPoints(0), 0);
});

test('a level-up in play credits exactly the points of the levels gained', () => {
	freshGame();
	store.setState((s) => ({ resources: { ...s.resources, xp: cumulativeXp(12) + 1 } }));
	api().tick(100);
	assert.equal(api().level.level, 12);
	assert.equal(api().characterStats.availablePoints, totalStatPoints(12));
	store.setState((s) => ({ resources: { ...s.resources, xp: cumulativeXp(40) + 1 } }));
	api().tick(100);
	assert.equal(api().characterStats.availablePoints, totalStatPoints(40));
});

// ---------------------------------------------------------------------------------------------------- the migration (schema 5 -> 6)

test('a schema 5 save keeps its XP, gets the level of the new curve and its attribute points refunded', () => {
	const text = readFileSync(new URL('./fixtures/saves/v5-levels.sav', import.meta.url), 'utf8').trim();
	const result = decodeSave(text);
	assert.equal(result.ok, true, result.ok ? '' : result.reason);
	if (!result.ok) return;
	assert.equal(result.schema, 5);
	const { state } = result;
	assert.equal(state.resources.xp, 362_000, 'the XP is untouched');
	const level = calculateLevel(362_000).level;
	assert.equal(state.level.level, level);
	assert.ok(level < 20, `the old curve called this level 20, the new one ${level}`);
	for (const key of ['strength', 'dexterity', 'intelligence', 'vitality', 'charisma'] as const) assert.equal(state.characterStats[key], INITIAL_CHARACTER_STATS[key], key);
	assert.equal(state.characterStats.availablePoints, totalStatPoints(level), 'every point the level has earned is to spend again');

	// what is written next is a schema 6 save that loads as it is
	const again = decodeSave(encodeSave(state));
	assert.equal(again.ok, true, again.ok ? '' : again.reason);
	if (again.ok) {
		assert.equal(again.schema, 6);
		assert.deepEqual(again.state.characterStats, state.characterStats);
		assert.equal(again.state.resources.xp, 362_000);
	}
});

test('a schema 5 save with full HP and mana for its spent attributes still loads: the refund takes the max down, the pools start full', () => {
	// A played character has put its points in Vitality / Intelligence and sits at (or near) the full pools they gave. The refund puts those
	// attributes back, the maxima drop, and a stored HP above the new maximum made sanitizeSave refuse the whole save as damaged.
	const text = readFileSync(new URL('./fixtures/saves/v5-levels.sav', import.meta.url), 'utf8').trim();
	const wire = JSON.parse(Buffer.from(text.split('.')[1], 'base64').toString('utf8'));
	wire.s.characterStats = { ...wire.s.characterStats, vitality: 60, intelligence: 60, availablePoints: 0 };
	wire.s.playerHp = 5000;
	wire.s.playerMp = 3000;
	const result = decodeSave(sealWire(wire));
	assert.equal(result.ok, true, result.ok ? '' : result.reason);
	if (!result.ok) return;
	const { state } = result;
	assert.equal(state.characterStats.vitality, INITIAL_CHARACTER_STATS.vitality);
	assert.equal(state.playerHp, maxHp(state.characterStats, state.equipment), 'HP starts full');
	assert.equal(state.playerMp, maxMana(state.characterStats, state.equipment), 'mana starts full');
});

test('a schema 6 save is not touched by the migration: attributes stay as the player spent them', () => {
	freshGame();
	growTo(10);
	store.setState((s) => ({ resources: { ...s.resources, xp: cumulativeXp(15) + 1 } }));
	api().tick(100);
	assert.equal(api().addStatPoint('strength'), true);
	assert.equal(api().addStatPoint('strength'), true);
	const decoded = decodeSave(encodeSave(pickPersisted(api())));
	assert.equal(decoded.ok, true, decoded.ok ? '' : decoded.reason);
	if (decoded.ok) {
		assert.equal(decoded.state.characterStats.strength, INITIAL_CHARACTER_STATS.strength + 2);
		assert.equal(decoded.state.characterStats.availablePoints, totalStatPoints(15) - 2);
	}
});
