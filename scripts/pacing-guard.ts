/**
 * The pacing guard, and how CI generates the docs.
 *
 * `npm run sim` writes `docs/generated/sim-baseline.json`; CI (job `generated`) runs this script, which compares it with the copy on the base branch and fails the PR when a guarded milestone moves by more than +-15 % **or by more than 5 game days**
 * (`PACING_MAX_DRIFT_DAYS` in `scripts/pacingCompare.ts`; without it a milestone at day 220 could drift for a month inside 15 %). The job log starts with a table per profile (guarded milestones, how many moved, the largest move in percent and days).
 * Regenerating the baseline cannot hide a change, because the comparison is against the base branch. An intended pacing change carries the `pacing-change` label: the guard then prints the report and passes. The label only takes effect on a new run,
 * so **re-run the job after adding it**.
 *
 * **CI sharding.** The job `generated` is three stages: `scope` (does the PR touch what the docs come from), `generate` (a matrix that runs in parallel: the profile `hardcore-rebirth6-x10` alone, about 5 minutes; every other sim profile via `--except`;
 * the three groups `docs:gen:rest:quick|fights|loot` of the other generators; a new generator goes into one of those scripts), and `generated` (the required check), which downloads the shards, runs `sim --merge` and then the two gates (stale docs, pacing guard).
 * Wall time is about the slowest shard, not the sum. A new sim profile joins the `sim-rest` shard by itself; a profile in two shards or in none fails the merge.
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
			'If this change is intended, add the `pacing-change` label to the PR (and re-run the job); the numbers are in docs/generated/sim-milestones.md.',
		);
		process.exit(1);
	}
}
