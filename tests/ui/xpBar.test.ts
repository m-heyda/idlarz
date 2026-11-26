import test from 'node:test';
import assert from 'node:assert/strict';
import { xpBarOf } from '../../src/lib/xpBar';
import { calculateLevel, cumulativeParagonXp, cumulativeXp, paragonStepXp, xpToNextLevel } from '../../src/utils/game/character';
import { compact } from '../../packages/design-system/src/logic';

// The XP bar of the Hero window for both tracks: the level (1 to 100) and, past it, the paragon level.

const base = cumulativeXp(100);
/** What HeroWindow built before paragon existed, for a level below 100 */
const oldText = (level: { level: number; progress: number }) => {
	const needed = xpToNextLevel(level.level);
	const into = Math.floor(level.progress * needed);
	return { into, needed, label: `Level ${level.level} · ${Math.floor(level.progress * 100)}% · ${compact(into)} / ${compact(needed)}` };
};

test('below level 100 the bar reads exactly as it did', () => {
	for (const xp of [0, 1234, cumulativeXp(50) + 5e6, base - 3e8, base - 1]) {
		const level = calculateLevel(xp);
		const old = oldText(level);
		const bar = xpBarOf(level, xp);
		assert.equal(bar.track, 'level');
		assert.equal(bar.label, old.label);
		assert.equal(bar.into, old.into);
		assert.equal(bar.max, old.needed);
		assert.equal(bar.remaining, old.needed - old.into);
		assert.equal(bar.next, 'level up');
	}
});

test('at level 100 the bar is the paragon track', () => {
	const xp = base + 1.1e8;
	const bar = xpBarOf(calculateLevel(xp), xp);
	assert.equal(bar.track, 'paragon');
	assert.match(bar.label, /^Paragon 0 · 15% · /);
	assert.equal(bar.max, paragonStepXp(0));
	assert.ok(Math.abs(bar.into - 1.1e8) <= 1, `inside the level: ${bar.into}`);
	assert.equal(bar.next, 'paragon level');
	assert.ok(bar.remaining > 0 && bar.remaining < bar.max);
});

test('later paragon levels name the level and the XP inside it', () => {
	const xp = base + cumulativeParagonXp(37) + paragonStepXp(37) * 0.25;
	const bar = xpBarOf(calculateLevel(xp), xp);
	assert.match(bar.label, /^Paragon 37 · 25% · /);
	assert.equal(bar.max, paragonStepXp(37));
});

test('at the paragon ceiling the bar is full and says MAX', () => {
	const bar = xpBarOf(calculateLevel(1e30), 1e30);
	assert.equal(bar.label, 'Paragon 5000 · MAX');
	assert.equal(bar.remaining, 0);
	assert.equal(bar.into, 1);
	assert.equal(bar.max, 1);
});

test('garbage XP never gives NaN', () => {
	for (const xp of [Number.NaN, -5, Number.POSITIVE_INFINITY]) {
		const bar = xpBarOf({ level: 100, progress: 1 }, xp);
		for (const value of [bar.into, bar.max, bar.remaining]) assert.ok(Number.isFinite(value), `${xp}: ${JSON.stringify(bar)}`);
		assert.doesNotMatch(bar.label, /NaN|Infinity/);
	}
});
