import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// The server owns what is rolled: spawns, where monsters stand, chests, kills and every fight. The browser may show those numbers
// (config is shared), but it must never import the code that rolls or seals them - the tests below read the sources to make sure.

const SRC = resolve(__dirname, '..', 'src');
const walk = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
	});

const BROWSER_DIRS = ['stores', 'components', 'hooks'].map((d) => join(SRC, d));
const browserFiles = [
	...BROWSER_DIRS.flatMap(walk),
	...walk(join(SRC, 'app')).filter((f) => !relative(SRC, f).replace(/\\/g, '/').startsWith('app/api/')),
	...['rewardsClient.ts', 'offlineClient.ts', 'offlineFlow.ts', 'combatFx.ts'].map((f) => join(SRC, 'lib', f)),
];

const SERVER_ONLY = [
	'@/lib/offline/seal',
	'@/lib/offline/fight',
	'@/lib/offline/online',
	'@/lib/offline/service',
	'@/lib/offline/placement',
	'@/lib/offline/tickets',
	'@/lib/offline/reward',
	'@/lib/offline/profile',
	'@/lib/offline/ledger',
	'@/lib/offline/supabaseLedger',
	'@/lib/cloudSave/pipeline',
];
const ROLLERS = ['rollChestLoot', 'rollKillLoot', 'rollGemFind', 'sealedRng', 'advanceBank', 'placeTickets', 'runCombat', 'payKill'];

test('no browser code imports the modules that roll, seal, place or fight', () => {
	assert.ok(browserFiles.length > 50, 'the check reads the real sources');
	for (const file of browserFiles) {
		const text = readFileSync(file, 'utf8');
		for (const path of SERVER_ONLY) assert.ok(!text.includes(`from '${path}'`), `${relative(SRC, file)} imports ${path}`);
	}
});

test('no browser code calls a function that rolls a reward or a fight', () => {
	for (const file of browserFiles) {
		const text = readFileSync(file, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
		for (const name of ROLLERS) assert.ok(!new RegExp(`\\b${name}\\b`).test(text), `${relative(SRC, file)} mentions ${name}`);
	}
});

test('the browser has no way to hit a monster: the store has no click combat and no guest spawning left', () => {
	const store = readFileSync(join(SRC, 'stores', 'gameStore.ts'), 'utf8');
	for (const gone of ['hitMonster', 'startFight', 'stepFight', 'rollHit', 'serverSpawns', 'hitGuard']) assert.ok(!store.includes(gone), `${gone} is gone from the store`);
});
