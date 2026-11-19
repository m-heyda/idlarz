/**
 * `npm run pace:parallel`: the full sim on all your cores. `scripts/pace.ts` plays one profile after another on one core; CI already runs the profiles as shards (`--dump`) and puts them together
 * (`--merge`), whose result is byte-identical to one full run. This script does the same on one machine: one child process per profile (at most `--jobs=N`, default the number of cores minus one), then
 * the merge. The wall time drops from the sum of all profiles to about the slowest one (`hardcore-rebirth6-x10`).
 *
 *   npm run pace:parallel                      every profile, writes docs/generated like `npm run pace`
 *   npm run pace:parallel -- --seeds=3         the flags of pace.ts (`--seeds`, `--maxdays`, `--set`, `--legacy`, `--no-write`) go to every shard and to the merge
 *   npm run pace:parallel -- --jobs=4          limit the processes (each needs about 1 GB)
 *
 * Needs no profile names (it always runs all of them, the merge insists on that); for one profile use `npm run pace -- <name>`.
 *
 * @title The parallel sim runner
 * @category Pacing/The sim
 * @order 5
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const TSX = require.resolve('tsx/cli');
const SIM = resolve(process.cwd(), 'scripts', 'pace.ts');

/** Runs `node tsx scripts/pace.ts ...args` and resolves with its stdout (stderr is passed on with a prefix); rejects on a non-zero exit. */
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
	// every flag of pace.ts goes through; profile names are refused (the merge needs all of them)
	const passed = args.filter((a) => !a.startsWith('--jobs='));
	if (passed.some((a) => !a.startsWith('--')))
		throw new Error('pace:parallel takes flags only: it runs every profile. For one profile use `npm run pace -- <name>`.');

	const profiles = (await sim(['--list'], 'list')).split(/\r?\n/).filter(Boolean);
	if (profiles.length === 0) throw new Error('pace.ts --list printed no profiles');
	// the slowest profiles first, so the long pole starts at once and the short ones fill the gaps
	const slow = [
		'human-rebirth6',
		'human-rebirth6-builder2',
		'human-rebirth6-gems',
		'human-rebirth6-economy',
		'human-rebirth6-full',
		'human-rebirth8',
		'autoclicker',
		'hardcore-rebirth10',
		'hardcore-rebirth6-x10',
	];
	profiles.sort((a, b) => (slow.indexOf(a) + 1 || 99) - (slow.indexOf(b) + 1 || 99));

	const dir = mkdtempSync(join(tmpdir(), 'idlarz-pace-'));
	mkdirSync(dir, { recursive: true });
	const started = Date.now();
	console.error(`pace:parallel: ${profiles.length} profiles, ${Math.min(jobs, profiles.length)} at a time, shards in ${dir}`);
	try {
		const queue = [...profiles];
		const worker = async () => {
			for (let name = queue.shift(); name; name = queue.shift()) {
				const t = Date.now();
				await sim([`--dump=${join(dir, `${name}.json`)}`, ...passed.filter((a) => a !== '--no-write'), name], name);
				console.error(`pace:parallel: ${name} finished in ${((Date.now() - t) / 1000).toFixed(0)} s`);
			}
		};
		await Promise.all(Array.from({ length: Math.min(jobs, profiles.length) }, worker));
		// the merge writes docs/generated (unless --no-write) and prints the table, exactly as a full run does
		const md = await sim([`--merge=${dir}`, ...passed], 'merge');
		process.stdout.write(md);
		console.error(`pace:parallel: done in ${((Date.now() - started) / 1000).toFixed(0)} s`);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
};

main().catch((error: Error) => {
	console.error(error.message);
	process.exit(1);
});
