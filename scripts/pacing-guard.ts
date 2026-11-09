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
