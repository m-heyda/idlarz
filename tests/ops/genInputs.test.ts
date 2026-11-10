import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generatorEntries, hashFiles, inputFiles } from '../../scripts/gen-inputs';

test('the generator entries follow the docs:gen scripts and always include the sim', () => {
	const entries = generatorEntries({
		'docs:gen': 'npm run docs:gen:rest && npm run docs:gen:sim',
		'docs:gen:rest': 'npm run docs:gen:rest:a && npm run docs:gen:rest:b',
		'docs:gen:rest:a': 'npm run report && npm run extra -- --md',
		'docs:gen:rest:b': 'npm run other',
		'docs:gen:sim': 'npm run sim:parallel',
		report: 'tsx scripts/balance-report.ts',
		extra: 'tsx scripts/extra-sim.ts',
		other: 'tsx scripts/other.ts',
		'sim:parallel': 'tsx scripts/sim-parallel.ts',
		lint: 'eslint .',
	});
	assert.deepEqual(entries, ['scripts/balance-report.ts', 'scripts/extra-sim.ts', 'scripts/other.ts', 'scripts/sim-parallel.ts', 'scripts/sim.ts']);
});

test('the hash ignores line endings and a BOM, and changes with a path or a content change', () => {
	const base = [
		{ path: 'a.ts', text: 'one\ntwo\n' },
		{ path: 'b.ts', text: 'x' },
	];
	const same = hashFiles([
		{ path: 'b.ts', text: 'x' },
		{ path: 'a.ts', text: '\uFEFFone\r\ntwo\r\n' },
	]);
	assert.equal(hashFiles(base), same);
	assert.notEqual(hashFiles(base), hashFiles([{ path: 'a.ts', text: 'one\ntwo\nthree\n' }, base[1]]));
	assert.notEqual(hashFiles(base), hashFiles([{ path: 'c.ts', text: 'one\ntwo\n' }, base[1]]));
});

test('the real inputs are the game logic and the generators, not the UI', async () => {
	const files = await inputFiles();
	for (const must of ['scripts/sim.ts', 'src/config/combatConfig.ts', 'src/stores/gameStore.ts', 'package-lock.json'])
		assert.ok(files.includes(must), `${must} must count`);
	assert.ok(
		!files.some((f) => f.startsWith('src/components/') || f.startsWith('src/app/') || f.startsWith('src/styles/')),
		'UI files must not be inputs of the generated docs',
	);
});
