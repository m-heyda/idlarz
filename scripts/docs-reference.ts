/**
 * Commands. Generated reports go to `docs/generated` and are never edited by hand; the documentation of how the game works is generated from the JSDoc into `docs/reference` (`build`).
 *
 * - `npm run docs:code` regenerates `docs/reference` from the JSDoc (seconds). The git pre-commit hook runs it for every commit and stages the result; `npm run docs:code:check` and `tests/docs/reference.test.ts` fail when it is stale.
 * - `npm run docs:gen` regenerates everything in `docs/generated` (report, sim, catalog-report, fight-sim, monster-ladder, loot-sim, kill-sim, craft-sim). Run it and commit the diff whenever balance values change; CI (job `generated`) fails a PR whose
 *   `docs/generated` differs from a fresh run. `npm run docs:check` is that gate in one local command (about 9 minutes, the sim is most of it).
 * - `npm run sim` is the bot simulation (see the Pacing page); `npm run perf` prints timings of the map at 5k / 50k / 250k tiles; `npm run lint`, `npm test` (node:test over every `*.test.ts` under tests/).
 * - Every npm script, computed from `package.json`:
 *
 * @title Commands and documentation generation
 * @category Ops/Commands
 * @order 1
 * @table npm-scripts
 */
/**
 * Builds docs/reference from the JSDoc in the code (the single source of truth for how the game works).
 *
 *   npm run docs:code           write docs/reference
 *   npm run docs:code -- --check   write nothing, exit 1 when the committed files differ (used by tests/docs/reference.test.ts and CI)
 *
 * The git pre-commit hook (.githooks/pre-commit) runs the first form and stages the result.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseRepo } from './docs/parse';
import { renderAll } from './docs/render';

const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'docs', 'reference');

export function build(): Record<string, string> {
	return renderAll(ROOT, parseRepo(ROOT));
}

/** The paths (relative to docs/reference) that differ from what `build()` produces, stale extras included. */
export function stale(files: Record<string, string>): string[] {
	const out: string[] = [];
	for (const [name, content] of Object.entries(files)) {
		const p = resolve(OUT, name);
		if (!existsSync(p) || readFileSync(p, 'utf8') !== content) out.push(name);
	}
	if (existsSync(OUT)) for (const name of readdirSync(OUT)) if (!(name in files)) out.push(name);
	return out;
}

if (require.main === module) {
	const files = build();
	if (process.argv.includes('--check')) {
		const bad = stale(files);
		if (bad.length) {
			console.error(`docs/reference is stale (${bad.join(', ')}): run npm run docs:code and commit the result`);
			process.exit(1);
		}
		console.log(`docs/reference is up to date (${Object.keys(files).length} files)`);
	} else {
		mkdirSync(OUT, { recursive: true });
		for (const name of readdirSync(OUT)) if (!(name in files)) rmSync(resolve(OUT, name), { recursive: true, force: true });
		for (const [name, content] of Object.entries(files)) writeFileSync(resolve(OUT, name), content);
		console.log(`docs/reference: wrote ${Object.keys(files).length} files`);
	}
}
