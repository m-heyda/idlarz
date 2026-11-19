/**
 * The pace sim (`npm run pace`): bots play the **real game store** with a seeded RNG and report when they reach each milestone (tiles, castle levels, click power, levels, the first possible rebirth, every rebirth and what it paid).
 * The engine is `scripts/pace/run.ts`, the profiles `scripts/pace/profiles.ts`, what they buy `scripts/pace/policies.ts`, the tables `scripts/pace/report.ts`.
 *
 *   npx tsx scripts/pace.ts                       every shared profile, writes docs/generated/pace-milestones.md and pace-baseline.json
 *   npx tsx scripts/pace.ts human human-rebirth6  the named profiles
 *   npx tsx scripts/pace.ts --seeds=3             median and min-max over 3 seeds
 *   npx tsx scripts/pace.ts --no-write human      print only (tuning runs; a run that does not cover every shared profile never writes)
 *   npx tsx scripts/pace.ts --except=hardcore-rebirth6-x10   every profile but the named ones (comma separated)
 *   npx tsx scripts/pace.ts --maxdays=60          stop early
 *   npx tsx scripts/pace.ts --class=mage          every profile plays that hero class (`none` is the neutral baseline); a class run writes nothing (`npm run pace:classes`)
 *   npx tsx scripts/pace.ts --set=SCALING_CONFIG.growthLate=1.25   try a tweak without editing files
 *   npx tsx scripts/pace.ts --list / --list-local print the shared / local-only profile names
 *   npx tsx scripts/pace.ts --dump=shard.json p1 p2   run the profiles and save the raw results only (a CI shard)
 *   npx tsx scripts/pace.ts --merge=dir           run nothing: merge the dumps in dir (every shared profile exactly once) and write the docs as a full run does
 *
 * **Rules for a balance change**: change one parameter group, run `npm run pace -- --seeds=3`, compare with the committed `pace-milestones.md`, keep the targets, then `npm run docs:gen:fast` and commit the diff. The pacing guard (`comparePacing`) compares the
 * baseline with the base branch in CI. A profile that is not in the shared list (`localOnly`) is run by name and writes nothing: `npm run pace:local`.
 *
 * @title The pace sim
 * @category Pacing/The sim
 * @order 2
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadCtx, runProfile, type Milestones, type RunResult } from './pace/run';
import { PROFILES, localProfiles, sharedProfiles } from './pace/profiles';
import { mergeSeeds, renderBaseline, renderMagnitudes, renderMarkdown, renderOptimiser, type PaceDump } from './pace/report';

const DOCS = resolve(process.cwd(), 'docs/generated');

const main = async () => {
	const args = process.argv.slice(2);
	const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
	const shared = sharedProfiles();
	if (args.includes('--list-local')) return void console.log(localProfiles().join('\n'));
	// the profile names, one per line (scripts/pace-parallel.ts asks for them so its list cannot drift from this one); the local probes are not in it
	if (args.includes('--list')) return void console.log(shared.join('\n'));

	const names = args.filter((a) => !a.startsWith('--'));
	const except = new Set((flag('except') ?? '').split(',').filter(Boolean));
	for (const name of [...except, ...names]) if (!PROFILES[name]) throw new Error(`unknown profile ${name}`);
	const mergeDir = flag('merge');
	const dumpFile = flag('dump');
	const selected = mergeDir ? shared : names.length ? names : shared.filter((n) => !except.has(n));
	const localRun = selected.some((n) => PROFILES[n].localOnly);
	if (localRun && (dumpFile || mergeDir)) throw new Error('a local-only profile cannot be dumped or merged: it is not part of the CI shards or the docs');
	const seeds = Math.max(1, Number(flag('seeds') ?? 1));
	const playerClass = flag('class') ?? 'none';

	const results: Record<string, Milestones> = {};
	const spreads: PaceDump['spreads'] = {};
	const magnitudes: PaceDump['magnitudes'] = {};
	const tileWaits: PaceDump['tileWaits'] = {};

	if (mergeDir) {
		// the shards' raw results in place of a run; every profile must be there exactly once, so a profile added to PROFILES but missing from a CI shard fails loudly
		const dumps = readdirSync(mergeDir)
			.filter((f) => f.endsWith('.json'))
			.sort()
			.map((f) => JSON.parse(readFileSync(resolve(mergeDir, f), 'utf8')) as PaceDump);
		for (const name of selected) {
			const found = dumps.filter((d) => d.results[name]);
			if (found.length !== 1) throw new Error(`--merge: profile ${name} is in ${found.length} shard files under ${mergeDir}, expected exactly 1`);
			results[name] = found[0].results[name];
			spreads[name] = found[0].spreads[name];
			if (found[0].magnitudes[name]) magnitudes[name] = found[0].magnitudes[name];
			if (found[0].tileWaits[name]) tileWaits[name] = found[0].tileWaits[name];
		}
		for (const d of dumps)
			for (const name of Object.keys(d.results)) if (!selected.includes(name)) throw new Error(`--merge: shard has unknown profile ${name}`);
	} else {
		const ctx = await loadCtx({
			playerClass,
			maxDays: flag('maxdays') ? Number(flag('maxdays')) : undefined,
			overrides: args.filter((a) => a.startsWith('--set=')).map((a) => a.slice(6)),
		});
		for (const name of selected) {
			const started = Date.now();
			const runs: RunResult[] = [];
			for (let seed = 0; seed < seeds; seed++) runs.push(runProfile(name, PROFILES[name], ctx, seed));
			const merged = mergeSeeds(runs);
			results[name] = merged.milestones;
			spreads[name] = merged.spread;
			magnitudes[name] = runs[runs.length - 1].magnitudes; // the last seed wins
			tileWaits[name] = runs[runs.length - 1].tileWaits;
			console.error(`${name}: done in ${((Date.now() - started) / 1000).toFixed(1)}s (${seeds} seed${seeds > 1 ? 's' : ''})`);
		}
	}

	if (dumpFile) {
		writeFileSync(resolve(dumpFile), JSON.stringify({ results, spreads, magnitudes, tileWaits } satisfies PaceDump));
		console.error(`Wrote ${resolve(dumpFile)} (${selected.join(', ')}); nothing else`);
		return;
	}

	const md = renderMarkdown(results, magnitudes, tileWaits, seeds > 1 ? spreads : undefined);
	console.log(localRun ? renderOptimiser(results, selected, magnitudes) : md);
	if (!localRun) for (const w of renderMagnitudes(selected, magnitudes).warnings) console.error(`WARNING outside the @category Pacing band: ${w}`);
	// only a run of every shared profile with the neutral class writes the docs: a partial run would turn the baseline into a subset
	const complete = shared.every((n) => selected.includes(n));
	if (playerClass === 'none' && !localRun && complete && !args.includes('--no-write') && !flag('maxdays') && !args.some((a) => a.startsWith('--set='))) {
		mkdirSync(DOCS, { recursive: true });
		writeFileSync(resolve(DOCS, 'pace-milestones.md'), md);
		writeFileSync(resolve(DOCS, 'pace-baseline.json'), renderBaseline(results));
		console.error(`Wrote ${resolve(DOCS, 'pace-milestones.md')} and pace-baseline.json`);
	}
};

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
