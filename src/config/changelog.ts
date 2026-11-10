// The changelog window on the landing page (`/`): one release note per version, written as markdown in `content/changelog/` (format in its README).
// This file is pure (types, parse, sort); `src/lib/changelogFiles.ts` reads the files at build time.

/** One block of a release note body: a paragraph of text or a bullet list. Text may carry `**bold**`. */
export type ChangelogBlock = { kind: 'p'; text: string } | { kind: 'ul'; items: readonly string[] };

export interface ChangelogEntry {
	/** `major.minor.patch` */
	version: string;
	title: string;
	/** ISO date `YYYY-MM-DD`. */
	date: string;
	body: readonly ChangelogBlock[];
}

export type ChangelogParse = { ok: true; entry: ChangelogEntry } | { ok: false; error: string };

const HEADING = /^# (\d+\.\d+\.\d+) - (\S.*)$/;
const DATE = /^date: (\d{4}-\d{2}-\d{2})$/;

const isRealDate = (iso: string): boolean => {
	const d = new Date(`${iso}T00:00:00Z`);
	return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
};

/** Parses one release note file (format: `content/changelog/README.md`). Never throws; a malformed file gives `{ ok: false, error }`. */
export const parseChangelog = (source: string): ChangelogParse => {
	const lines = source.replace(/\r\n?/g, '\n').trim().split('\n');
	const heading = HEADING.exec((lines[0] ?? '').trimEnd());
	if (!heading) return { ok: false, error: 'line 1 must be "# <major.minor.patch> - <title>"' };
	const date = DATE.exec((lines[1] ?? '').trimEnd());
	if (!date) return { ok: false, error: 'line 2 must be "date: YYYY-MM-DD"' };
	if (!isRealDate(date[1])) return { ok: false, error: `"${date[1]}" is not a real date` };

	const body: ChangelogBlock[] = [];
	let para: string[] = [];
	let list: string[] = [];
	const flush = () => {
		if (para.length) body.push({ kind: 'p', text: para.join(' ') });
		if (list.length) body.push({ kind: 'ul', items: list });
		para = [];
		list = [];
	};
	for (const [i, raw] of lines.slice(2).entries()) {
		const line = raw.trimEnd();
		if (line === '') {
			flush();
		} else if (line.startsWith('- ')) {
			if (para.length) flush();
			list.push(line.slice(2).trim());
		} else if (/^(#|>|\d+\.|\*\s|```|<)/.test(line) || /\[[^\]]*\]\(/.test(line) || /`/.test(line)) {
			return { ok: false, error: `line ${i + 3}: only paragraphs, "- " bullets and **bold** are allowed` };
		} else {
			if (list.length) flush();
			para.push(line.trim());
		}
	}
	flush();
	if (body.length === 0) return { ok: false, error: 'the note has no body' };
	if (body.some((b) => b.kind === 'ul' && b.items.some((t) => t === ''))) return { ok: false, error: 'empty bullet' };
	return { ok: true, entry: { version: heading[1], title: heading[2].trim(), date: date[1], body } };
};

/** Compares two `major.minor.patch` versions numerically (negative when `a` is older). */
export const compareVersions = (a: string, b: string): number => {
	const pa = a.split('.').map(Number);
	const pb = b.split('.').map(Number);
	for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
	return 0;
};

/** Newest version first (semver, not text order: 0.10.0 above 0.9.0). */
export const sortChangelog = (entries: readonly ChangelogEntry[]): ChangelogEntry[] => [...entries].sort((a, b) => compareVersions(b.version, a.version));
