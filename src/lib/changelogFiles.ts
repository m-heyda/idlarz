import fs from 'node:fs';
import path from 'node:path';
import { parseChangelog, sortChangelog, type ChangelogEntry } from '@/config/changelog';

/** The folder of release notes (`content/changelog/<version>.md`). */
export const CHANGELOG_DIR = path.join(process.cwd(), 'content', 'changelog');

/** Reads every release note in `dir`, newest version first. A malformed file (or one whose name is not its version) is skipped with a console warning, so one typo never takes the page down; `tests/ui/changelog.test.ts` is what catches it. Server only (build time). */
export const loadChangelog = (dir: string = CHANGELOG_DIR): ChangelogEntry[] => {
	const entries: ChangelogEntry[] = [];
	for (const file of fs.readdirSync(dir)) {
		if (!/^\d+\.\d+\.\d+\.md$/.test(file)) continue;
		const parsed = parseChangelog(fs.readFileSync(path.join(dir, file), 'utf8'));
		if (!parsed.ok) console.warn(`changelog: ${file} skipped: ${parsed.error}`);
		else if (`${parsed.entry.version}.md` !== file) console.warn(`changelog: ${file} skipped: heading says ${parsed.entry.version}`);
		else entries.push(parsed.entry);
	}
	return sortChangelog(entries);
};
