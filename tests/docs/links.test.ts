import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

// Every relative markdown link in docs/ and the root README must point at a file or folder that exists.
// docs/generated is written by `npm run docs:gen` and checked by the CI `generated` job, so it is skipped.

const ROOT = resolve(__dirname, '..', '..');

function markdownFiles(dir: string): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) {
			if (name === 'generated') continue;
			out.push(...markdownFiles(full));
		} else if (name.endsWith('.md')) out.push(full);
	}
	return out;
}

const LINK = /\]\(([^)\s]+)\)/g;

test('relative markdown links in docs/ and README.md resolve', () => {
	const files = [join(ROOT, 'README.md'), ...markdownFiles(join(ROOT, 'docs'))];
	const broken: string[] = [];
	for (const file of files) {
		const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
		for (const m of text.matchAll(LINK)) {
			const target = m[1];
			if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) continue;
			const path = decodeURIComponent(target.split('#')[0]);
			if (!path) continue;
			if (!existsSync(resolve(dirname(file), path))) broken.push(`${relative(ROOT, file)} -> ${target}`);
		}
	}
	assert.deepEqual(broken, [], `broken links:\n${broken.join('\n')}`);
});
