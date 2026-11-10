/**
 * The inputs hash of the generated docs: what lets CI trust `docs/generated` without running every sim again.
 *
 * `npm run docs:gen` (the sim, the balance tables, the fight and loot reports ...) is deterministic and slow. Instead of repeating it on every pull request, `docs:gen` ends by writing
 * `docs/generated/inputs.sha256`: a SHA-256 over **every file the generators import** (found with esbuild from the entry scripts named in the `docs:gen:*` scripts of `package.json`, so a new
 * generator or a new import is picked up by itself) and over `package-lock.json`. Line endings are normalised, so Windows and Linux agree. If any of those files changes, the hash changes:
 * the committed docs may be stale. The CI job `hash` recomputes it (seconds): **fresh** means `docs/generated` was written for exactly these sources, so CI skips the sims; **stale** (a PR that did not run
 * `npm run docs:gen`, or `main` moved under it) means CI runs the full regeneration, as it always did, and fails if the committed files differ. So the hash is only a shortcut, never a reason to fail. The full
 * regeneration also runs on every push to `main`, every night and on a PR labelled `verify-generated`, so a hash written without really regenerating is found within a day.
 *
 *   npx tsx scripts/gen-inputs.ts            print the current hash and whether the committed one matches (exit 0)
 *   npx tsx scripts/gen-inputs.ts --check    exit 1 when the committed hash is stale (the CI job `hash` runs it and picks fast or full by the result)
 *   npx tsx scripts/gen-inputs.ts --write    write docs/generated/inputs.sha256 (the last step of `npm run docs:gen`)
 *   npx tsx scripts/gen-inputs.ts --list     print the files that count
 *
 * @title The generated-docs inputs hash
 * @category Ops/CI
 * @order 2
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const ROOT = process.cwd();
export const HASH_FILE = 'docs/generated/inputs.sha256';

/** The scripts named by `tsx scripts/<file>.ts` in the `docs:gen:*` entries of package.json, following `npm run <name>` one level (so the groups and a new generator are found without a list here). */
export const generatorEntries = (scripts: Record<string, string>): string[] => {
	const entries = new Set<string>();
	const visit = (command: string, depth: number) => {
		for (const part of command.split('&&')) {
			const run = part.match(/npm run ([\w:-]+)/);
			if (run && scripts[run[1]] && depth < 4) visit(scripts[run[1]], depth + 1);
			const file = part.match(/tsx (scripts\/[\w./-]+\.ts)/);
			if (file) entries.add(file[1]);
		}
	};
	for (const [name, command] of Object.entries(scripts)) if (name === 'docs:gen' || name.startsWith('docs:gen:')) visit(command, 0);
	// `docs:gen:sim` runs `sim:parallel`, which only spawns the sim: the sim itself is the real input
	entries.add('scripts/sim.ts');
	return [...entries].sort();
};

/** The hash of named files: path and content (CRLF and a BOM removed), in path order, so it is the same on every machine. */
export const hashFiles = (files: readonly { path: string; text: string }[]): string => {
	const hash = createHash('sha256');
	for (const file of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
		hash.update(`${file.path}\n${file.text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')}\n\0`);
	}
	return hash.digest('hex');
};

/** Every repo file the generators import (relative paths, `/` separators), plus the lockfile. */
export const inputFiles = async (): Promise<string[]> => {
	const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
	const entryPoints = generatorEntries(pkg.scripts);
	if (entryPoints.length === 0) throw new Error('gen-inputs: no generator script found in the docs:gen:* entries of package.json');
	const result = await build({
		entryPoints,
		bundle: true,
		write: false,
		metafile: true,
		platform: 'node',
		format: 'esm',
		packages: 'external', // node_modules is covered by the lockfile
		outdir: 'out',
		logLevel: 'silent',
	});
	return [...Object.keys(result.metafile.inputs), 'package-lock.json'].map((f) => f.split('\\').join('/')).sort();
};

/** The hash of the inputs as the working tree has them now. */
export const currentInputsHash = async (): Promise<{ hash: string; files: string[] }> => {
	const files = await inputFiles();
	return { hash: hashFiles(files.map((path) => ({ path, text: readFileSync(resolve(ROOT, path), 'utf8') }))), files };
};

/** The committed hash, or null when the file does not exist yet. */
export const committedInputsHash = (): string | null => {
	try {
		return readFileSync(resolve(ROOT, HASH_FILE), 'utf8').trim().split(/\s+/)[0] || null;
	} catch {
		return null;
	}
};

const main = async () => {
	const args = process.argv.slice(2);
	const { hash, files } = await currentInputsHash();
	if (args.includes('--list')) {
		console.log(files.join('\n'));
		return;
	}
	if (args.includes('--write')) {
		writeFileSync(resolve(ROOT, HASH_FILE), `${hash}  ${files.length} input files (see scripts/gen-inputs.ts)\n`);
		console.log(`gen-inputs: wrote ${HASH_FILE} (${files.length} input files)`);
		return;
	}
	const committed = committedInputsHash();
	const fresh = committed === hash;
	console.log(
		`gen-inputs: ${files.length} input files, hash ${hash.slice(0, 12)}, committed ${committed ? committed.slice(0, 12) : 'none'}: ${fresh ? 'up to date' : 'STALE'}`,
	);
	if (args.includes('--check') && !fresh) {
		console.error(
			'gen-inputs: a file the generators read has changed since the last `npm run docs:gen`: the committed docs/generated may be stale (run `npm run verify`).',
		);
		process.exit(1);
	}
};

if (process.argv[1] && /gen-inputs\.ts$/.test(process.argv[1].split('\\').join('/'))) {
	main().catch((error: Error) => {
		console.error(error.message);
		process.exit(2);
	});
}
