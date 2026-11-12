/**
 * `npm run sim:local`: the long and advanced sims, on your machine only (IDL-276). It runs the local-only profiles of `scripts/sim.ts` (`hardcore-rebirth6-x20`, `hardcore-rebirth8-x10` and the `max-*` optimisers), one child
 * process per profile on all your cores (at most `--jobs=N`, default the cores minus one, at most 6; each needs about 1 GB), and puts their tables into **`local-sims/sim-local.md`**. That folder is git-ignored: nothing here is
 * committed, read by CI, or compared by the pacing guard, and `docs/generated` is never touched (every child runs with `--no-write`). CI does not run these profiles at all, so a long sim never slows a pull request. A full run takes about
 * three minutes on 8 cores (one seed).
 *
 *   npm run sim:local                                    every local-only profile
 *   npm run sim:local -- max-r10 max-ramp                only the named profiles (any profile name works; the output goes to the same file)
 *   npm run sim:local -- --max-spend human-rebirth6      the other flags of sim.ts go to every profile; `--max-spend` gives any profile the optimiser's spending
 *   npm run sim:local -- --seeds=3 --jobs=4              more seeds (slower), fewer processes
 *
 * What the `max-*` profiles are and what they showed: see the `scripts/sim.ts` header. Open them in a spreadsheet or paste the file into a Linear comment; run it again after a balance change to compare.
 *
 * @title The local sim runner
 * @category Pacing/The sim
 * @order 3
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const TSX = require.resolve('tsx/cli');
const SIM = resolve(process.cwd(), 'scripts', 'sim.ts');
const OUT_DIR = resolve(process.cwd(), 'local-sims');

/** Runs `node tsx scripts/sim.ts ...args` and resolves with its stdout (stderr is passed on with a prefix); rejects on a non-zero exit. */
const sim = (args: string[], label: string): Promise<string> =>
	new Promise((done, fail) => {
		const child = spawn(process.execPath, [TSX, SIM, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
		let out = '';
		child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString()));
		child.stderr.on('data', (chunk: Buffer) => {
			for (const line of chunk.toString().split(/\r?\n/)) if (line.trim()) console.error(`[${label}] ${line}`);
		});
		child.on('error', fail);
		child.on('close', (code) => (code === 0 ? done(out) : fail(new Error(`${label} exited with code ${code}`))));
	});

const main = async () => {
	const args = process.argv.slice(2);
	const jobsArg = args.find((a) => a.startsWith('--jobs='));
	const jobs = Math.max(1, jobsArg ? Number(jobsArg.slice(7)) : Math.min(6, cpus().length - 1));
	const flags = args.filter((a) => a.startsWith('--') && !a.startsWith('--jobs='));
	const named = args.filter((a) => !a.startsWith('--'));
	const profiles = named.length ? named : (await sim(['--list-local'], 'list')).split(/\r?\n/).filter(Boolean);
	if (profiles.length === 0) throw new Error('sim.ts --list-local printed no profiles');

	const started = Date.now();
	console.error(`sim:local: ${profiles.length} profiles, ${Math.min(jobs, profiles.length)} at a time`);
	const outputs = new Map<string, string>();
	const queue = [...profiles];
	const worker = async () => {
		for (let name = queue.shift(); name; name = queue.shift()) {
			const t = Date.now();
			// --no-write always: a named non-local profile must not write docs/generated either
			outputs.set(name, await sim(['--no-write', ...flags, name], name));
			console.error(`sim:local: ${name} finished in ${((Date.now() - t) / 1000).toFixed(0)} s`);
		}
	};
	await Promise.all(Array.from({ length: Math.min(jobs, profiles.length) }, worker));

	let commit = 'unknown';
	try {
		commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
	} catch {
		// not a git checkout: the header says unknown
	}
	const header = [
		'# Local sim runs (not committed, not read by CI)',
		'',
		`Written by \`npm run sim:local\` (scripts/sim-local.ts) on ${new Date().toISOString().slice(0, 10)} at commit ${commit}; flags: ${flags.join(' ') || 'none'}; profiles: ${profiles.join(', ')}; ${((Date.now() - started) / 1000).toFixed(0)} s.`,
		'',
	].join('\n');
	mkdirSync(OUT_DIR, { recursive: true });
	const file = resolve(OUT_DIR, 'sim-local.md');
	writeFileSync(file, header + profiles.map((p) => outputs.get(p) ?? '').join('\n') + '\n');
	console.error(`sim:local: wrote ${file} in ${((Date.now() - started) / 1000).toFixed(0)} s`);
};

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
