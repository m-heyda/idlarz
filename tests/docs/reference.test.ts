import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { build, stale } from '../../scripts/docs-reference';
import { parseRepo } from '../../scripts/docs/parse';

// The reference in docs/reference is generated from the JSDoc in the code (`npm run docs:code`, run by the pre-commit hook).
// These tests are the gate for commits that skipped the hook.

const ROOT = resolve(__dirname, '..', '..');
const entries = parseRepo(ROOT);

test('the JSDoc blocks parse, every @category and @table exists and every block has a description', () => {
	assert.ok(entries.length > 100, `only ${entries.length} documented entries`);
	build(); // throws on an unknown category, an unknown @table or a block without a description
});

test('docs/reference is up to date: run `npm run docs:code` and commit the result', () => {
	assert.deepEqual(stale(build()), []);
});

test('every documented entry points at a file that exists', () => {
	const missing = entries.filter((e) => !existsSync(resolve(ROOT, e.file))).map((e) => `${e.name} -> ${e.file}`);
	assert.deepEqual(missing, []);
});

test('every {@link x} in the prose names a documented entry', () => {
	const names = new Set(entries.flatMap((e) => [e.name, e.symbol].filter(Boolean)));
	const unresolved: string[] = [];
	for (const e of entries) for (const m of [e.body, ...e.knownIssues].join('\n').matchAll(/\{@link\s+([^}\s]+)\}/g)) if (!names.has(m[1])) unresolved.push(`${e.name}: {@link ${m[1]}}`);
	assert.deepEqual(unresolved, [], 'document the target (add @category to its JSDoc) or write the name as plain code');
});

test('names are unique within a category, so a symbol index entry is never ambiguous', () => {
	const seen = new Map<string, string>();
	const clashes: string[] = [];
	for (const e of entries) {
		const key = `${e.category[0]}/${e.name}`;
		if (seen.has(key)) clashes.push(`${key}: ${seen.get(key)} and ${e.file}`);
		seen.set(key, e.file);
	}
	assert.deepEqual(clashes, []);
});
