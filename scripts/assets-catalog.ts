// `npm run assets:catalog` writes docs/assets/; `--check` fails when the committed files differ (used by tests/docs/assets.test.ts and the pre-commit hook).
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, buildManifest } from './assets/manifest';
import { renderAll } from './assets/render';
import { buildSounds } from './assets/sounds';

const readNames = (): Record<string, string> => JSON.parse(readFileSync(join(ROOT, 'scripts', 'assets', 'names.json'), 'utf8'));

export const OUT = join(ROOT, 'docs', 'assets');

/** Names of files in docs/assets that are out of date (missing, different or stale) */
export const staleFiles = (): string[] => {
	const files = renderAll(buildManifest(), buildSounds(readNames()));
	const stale = Object.entries(files)
		.filter(([n, text]) => !existsSync(join(OUT, n)) || readFileSync(join(OUT, n), 'utf8') !== text)
		.map(([n]) => n);
	const extra = existsSync(OUT) ? readdirSync(OUT).filter((n) => !(n in files)) : [];
	return [...stale, ...extra];
};

if (require.main === module) {
	if (process.argv.includes('--check')) {
		const stale = staleFiles();
		if (stale.length) {
			console.error(`docs/assets is stale (${stale.join(', ')}); run \`npm run assets:catalog\``);
			process.exit(1);
		}
		console.log('docs/assets is up to date');
	} else {
		const files = renderAll(buildManifest(), buildSounds(readNames()));
		mkdirSync(OUT, { recursive: true });
		for (const n of readdirSync(OUT)) if (!(n in files)) rmSync(join(OUT, n));
		for (const [n, text] of Object.entries(files)) writeFileSync(join(OUT, n), text);
		console.log(`wrote ${Object.keys(files).length} files to docs/assets`);
	}
}
