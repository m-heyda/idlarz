import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dockComplete, dockWindows, isNightOwlHour, KONAMI, konamiStep } from '../../src/lib/secretTriggers';
import { WIN_IDS } from '../../src/stores/windowStore';

const type = (keys: readonly string[]): number => keys.reduce((progress, key) => konamiStep(progress, key), 0);

test('the Konami code completes only when typed in full and in order', () => {
	assert.equal(type(KONAMI), KONAMI.length);
	assert.equal(type(['ArrowUp', 'ArrowUp', 'ArrowDown']), 3);
	assert.ok(type(KONAMI.slice(0, -1)) < KONAMI.length, 'one key short');
});

test('a wrong key starts the Konami code over, and an Up restarts it from one', () => {
	assert.equal(type(['ArrowUp', 'ArrowUp', 'x']), 0);
	assert.equal(type(['ArrowUp', 'ArrowUp', 'ArrowUp']), 1, 'a stray third Up restarts at one Up');
	assert.equal(type(['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', ...KONAMI.slice(2)]), KONAMI.length, 'extra Ups before the code do not spoil it');
	assert.equal(type(['ArrowDown', 'ArrowUp']), 1);
	assert.equal(type([...KONAMI.slice(0, 9), 'x']), 0);
});

test('the Konami letters count in either case', () => {
	assert.equal(type([...KONAMI.slice(0, 8), 'B', 'A']), KONAMI.length);
});

test('the night owl hour is 3:00 to 3:59 local time', () => {
	assert.equal(isNightOwlHour(new Date(2026, 10, 19, 3, 0, 0)), true);
	assert.equal(isNightOwlHour(new Date(2026, 10, 19, 3, 59, 59)), true);
	assert.equal(isNightOwlHour(new Date(2026, 10, 19, 2, 59, 59)), false);
	assert.equal(isNightOwlHour(new Date(2026, 10, 19, 4, 0, 0)), false);
	assert.equal(isNightOwlHour(new Date(2026, 10, 19, 15, 30, 0)), false);
});

test('Dock shuffle asks for the dock windows, Deeds only when its button is there', () => {
	const withDeeds = dockWindows(true);
	const without = dockWindows(false);
	assert.ok(withDeeds.includes('achievements'));
	assert.ok(!without.includes('achievements'));
	assert.equal(withDeeds.length, without.length + 1);
	for (const id of withDeeds) assert.ok((WIN_IDS as readonly string[]).includes(id), `${id} is a window`);
	assert.equal(new Set(withDeeds).size, withDeeds.length, 'no duplicates');
});

test('Dock shuffle completes once every window has been opened, in any order', () => {
	const required = dockWindows(true);
	const opened = new Set<string>();
	for (const id of [...required].reverse()) {
		assert.equal(dockComplete(opened, required), false);
		opened.add(id);
	}
	assert.equal(dockComplete(opened, required), true);
	assert.equal(dockComplete(new Set(['castle', 'kingdom']), required), false, 'windows outside the dock do not count');
});
