import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Guard: the client must never ship a developer console (cheat panel) or a handle on the game store. This scans `src/` for the
 * names of the removed console and its switches; if one comes back, players could find it. Offline tools live in `scripts/`.
 */
const SRC = path.join(__dirname, '..', '..', 'src');

const walk = (dir: string): string[] =>
	fs
		.readdirSync(dir, { withFileTypes: true })
		.flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : []));

const FILE_NAMES = /(GameDebug|DevConsole|DebugConsole|AdminPanel|CheatPanel|DebugPanel)\.tsx?$/i;
const FORBIDDEN: RegExp[] = [
	/window\.__game|__game\s*=/, // the store handle on window
	/\bGameDebug\b/,
	/Show admin mode|Admin \(dev\)|Admin tools/,
	/showAdmin|adminCollapsed/,
	/NEXT_PUBLIC_(DEBUG|DEV|ADMIN|CHEAT)/,
];

test('no developer console component in src/', () => {
	const files = walk(SRC);
	assert.deepEqual(
		files.filter((f) => FILE_NAMES.test(f)).map((f) => path.relative(SRC, f)),
		[],
	);
});

test('no developer console names, switches or window handles in src/', () => {
	const hits: string[] = [];
	for (const file of walk(SRC)) {
		const text = fs.readFileSync(file, 'utf8');
		for (const re of FORBIDDEN) if (re.test(text)) hits.push(`${path.relative(SRC, file)}: ${re}`);
	}
	assert.deepEqual(hits, []);
});
