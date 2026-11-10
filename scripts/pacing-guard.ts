/**
 * The pacing guard, and how CI generates the docs.
 *
 * `npm run sim` writes `docs/generated/sim-baseline.json`; CI (job `generated`) runs this script, which compares it with the copy on the base branch and fails the PR when a guarded milestone moves by more than +-15 % **or by more than 5 game days**
 * (`PACING_MAX_DRIFT_DAYS` in `scripts/pacingCompare.ts`; without it a milestone at day 220 could drift for a month inside 15 %). The job log starts with a table per profile (guarded milestones, how many moved, the largest move in percent and days).
 * Regenerating the baseline cannot hide a change, because the comparison is against the base branch. An intended pacing change carries the `pacing-change` label: the guard then prints the report and passes. The label is read when a run starts,
 * so after adding it **push a commit or close and reopen the PR** ("Re-run jobs" keeps the labels of the old run).
 *
 * **Where the work runs.** The slow part (the sims and reports behind `docs/generated`) is done on your machine: `npm run verify` (also run by the `pre-push` hook) regenerates it in parallel on all cores when a file the generators read has changed, and writes `docs/generated/inputs.sha256` (`scripts/gen-inputs.ts`). In CI the job `hash` recomputes that hash (seconds). With a fresh hash the sims are skipped and the job `generated` only runs this guard on the committed baseline against the base branch's. With a stale hash (a PR that did not regenerate, or `main` moved) and always on a push to `main`, every night and on a PR labelled `verify-generated`, the full regeneration runs, sharded (`sim-x10` alone, `sim-rest`, and `docs:gen:rest:quick|fights|loot`; `generated` merges them, a profile in two shards or in none fails the merge, and the committed files must equal the result).
 *
 * @title The pacing guard and CI sharding
 * @category Ops/CI
 * @order 1
 */
// The pacing guard: fails (exit 1) when a key milestone of the sim moved by more than 15 % or more than 5 game days against a base. Prints a summary table first.
//
//   npx tsx scripts/pacing-guard.ts --base=<baseline.json> [--current=docs/generated/sim-baseline.json] [--allow-violations]
//
// `--current` is what `npm run sim` just wrote; `--base` is the same file as it is on the branch the PR targets. CI extracts it with
// `git show origin/<base>:docs/generated/sim-baseline.json`, so a PR cannot pass by regenerating the baseline with its own numbers.
// An intended pacing change carries the `pacing-change` label: CI then passes `--allow-violations`, so the guard prints the report but exits 0.
// Only violations are excused: a missing or malformed file still exits non-zero (2), and so does a crash.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PACING_MAX_DRIFT_DAYS, PACING_TOLERANCE, comparePacing, formatSummary, formatViolations, type PacingBaseline } from './pacingCompare';

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const fail = (message: string): never => {
	console.error(`Pacing guard: ${message}`);
	return process.exit(2);
};
const load = (path: string): PacingBaseline => {
	let data: Partial<PacingBaseline> | null;
	try {
		data = JSON.parse(readFileSync(resolve(path), 'utf8')) as Partial<PacingBaseline> | null;
	} catch (error) {
		return fail(`cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!data || typeof data.profiles !== 'object' || data.profiles === null) return fail(`${path} has no "profiles" object`);
	return data as PacingBaseline;
};

const basePath = arg('base');
if (!basePath) fail('usage: pacing-guard.ts --base=<baseline.json> [--current=docs/generated/sim-baseline.json] [--allow-violations]');
const currentPath = arg('current') ?? 'docs/generated/sim-baseline.json';

const baseData = load(basePath as string);
const currentData = load(currentPath);
console.log(formatSummary(baseData, currentData));
const violations = comparePacing(baseData, currentData);
if (violations.length === 0) {
	console.log(`Pacing guard: every guarded milestone is within ±${PACING_TOLERANCE * 100} % and ±${PACING_MAX_DRIFT_DAYS} days of the base.`);
} else {
	const allowed = process.argv.includes('--allow-violations');
	console.error(
		`Pacing guard: ${violations.length} milestone(s) moved by more than ±${PACING_TOLERANCE * 100} % or ±${PACING_MAX_DRIFT_DAYS} days (game days, ${currentPath} against ${basePath}):`,
	);
	console.error(formatViolations(violations));
	if (allowed) {
		console.error('Allowed by the `pacing-change` label; the numbers are in docs/generated/sim-milestones.md.');
	} else {
		console.error(
			'If this change is intended, add the `pacing-change` label to the PR (then push a commit or reopen the PR: re-running keeps the old labels); the numbers are in docs/generated/sim-milestones.md.',
		);
		process.exit(1);
	}
}
