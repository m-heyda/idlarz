import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compareVersions, parseChangelog, sortChangelog, type ChangelogEntry } from '../../src/config/changelog';
import { CHANGELOG_DIR, loadChangelog } from '../../src/lib/changelogFiles';

const note = (head: string, date: string, body: string) => `${head}\n${date}\n\n${body}\n`;

test('a bullet note parses', () => {
	const r = parseChangelog(note('# 1.2.3 - Hello', 'date: 2026-11-10', '- one\n- two with **bold**'));
	assert.ok(r.ok);
	assert.deepEqual(r.entry, { version: '1.2.3', title: 'Hello', date: '2026-11-10', body: [{ kind: 'ul', items: ['one', 'two with **bold**'] }] });
});

test('a text note parses into paragraphs, and text and bullets can mix', () => {
	const r = parseChangelog(note('# 1.0.0 - T', 'date: 2026-01-31', 'First line\nsame paragraph.\n\nSecond.\n- a\n- b'));
	assert.ok(r.ok);
	assert.deepEqual(r.entry.body, [
		{ kind: 'p', text: 'First line same paragraph.' },
		{ kind: 'p', text: 'Second.' },
		{ kind: 'ul', items: ['a', 'b'] },
	]);
});

test('CRLF files parse', () => {
	assert.ok(parseChangelog('# 1.0.0 - T\r\ndate: 2026-01-31\r\n\r\n- a\r\n').ok);
});

test('malformed notes are refused with a reason, never thrown', () => {
	const bad: Record<string, string> = {
		'missing date': '# 1.0.0 - T\n\n- a',
		'bad date format': note('# 1.0.0 - T', 'date: 10.11.2026', '- a'),
		'impossible date': note('# 1.0.0 - T', 'date: 2026-02-30', '- a'),
		'bad version': note('# 1.0 - T', 'date: 2026-01-01', '- a'),
		'v prefix': note('# v1.0.0 - T', 'date: 2026-01-01', '- a'),
		'no title': note('# 1.0.0 - ', 'date: 2026-01-01', '- a'),
		'no body': '# 1.0.0 - T\ndate: 2026-01-01\n',
		'heading in body': note('# 1.0.0 - T', 'date: 2026-01-01', '## sub'),
		'link in body': note('# 1.0.0 - T', 'date: 2026-01-01', 'see [x](http://a)'),
		empty: '',
	};
	for (const [name, src] of Object.entries(bad)) {
		const r = parseChangelog(src);
		assert.equal(r.ok, false, name);
	}
});

test('versions sort newest first by number, not text', () => {
	assert.ok(compareVersions('0.10.0', '0.9.0') > 0);
	assert.ok(compareVersions('1.0.0', '0.99.99') > 0);
	assert.equal(compareVersions('1.2.3', '1.2.3'), 0);
	const e = (version: string): ChangelogEntry => ({ version, title: 't', date: '2026-01-01', body: [] });
	assert.deepEqual(
		sortChangelog([e('0.9.0'), e('0.10.0'), e('0.2.0'), e('1.0.0')]).map((x) => x.version),
		['1.0.0', '0.10.0', '0.9.0', '0.2.0'],
	);
});

test('every release note in content/changelog is valid and named after its version', () => {
	const files = fs.readdirSync(CHANGELOG_DIR).filter((f) => f.endsWith('.md') && f !== 'README.md');
	assert.ok(files.length > 0);
	for (const file of files) {
		assert.match(file, /^\d+\.\d+\.\d+\.md$/, file);
		const r = parseChangelog(fs.readFileSync(`${CHANGELOG_DIR}/${file}`, 'utf8'));
		assert.ok(r.ok, `${file}: ${r.ok ? '' : r.error}`);
		assert.equal(`${r.entry.version}.md`, file);
	}
	assert.equal(loadChangelog().length, files.length);
});
