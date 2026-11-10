/**
 * `npm run sim:classes`: the class picker's pacing acceptance (IDL-70, IDL-78, RELEASE-PLAN B7). Plays `idle` and `casual` (or the profiles named on the command line) once with no class (the neutral baseline
 * the committed numbers are measured with) and once with each hero class, all at the same time in separate processes, then compares every guarded milestone of each class run with the baseline using the pacing guard's own rule
 * (`comparePacing`: +-15 % and 5 game days). The last line is the acceptance line, and the exit code is 1 when a class moves a milestone out of the band. Writes nothing under docs/.
 *
 *   npm run sim:classes                       idle and casual, every class
 *   npm run sim:classes -- human --maxdays=60 other profiles and the other flags of sim.ts go through
 *
 * The sim bots play the real store, so they carry the XP, tile-discount and fight passives; offline efficiency and chest speed act on the server's grants and tickets, which the sim does not model.
 *
 * @title The class picker acceptance
 * @category Pacing/The sim
 * @order 3
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { PLAYER_CLASS_ORDER } from '../src/config/playerClasses';
import { PACING_MAX_DRIFT_DAYS, PACING_TOLERANCE, comparePacing, formatSummary, formatViolations, type PacingBaseline } from './pacingCompare';

const require = createRequire(import.meta.url);
const TSX = require.resolve('tsx/cli');
const SIM = resolve(process.cwd(), 'scripts', 'sim.ts');

/** Runs one sim (`--dump`: the raw results only) and resolves with its milestones. */
const run = (cls: string, args: string[], dir: string): Promise<PacingBaseline> =>
	new Promise((done, fail) => {
		const file = join(dir, `${cls}.json`);
		const child = spawn(process.execPath, [TSX, SIM, ...args, `--class=${cls}`, `--dump=${file}`], { stdio: ['ignore', 'ignore', 'pipe'] });
		child.stderr.on('data', (chunk: Buffer) => {
			for (const line of chunk.toString().split(/\r?\n/)) if (line.trim()) console.error(`[${cls}] ${line}`);
		});
		child.on('error', fail);
		child.on('close', (code) => {
			if (code !== 0) return fail(new Error(`${cls} exited with code ${code}`));
			done({ profiles: (JSON.parse(readFileSync(file, 'utf8')) as { results: PacingBaseline['profiles'] }).results });
		});
	});

const main = async () => {
	const passed = process.argv.slice(2);
	const names = passed.filter((a) => !a.startsWith('--'));
	const flags = passed.filter((a) => a.startsWith('--') && !a.startsWith('--class=') && !a.startsWith('--dump=') && !a.startsWith('--merge='));
	const args = [...(names.length ? names : ['idle', 'casual']), ...flags];
	const dir = mkdtempSync(join(tmpdir(), 'idlarz-sim-classes-'));
	try {
		const classes = ['none', ...PLAYER_CLASS_ORDER];
		const runs = await Promise.all(classes.map((cls) => run(cls, args, dir)));
		const baseline = runs[0];
		let bad = 0;
		classes.slice(1).forEach((cls, i) => {
			const current = runs[i + 1];
			console.log(`\n### ${cls} against the neutral baseline\n`);
			console.log(formatSummary(baseline, current));
			const violations = comparePacing(baseline, current);
			if (violations.length) {
				bad += violations.length;
				console.log(formatViolations(violations));
			}
		});
		console.log(
			`\nAcceptance (IDL-78): ${args.filter((a) => !a.startsWith('--')).join(', ')} with each class (${PLAYER_CLASS_ORDER.join(', ')}) against no class, guarded milestones within ±${PACING_TOLERANCE * 100} % and ±${PACING_MAX_DRIFT_DAYS} days: ${bad === 0 ? 'PASS' : `FAIL (${bad} milestone(s) outside)`}`,
		);
		if (bad) process.exitCode = 1;
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
};

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
