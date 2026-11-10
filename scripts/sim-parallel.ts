/**
 * `npm run sim:parallel`: the full sim on all your cores. `scripts/sim.ts` plays one profile after another on one core; CI already runs the profiles as shards (`--dump`) and puts them together
 * (`--merge`), whose result is byte-identical to one full run. This script does the same on one machine: one child process per profile (at most `--jobs=N`, default the number of cores minus one), then
 * the merge. The wall time drops from the sum of all profiles to about the slowest one (`hardcore-rebirth6-x10`).
 *
 *   npm run sim:parallel                      every profile, writes docs/generated like `npm run sim`
 *   npm run sim:parallel -- --seeds=3         the flags of sim.ts (`--seeds`, `--maxdays`, `--set`, `--legacy`, `--no-write`) go to every shard and to the merge
 *   npm run sim:parallel -- --jobs=4          limit the processes (each needs about 1 GB)
 *
 * Needs no profile names (it always runs all of them, the merge insists on that); for one profile use `npm run sim -- <name>`.
 *
 * @title The parallel sim runner
 * @category Pacing/The sim
 * @order 2
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const TSX = require.resolve('tsx/cli');
const SIM = resolve(process.cwd(), 'scripts', 'sim.ts');

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
	const jobs = Math.max(1, jobsArg ? Number(jobsArg.slice(7)) : cpus().length - 1);
	// every flag of sim.ts goes through; profile names are refused (the merge needs all of them)
	const passed = args.filter((a) => !a.startsWith('--jobs='));
	if (passed.some((a) => !a.startsWith('--')))
		throw new Error('sim:parallel takes flags only: it runs every profile. For one profile use `npm run sim -- <name>`.');

	const profiles = (await sim(['--list'], 'list')).split(/\r?\n/).filter(Boolean);
	if (profiles.length === 0) throw new Error('sim.ts --list printed no profiles');
	// the slowest profiles first, so the long pole starts at once and the short ones fill the gaps
	const slow = ['hardcore-rebirth6-x10', 'human-rebirth6', 'human-rebirth8', 'hardcore-rebirth10', 'human'];
	profiles.sort((a, b) => (slow.indexOf(a) + 1 || 99) - (slow.indexOf(b) + 1 || 99));

	const dir = mkdtempSync(join(tmpdir(), 'idlarz-sim-'));
	mkdirSync(dir, { recursive: true });
	const started = Date.now();
	console.error(`sim:parallel: ${profiles.length} profiles, ${Math.min(jobs, profiles.length)} at a time, shards in ${dir}`);
	try {
		const queue = [...profiles];
		const worker = async () => {
			for (let name = queue.shift(); name; name = queue.shift()) {
				const t = Date.now();
				await sim([`--dump=${join(dir, `${name}.json`)}`, ...passed.filter((a) => a !== '--no-write'), name], name);
				console.error(`sim:parallel: ${name} finished in ${((Date.now() - t) / 1000).toFixed(0)} s`);
			}
		};
		await Promise.all(Array.from({ length: Math.min(jobs, profiles.length) }, worker));
		// the merge writes docs/generated (unless --no-write) and prints the table, exactly as a full run does
		const md = await sim([`--merge=${dir}`, ...passed], 'merge');
		process.stdout.write(md);
		console.error(`sim:parallel: done in ${((Date.now() - started) / 1000).toFixed(0)} s`);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
};

main().catch((error: Error) => {
	console.error(error.message);
	process.exit(1);
});
