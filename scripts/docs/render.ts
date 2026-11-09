/**
 * Turns the parsed JSDoc entries into the files of docs/reference: one Markdown page per category, the symbol index, the known-issues page,
 * the code map, a JSON dump for tools and one self-contained HTML page. Pure: returns `{ path: content }`, the CLI writes it.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { marked } from 'marked';
import { CATEGORIES, REFERENCE_INTRO } from './structure';
import { fileSummary, type DocEntry } from './parse';
import { TABLES } from './tables';
import './tableDefs'; // registers every table

const GENERATED_NOTE = '> Generated from the JSDoc in the code by `npm run docs:code`. Do not edit: change the JSDoc next to the code and commit (the pre-commit hook regenerates this).';

type LinkFn = (target: DocEntry) => string;

const categoryDef = (e: DocEntry) => CATEGORIES.find((c) => c.name === e.category[0])!;
const pageOf = (e: DocEntry) => `${categoryDef(e).slug}.md`;
const sectionOf = (e: DocEntry) => e.category[1] ?? 'General';
/** A plain symbol is shown as code; a topic, or a symbol that carries its own `@title`, as text. */
const isCode = (e: DocEntry): boolean => e.kind !== 'topic' && e.name === e.symbol;
const label = (e: DocEntry): string => (isCode(e) ? `\`${e.name}\`` : e.name);

export function validate(entries: DocEntry[]): string[] {
	const problems: string[] = [];
	for (const e of entries) {
		if (!CATEGORIES.some((c) => c.name === e.category[0])) {
			problems.push(`${e.file}:${e.line} ${e.name}: unknown category "${e.category.join('/')}" (known: ${CATEGORIES.map((c) => c.name).join(', ')})`);
		}
		if (!e.summary) problems.push(`${e.file}:${e.line} ${e.name}: no description`);
		for (const t of e.tables) if (!TABLES[t]) problems.push(`${e.file}:${e.line} ${e.name}: unknown @table "${t}"`);
	}
	return problems;
}

function sorted(entries: DocEntry[]): DocEntry[] {
	return entries
		.map((e, i) => ({ e, i }))
		.sort((a, b) => (a.e.order || 1000) - (b.e.order || 1000) || a.i - b.i)
		.map((x) => x.e);
}

function byCategory(entries: DocEntry[]): Map<string, Map<string, DocEntry[]>> {
	const out = new Map<string, Map<string, DocEntry[]>>();
	for (const c of CATEGORIES) out.set(c.name, new Map());
	for (const e of sorted(entries)) {
		const sections = out.get(e.category[0])!;
		const list = sections.get(sectionOf(e)) ?? [];
		list.push(e);
		sections.set(sectionOf(e), list);
	}
	// sections in the order the category lists them, unlisted ones after, in order of appearance
	for (const def of CATEGORIES) {
		const sections = out.get(def.name)!;
		const rank = (name: string) => {
			const i = (def.sections ?? []).indexOf(name);
			return i < 0 ? 1000 : i;
		};
		out.set(def.name, new Map([...sections].sort((a, b) => rank(a[0]) - rank(b[0]))));
	}
	return out;
}

function resolveLinks(text: string, byName: Map<string, DocEntry>, link: LinkFn): string {
	return text.replace(/\{@link\s+([^}\s]+)\}/g, (_m, name: string) => {
		const t = byName.get(name);
		return t ? `[\`${name}\`](${link(t)})` : `\`${name}\``;
	});
}

export function entryMarkdown(e: DocEntry, byName: Map<string, DocEntry>, link: LinkFn, srcPrefix: string, level = 3): string {
	const h = '#'.repeat(level);
	const out: string[] = [];
	const kind = isCode(e) ? ` <small>${e.kind}</small>` : '';
	out.push(`<a id="${e.id}"></a>`, '', `${h} ${label(e)}${kind}`, '');
	out.push(`Source: [\`${e.file}:${e.line}\`](${srcPrefix}${e.file})`, '');
	if (e.body) out.push(resolveLinks(e.body, byName, link), '');
	for (const f of e.formulas) out.push('**Formula**', '', '```text', f, '```', '');
	for (const x of e.examples) out.push('**Example**', '', '```text', x, '```', '');
	for (const id of e.tables) {
		const t = TABLES[id]();
		out.push(`**${t.title}** _(computed from the code)_`, '', t.md.trim(), '');
	}
	if (e.params.length) out.push('**Parameters**', '', ...e.params.map((p) => `- ${p}`), '');
	if (e.returns.length) out.push('**Returns**', '', ...e.returns.map((p) => `- ${p}`), '');
	if (e.knownIssues.length) out.push('**Known issues**', '', ...e.knownIssues.map((k) => `- ${resolveLinks(k, byName, link)}`), '');
	if (e.see.length) {
		const items = e.see.map((s) => {
			const t = byName.get(s);
			return t ? `[\`${s}\`](${link(t)})` : `\`${s}\``;
		});
		out.push(`See also: ${items.join(', ')}`, '');
	}
	return out.join('\n');
}

function categoryPage(def: (typeof CATEGORIES)[number], sections: Map<string, DocEntry[]>, byName: Map<string, DocEntry>): string {
	const link: LinkFn = (t) => `${pageOf(t)}#${t.id}`;
	const out = [`# ${def.name}`, '', GENERATED_NOTE, '', def.blurb, ''];
	if (!sections.size) return [...out, '_Nothing documented in this category yet._', ''].join('\n');
	out.push('**Contents**', '');
	for (const [section, list] of sections) {
		out.push(`- ${section}: ${list.map((e) => `[${label(e)}](#${e.id})`).join(', ')}`);
	}
	out.push('');
	for (const [section, list] of sections) {
		out.push(`## ${section}`, '');
		for (const e of list) out.push(entryMarkdown(e, byName, link, '../../'));
	}
	return out.join('\n');
}

/** One short sentence for the index: links flattened, cut at the first sentence end or 150 characters. */
const shortSummary = (text: string): string => {
	const plain = text.replace(/{@link\s+([^}\s]+)}/g, '$1').replace(/\|/g, '\\|');
	const end = plain.search(/[.:;] /);
	const sentence = end > 0 ? plain.slice(0, end + 1) : plain;
	return sentence.length > 150 ? `${sentence.slice(0, 147).trimEnd()}...` : sentence;
};

function symbolsPage(entries: DocEntry[]): string {
	const rows = [...entries]
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((e) => `| ${label(e)} | ${e.category.join(' / ')} | [\`${e.file}:${e.line}\`](../../${e.file}) | ${shortSummary(e.summary)} |`);
	return ['# Symbol index', '', GENERATED_NOTE, '', 'Every documented function, constant and topic, with the file to open. Search this page first when you look for where a rule lives.', '', '| Name | Category | Source | What |', '| --- | --- | --- | --- |', ...rows, ''].join('\n');
}

function issuesPage(entries: DocEntry[], byName: Map<string, DocEntry>): string {
	const link: LinkFn = (t) => `${pageOf(t)}#${t.id}`;
	const out = ['# Known issues in the code', '', GENERATED_NOTE, '', 'Open code-side findings, each written as `@knownissue` on the code it is about. Fix the code, then delete the tag.', ''];
	const withIssues = entries.filter((e) => e.knownIssues.length);
	if (!withIssues.length) out.push('_None._', '');
	for (const e of withIssues) {
		out.push(`### [\`${e.name}\`](${link(e)}) — [\`${e.file}:${e.line}\`](../../${e.file})`, '');
		for (const k of e.knownIssues) out.push(`- ${resolveLinks(k, byName, link)}`);
		out.push('');
	}
	return out.join('\n');
}

function codeMapPage(root: string): string {
	const out = ['# Code map', '', GENERATED_NOTE, '', "Every source file with the first sentence of its leading comment. A leading `~` means the file has none and the line is the first JSDoc found in it: give the file a comment of its own.", ''];
	for (const top of ['src', 'scripts', 'e2e', 'tests', 'supabase']) {
		const files: string[] = [];
		const walk = (dir: string) => {
			for (const name of readdirSync(dir).sort()) {
				const full = join(dir, name);
				if (statSync(full).isDirectory()) {
					if (!['node_modules', '.next', 'pixel', 'fixtures', 'previews', 'reference'].includes(name)) walk(full);
				} else if (/\.(ts|tsx|mjs|sql)$/.test(name) && !name.endsWith('.d.ts')) files.push(relative(root, full).split(sep).join('/'));
			}
		};
		try {
			walk(join(root, top));
		} catch {
			continue;
		}
		let dir = '';
		out.push(`## ${top}/`, '');
		for (const f of files) {
			const d = f.slice(0, f.lastIndexOf('/'));
			if (d !== dir) {
				dir = d;
				out.push('', `**${d}/**`, '');
			}
			const summary = f.endsWith('.sql') ? '' : fileSummary(root, f);
			out.push(`- [\`${f.slice(f.lastIndexOf('/') + 1)}\`](../../${f})${summary ? ` — ${summary}` : ''}`);
		}
		out.push('');
	}
	return out.join('\n');
}

const HTML_CSS = `
:root{--bg:#fbfaf7;--fg:#1d1b17;--muted:#6b665c;--card:#fff;--line:#e5e0d4;--accent:#9a5b13;--code:#f3efe4;--side:#f3efe4}
@media (prefers-color-scheme:dark){:root{--bg:#161512;--fg:#ece7da;--muted:#a49d8b;--card:#1e1c18;--line:#34312a;--accent:#e0a050;--code:#26231e;--side:#1b1915}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}
a{color:var(--accent)}code,pre{font:13px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace}
code{background:var(--code);padding:1px 4px;border-radius:4px}pre{background:var(--code);padding:10px 12px;border-radius:6px;overflow:auto}pre code{background:none;padding:0}
.layout{display:flex;min-height:100vh}nav{width:290px;flex:none;background:var(--side);border-right:1px solid var(--line);padding:14px;position:sticky;top:0;height:100vh;overflow:auto}
nav input{width:100%;padding:7px 9px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--fg);margin-bottom:10px}
nav h3{margin:14px 0 4px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}nav a{display:block;padding:1px 0;text-decoration:none;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
nav .sub{margin-left:10px;color:var(--muted);font-size:12px;margin-top:4px}
main{flex:1;min-width:0;max-width:980px;padding:8px 28px 80px}
h1{margin:20px 0 4px}h2{margin-top:30px;border-bottom:1px solid var(--line);padding-bottom:4px}h2.cat{font-size:26px;margin-top:56px}
article{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:6px 16px 8px;margin:14px 0}article h3{margin:12px 0 4px}
small{color:var(--muted);font-weight:400;font-size:12px}table{border-collapse:collapse;display:block;overflow:auto;margin:8px 0}th,td{border:1px solid var(--line);padding:3px 8px;text-align:left;vertical-align:top}th{background:var(--code)}
.hidden{display:none}.blurb{color:var(--muted)}
@media (max-width:800px){.layout{display:block}nav{position:static;width:auto;height:auto;max-height:260px}main{padding:8px 16px 60px}}
`;

const HTML_JS = `
const q=document.getElementById('q');
q.addEventListener('input',()=>{const t=q.value.trim().toLowerCase();
document.querySelectorAll('article').forEach(a=>a.classList.toggle('hidden',!!t&&!a.textContent.toLowerCase().includes(t)));
document.querySelectorAll('section.cat').forEach(s=>{const any=[...s.querySelectorAll('article')].some(a=>!a.classList.contains('hidden'));s.classList.toggle('hidden',!any&&!!t);});
document.querySelectorAll('nav a[data-id]').forEach(a=>{const el=document.getElementById(a.dataset.id);const art=el&&el.closest('article');a.classList.toggle('hidden',!!t&&!!art&&art.classList.contains('hidden'));});});
`;

function htmlPage(grouped: Map<string, Map<string, DocEntry[]>>, byName: Map<string, DocEntry>): string {
	const link: LinkFn = (t) => `#${t.id}`;
	const nav: string[] = [];
	const main: string[] = [];
	for (const def of CATEGORIES) {
		const sections = grouped.get(def.name)!;
		if (!sections.size) continue;
		nav.push(`<h3><a href="#cat-${def.slug}">${def.name}</a></h3>`);
		main.push(`<section class="cat"><h2 class="cat" id="cat-${def.slug}">${def.name}</h2><p class="blurb">${def.blurb}</p>`);
		for (const [section, list] of sections) {
			nav.push(`<div class="sub">${section}</div>`);
			main.push(`<h2>${section}</h2>`);
			for (const e of list) {
				nav.push(`<a data-id="${e.id}" href="#${e.id}">${e.name}</a>`);
				main.push(`<article>${marked.parse(entryMarkdown(e, byName, link, '../../'), { async: false }) as string}</article>`);
			}
		}
		main.push('</section>');
	}
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Idle Realm reference</title><style>${HTML_CSS}</style></head><body><div class="layout"><nav><input id="q" type="search" placeholder="Search the reference" aria-label="Search"><a href="symbols.md">Symbol index</a><a href="known-issues.md">Known issues</a><a href="code-map.md">Code map</a>${nav.join('')}</nav><main><h1>Idle Realm reference</h1><p class="blurb">Generated from the JSDoc in the code (<code>npm run docs:code</code>). The code is the source of truth; this page is rebuilt on every commit.</p>${main.join('')}</main></div><script>${HTML_JS}</script></body></html>
`;
}

export function renderAll(root: string, entries: DocEntry[]): Record<string, string> {
	const problems = validate(entries);
	if (problems.length) throw new Error(`Invalid documentation:\n${problems.join('\n')}`);
	const byName = new Map<string, DocEntry>();
	for (const e of entries) {
		byName.set(e.name, e);
		if (e.symbol) byName.set(e.symbol, e);
	}
	const grouped = byCategory(entries);
	const files: Record<string, string> = {};
	const pageRows: string[] = [];
	for (const def of CATEGORIES) {
		const sections = grouped.get(def.name)!;
		const count = [...sections.values()].reduce((n, l) => n + l.length, 0);
		files[`${def.slug}.md`] = categoryPage(def, sections, byName);
		pageRows.push(`- [${def.name}](${def.slug}.md) (${count}): ${def.blurb}`);
	}
	files['README.md'] = `${REFERENCE_INTRO}\n${pageRows.join('\n')}\n- [Known issues](known-issues.md): open code-side findings\n- [Symbol index](symbols.md): function → file and line\n- [Code map](code-map.md): every source file\n`;
	files['symbols.md'] = symbolsPage(entries);
	files['known-issues.md'] = issuesPage(entries, byName);
	files['code-map.md'] = codeMapPage(root);
	files['reference.json'] = `${JSON.stringify(
		entries.map(({ id, name, symbol, kind, category, file, line, summary, see }) => ({ id, name, symbol, kind, category: category.join('/'), file, line, summary, see })),
		null,
		1,
	)}\n`;
	files['index.html'] = htmlPage(grouped, byName);
	return files;
}
