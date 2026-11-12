import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const TSX = require.resolve('tsx/cli');
const listProfiles = (flag: string): string[] =>
	execFileSync(process.execPath, [TSX, 'scripts/sim.ts', flag], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);

// The long and advanced sims (IDL-276) run only on a developer's machine: `npm run sim:local`. CI, the docs and the parallel runner must never see them.
test('the local-only sim profiles are not in the shared list and the shared list has none of them', () => {
	const shared = listProfiles('--list');
	const local = listProfiles('--list-local');
	assert.ok(local.includes('max-r10') && local.includes('hardcore-rebirth6-x20'), 'the local list holds the optimisers and the long probes');
	for (const name of local) assert.ok(!shared.includes(name), `${name} must not be in --list (CI, docs/generated and sim:parallel read it)`);
	assert.ok(shared.includes('hardcore-rebirth6-x10'), 'the shared list keeps the profiles CI runs');
});

test('the CI workflow does not run the local sims', () => {
	const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
	assert.ok(
		!/sim:local|sim-local|max-r\d|max-ramp|rebirth6-x20|rebirth8-x10|--max-spend/.test(ci),
		'ci.yml must not name a local sim profile or the local runner',
	);
});
