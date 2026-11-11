// Append-only guards: what a save or a ledger can name by id (an item, a monster, a biome letter, a resource key, a building, an avatar, an achievement, a recipe ...) may be ADDED to but never removed, renamed
// or reordered, and the numbers a stored value is checked against may only grow. `tests/fixtures/saves/released-ids.json` is the list of what has shipped. A failure here means a stored game could name
// something the code no longer knows. Retire content with a flag (hide it, stop dropping it) instead of deleting the id. When you ADD something on purpose, run `npm run gen-save-fixtures -- --ids`
// (it appends the new ids to the shipped list; nothing in the list is ever removed) and commit the file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ORDERED_LISTS, currentIds, mergeReleased, type SavedIds } from '../../scripts/lib/savedIds';

const shipped = JSON.parse(readFileSync(resolve(__dirname, '../fixtures/saves/released-ids.json'), 'utf-8')) as SavedIds;
const now = currentIds();
const HINT =
	'Never delete or rename a shipped id: retire it with a flag. A deliberate addition: npm run gen-save-fixtures -- --ids (docs/plan/save-compatibility.md).';

for (const key of Object.keys(shipped) as (keyof SavedIds)[]) {
	const was = shipped[key];
	if (Array.isArray(was)) {
		test(`${key}: every shipped id is still there${ORDERED_LISTS.includes(key) ? ', in the same order' : ''}`, () => {
			const current = now[key] as string[];
			const missing = was.filter((id) => !current.includes(id));
			assert.deepEqual(missing, [], `${key}: ids that shipped are gone. ${HINT}`);
			if (ORDERED_LISTS.includes(key))
				assert.deepEqual(current.slice(0, was.length), was, `${key} was reordered (it is positional in some stored forms). ${HINT}`);
		});
	}
}

test('biome letters never change or get reused', () => {
	for (const [biome, code] of Object.entries(shipped.biomeCodes))
		assert.equal(now.biomeCodes[biome], code, `the letter of ${biome} changed or the biome is gone. ${HINT}`);
	const letters = Object.values(now.biomeCodes);
	assert.equal(new Set(letters).size, letters.length, 'two biomes share a letter');
});

test('the limits a stored value is checked against only grow (a lowered one would cut what a save already holds)', () => {
	for (const [name, value] of Object.entries(shipped.limits)) {
		assert.ok(name in now.limits, `the limit ${name} is gone. ${HINT}`);
		assert.ok(
			now.limits[name] >= value,
			`${name} was lowered from ${value} to ${now.limits[name]}: stored values above it would be cut. If a number must go down, write an upgrade (src/lib/saveUpgrade.ts).`,
		);
	}
});

test('merging the shipped list with the current code only ever adds', () => {
	const merged = mergeReleased(shipped, now);
	for (const key of Object.keys(shipped) as (keyof SavedIds)[]) {
		const was = shipped[key];
		if (Array.isArray(was)) assert.deepEqual((merged[key] as string[]).slice(0, was.length), was, key);
	}
	const withNew = mergeReleased({ ...shipped, itemIds: shipped.itemIds.slice(1) }, now);
	assert.deepEqual(new Set(withNew.itemIds), new Set([...shipped.itemIds, ...now.itemIds]));
});
