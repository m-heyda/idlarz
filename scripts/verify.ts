/**
 * `npm run verify`: everything CI checks, run here on all your cores before you push.
 *
 * CI used to repeat the slow work (the sims behind `docs/generated`) on every pull request; now it skips it when the inputs hash says it was done (see `scripts/gen-inputs.ts`). This script does
 * it: formatting, types, lint, the unit tests and the reference docs check run **at the same time**, and when a file the generators read has changed (the hash is stale) it regenerates
 * `docs/generated` in parallel too (`sim:parallel` on all cores next to the three report groups) and writes the new hash. The `pre-push` hook (`.githooks/pre-push`) runs it, so a push is
 * refused while something would fail in CI. When it regenerated files it stops with "commit them" (a hook cannot commit for you); commit and push again.
 *
 *   npm run verify                everything above; a tree that already passed (same HEAD tree, clean) is skipped
 *   npm run verify -- --force     ignore the "already verified" marker
 *   npm run verify -- --no-gen    skip the regeneration of docs/generated even when it is stale (CI will say so)
 *   npm run verify -- --gen-only  only the regeneration (what `npm run docs:gen:fast` runs)
 *   npm run verify -- --build     also `next build` (slow, CI runs it)
 *
 * Skip the hook once with `SKIP_VERIFY=1 git push` or `git push --no-verify`. CI still fails what you skipped.
 *
 * @title The local verify script and the pre-push hook
 * @category Ops/CI
 * @order 3
 */
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { cpus } from 'node:os';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const NODE = process.execPath;
// the tools' bin files by path: `require.resolve` refuses sub-paths that a package does not export (eslint)
const bin = (module: string) => (module === 'tsx/cli' ? require.resolve(module) : resolve(process.cwd(), 'node_modules', module));

interface Step {
	name: string;
	command: string;
	args: string[];
	shell?: boolean;
}

interface Result {
	name: string;
	ok: boolean;
	seconds: number;
	output: string;
}

const run = (step: Step): Promise<Result> =>
	new Promise((done) => {
		const started = Date.now();
		let output = '';
		const child = spawn(step.command, step.args, { shell: step.shell ?? false, stdio: ['ignore', 'pipe', 'pipe'] });
		child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
		child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
		child.on('error', (error) => done({ name: step.name, ok: false, seconds: (Date.now() - started) / 1000, output: output + String(error) }));
		child.on('close', (code) => {
			const result = { name: step.name, ok: code === 0, seconds: (Date.now() - started) / 1000, output };
			console.error(`  ${result.ok ? 'ok  ' : 'FAIL'} ${step.name} (${result.seconds.toFixed(0)} s)`);
			done(result);
		});
	});

const git = (...args: string[]): string => execFileSync('git', args, { encoding: 'utf8' }).trim();

/** The marker file that says "this exact tree passed": `.git/idlarz-verify-ok` holds the tree hash. Only trusted when the working tree is clean. */
const markerPath = (): string => resolve(git('rev-parse', '--git-path', 'idlarz-verify-ok'));
const cleanTree = (): string | null => {
	try {
		return git('status', '--porcelain') === '' ? git('rev-parse', 'HEAD^{tree}') : null;
	} catch {
		return null;
	}
};

/** The checks that need no output of ours: they run side by side. */
export const checkSteps = (withBuild: boolean): Step[] => [
	{ name: 'prettier', command: NODE, args: [bin('prettier/bin/prettier.cjs'), '--check', '.'] },
	{ name: 'tsc', command: NODE, args: [bin('typescript/bin/tsc'), '--noEmit'] },
	{ name: 'eslint', command: NODE, args: [bin('eslint/bin/eslint.js'), '.', '--max-warnings=0'] },
	{ name: 'tests', command: NODE, args: [bin('tsx/cli'), '--test', 'tests/**/*.test.ts'] },
	{ name: 'docs:code:check', command: NODE, args: [bin('tsx/cli'), 'scripts/docs-reference.ts', '--check'] },
	...(withBuild ? [{ name: 'next build', command: 'npm run build', args: [], shell: true }] : []),
];

/** The regeneration of docs/generated: the full sim on all cores next to the three groups of report generators. */
export const generateSteps = (): Step[] => [
	// the sim takes the cores the three single-threaded report groups leave over (all of them at once made every step about twice as slow)
	{ name: 'sim:parallel', command: `npm run sim:parallel -- --jobs=${Math.max(1, cpus().length - 4)}`, args: [], shell: true },
	{ name: 'docs:gen:rest:quick', command: 'npm run docs:gen:rest:quick', args: [], shell: true },
	{ name: 'docs:gen:rest:fights', command: 'npm run docs:gen:rest:fights', args: [], shell: true },
	{ name: 'docs:gen:rest:loot', command: 'npm run docs:gen:rest:loot', args: [], shell: true },
];

const hashIsStale = (): boolean => {
	try {
		execFileSync(NODE, [bin('tsx/cli'), 'scripts/gen-inputs.ts', '--check'], { stdio: 'ignore' });
		return false;
	} catch {
		return true;
	}
};

const main = async () => {
	const args = process.argv.slice(2);
	const flag = (name: string) => args.includes(`--${name}`);
	const started = Date.now();

	if (!flag('force') && !flag('gen-only')) {
		const tree = cleanTree();
		const marker = existsSync(markerPath()) ? readFileSync(markerPath(), 'utf8').trim() : '';
		if (tree && marker === tree) {
			console.error('verify: this tree already passed (clean, same HEAD tree). Use --force to run again.');
			return;
		}
	}

	const regenerate = flag('gen-only') || (!flag('no-gen') && hashIsStale());
	const checks: Step[] = flag('gen-only') ? [] : checkSteps(flag('build'));
	console.error(`verify: ${checks.length} checks at once${regenerate ? ', then docs/generated is stale: regenerating it' : ''}`);
	// the checks first (about a minute), then the regeneration alone: run together they fight for the cores and both get slower
	const results = await Promise.all(checks.map(run));
	if (regenerate && results.every((r) => r.ok)) results.push(...(await Promise.all(generateSteps().map(run))));

	const failed = results.filter((r) => !r.ok);
	for (const r of failed) console.error(`\n===== ${r.name} =====\n${r.output.trim().split('\n').slice(-60).join('\n')}`);
	if (failed.length > 0) {
		console.error(`\nverify: FAILED: ${failed.map((r) => r.name).join(', ')}`);
		process.exit(1);
	}

	if (regenerate) {
		execFileSync(NODE, [bin('tsx/cli'), 'scripts/gen-inputs.ts', '--write'], { stdio: 'inherit' });
		const changed = git('status', '--porcelain', 'docs/generated');
		if (changed) {
			console.error(
				`\nverify: docs/generated changed. Commit it, then push again:\n${changed}\n\n  git add docs/generated && git commit -m "Regenerate docs/generated"`,
			);
			process.exit(1);
		}
	}

	const tree = cleanTree();
	if (tree) writeFileSync(markerPath(), `${tree}\n`);
	console.error(`verify: all green in ${((Date.now() - started) / 1000).toFixed(0)} s`);
};

main().catch((error: Error) => {
	console.error(error.message);
	process.exit(1);
});
