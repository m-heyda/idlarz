/**
 * Reads the JSDoc blocks that carry a `@category` tag out of the source files (the input of `npm run docs:code`).
 *
 * The convention is written down in docs/reference/README.md (generated from `REFERENCE_INTRO` in scripts/docs/structure.ts).
 * A block belongs to the declaration that follows it (`export const x`, `export function y` ...); a block with no declaration after it is a
 * free-standing topic and needs a `@title`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

export interface DocEntry {
	/** Unique anchor id */
	id: string;
	/** The symbol name, or the `@title` of a free-standing topic */
	name: string;
	/** The declared symbol (undefined for a topic) */
	symbol?: string;
	kind: 'function' | 'const' | 'class' | 'interface' | 'type' | 'enum' | 'topic';
	/** ['Economy', 'Castle'] from `@category Economy/Castle` */
	category: string[];
	/** Repo-relative path with forward slashes */
	file: string;
	/** Line of the declaration (of the comment for a topic) */
	line: number;
	/** The first paragraph */
	summary: string;
	/** Everything before the first tag, markdown */
	body: string;
	formulas: string[];
	examples: string[];
	/** Ids of tables registered in scripts/docs/tables.ts */
	tables: string[];
	see: string[];
	knownIssues: string[];
	params: string[];
	returns: string[];
	order: number;
}

const TAG_LINE = /^@([A-Za-z]+)\b[ \t]*(.*)$/;
const DECLARATION = /^[ \t]*(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:abstract\s+)?(function\*?|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/;

/** Directories scanned for documented code */
export const SCAN_ROOTS = ['src', 'scripts', 'e2e', 'tests', 'supabase'];
const SKIP_DIRS = new Set(['node_modules', '.next', 'pixel', 'fixtures', 'previews', 'reference']);

export function sourceFiles(root: string): string[] {
	const out: string[] = [];
	const walk = (dir: string) => {
		for (const name of readdirSync(dir).sort()) {
			const full = join(dir, name);
			if (statSync(full).isDirectory()) {
				if (!SKIP_DIRS.has(name)) walk(full);
			} else if (/\.(ts|tsx|mjs)$/.test(name) && !name.endsWith('.d.ts') && !relative(root, full).split(sep).join('/').startsWith('scripts/docs/')) {
				out.push(full); // the tool's own sources hold the convention examples, they are not documentation
			}
		}
	};
	for (const r of SCAN_ROOTS) {
		try {
			walk(join(root, r));
		} catch {
			/* a root that does not exist */
		}
	}
	return out;
}

const lineOf = (text: string, index: number): number => text.slice(0, index).split('\n').length;

/** Strips the leading ` * ` of every comment line and keeps relative indentation. */
function commentLines(block: string): string[] {
	return block
		.replace(/^\/\*\*/, '')
		.replace(/\*\/$/, '')
		.split('\n')
		.map((l) => l.replace(/^\s*\* ?/, '').replace(/\s+$/, ''));
}

function trimBlank(lines: string[]): string[] {
	let a = 0;
	let b = lines.length;
	while (a < b && !lines[a].trim()) a++;
	while (b > a && !lines[b - 1].trim()) b--;
	return lines.slice(a, b);
}

export interface ParsedBlock {
	body: string[];
	tags: { name: string; text: string[] }[];
}

/** Splits a comment into prose and tags. A tag runs until the next line that starts with `@` (outside a code fence). */
export function splitBlock(block: string): ParsedBlock {
	const lines = commentLines(block);
	const body: string[] = [];
	const tags: ParsedBlock['tags'] = [];
	let fence = false;
	let current: ParsedBlock['tags'][number] | null = null;
	for (const line of lines) {
		if (/^\s*```/.test(line)) fence = !fence;
		const m = fence ? null : TAG_LINE.exec(line);
		if (m) {
			current = { name: m[1].toLowerCase(), text: m[2] ? [m[2]] : [] };
			tags.push(current);
		} else if (current) current.text.push(line);
		else body.push(line);
	}
	return { body: trimBlank(body), tags: tags.map((t) => ({ name: t.name, text: trimBlank(t.text) })) };
}

const dedent = (lines: string[]): string[] => {
	const indents = lines.filter((l) => l.trim()).map((l) => /^ */.exec(l)![0].length);
	const cut = indents.length ? Math.min(...indents) : 0;
	return lines.map((l) => l.slice(cut));
};

const slug = (s: string): string =>
	s
		.replace(/[^A-Za-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.toLowerCase();

/** `export const f = (a) => ...` is a function for the reader, `export const X = {...}` a constant. */
function kindOf(keyword: string, name: string, line: string): DocEntry['kind'] {
	if (keyword.startsWith('function')) return 'function';
	if (keyword === 'let' || keyword === 'var' || keyword === 'const') {
		const after = line.slice(line.indexOf(name) + name.length);
		return /^\s*(:[^=]+)?=\s*(async\s*)?(\(|[A-Za-z_$][\w$]*\s*=>|function\b)/.test(after) ? 'function' : 'const';
	}
	return keyword as DocEntry['kind'];
}

export function parseFile(root: string, path: string): DocEntry[] {
	const text = readFileSync(path, 'utf8');
	const file = relative(root, path).split(sep).join('/');
	const entries: DocEntry[] = [];
	for (const m of text.matchAll(/\/\*\*[\s\S]*?\*\//g)) {
		const raw = m[0];
		const parsed = splitBlock(raw);
		const category = parsed.tags.find((t) => t.name === 'category');
		if (!category) continue;
		const after = text.slice(m.index! + raw.length);
		const nextLine = /^\s*\n?([^\n]*)/.exec(after)?.[1] ?? '';
		const rest = after.replace(/^\s+/, '').split('\n')[0] ?? nextLine;
		const decl = DECLARATION.exec(rest);
		const title = parsed.tags.find((t) => t.name === 'title')?.text.join(' ').trim();
		if (!decl && !title) throw new Error(`${file}:${lineOf(text, m.index!)}: a documented block that is not followed by a declaration needs a @title`);
		const declLine = decl ? lineOf(text, m.index! + raw.length + (after.length - after.replace(/^\s+/, '').length)) : lineOf(text, m.index!);
		const tag = (n: string) => parsed.tags.filter((t) => t.name === n);
		for (const single of ['category', 'order', 'title']) {
			if (tag(single).some((t) => t.text.length > 1)) throw new Error(`${file}:${lineOf(text, m.index!)}: @${single} must be one line (put the prose before the tags)`);
		}
		const body = dedent(parsed.body).join('\n');
		const summary = body.split(/\n\s*\n/)[0]?.replace(/\s*\n\s*/g, ' ').trim() ?? '';
		const name = title || decl![2];
		entries.push({
			id: slug(decl ? decl[2] : name),
			name,
			symbol: decl?.[2],
			kind: decl ? kindOf(decl[1], decl[2], rest) : 'topic',
			category: category.text
				.join(' ')
				.split('/')
				.map((s) => s.trim())
				.filter(Boolean),
			file,
			line: declLine,
			summary,
			body,
			formulas: tag('formula').map((t) => dedent(t.text).join('\n')),
			examples: tag('example').map((t) => dedent(t.text).join('\n')),
			tables: tag('table').flatMap((t) => t.text.join(' ').split(/[\s,]+/).filter(Boolean)),
			see: tag('see').flatMap((t) => t.text.join(' ').split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)),
			knownIssues: tag('knownissue').map((t) => t.text.join(' ')),
			params: tag('param').map((t) => t.text.join(' ')),
			returns: tag('returns').map((t) => t.text.join(' ')),
			order: Number(tag('order')[0]?.text.join('')) || 0,
		});
	}
	return entries;
}

/** Every documented entry of the repo, with unique ids. */
export function parseRepo(root: string): DocEntry[] {
	const problems: string[] = [];
	const all = sourceFiles(root).flatMap((p) => {
		try {
			return parseFile(root, p);
		} catch (error) {
			problems.push(error instanceof Error ? error.message : String(error));
			return [];
		}
	});
	if (problems.length) throw new Error(`Invalid documentation comments:\n${problems.join('\n')}`);
	const seen = new Map<string, number>();
	for (const e of all) {
		const n = (seen.get(e.id) ?? 0) + 1;
		seen.set(e.id, n);
		if (n > 1) e.id = `${e.id}-${slug(e.file.replace(/\.[a-z]+$/, ''))}`;
	}
	return all;
}

/**
 * What a file is for, in one line, for the code map: the first sentence of its leading comment (\`//\` lines or a JSDoc block, ignoring the
 * documented topic blocks that carry a \`@category\`); when it has none, the first sentence of the first JSDoc in the file, marked with a tilde.
 */
export function fileSummary(root: string, path: string): string {
	const text = readFileSync(resolve(root, path), 'utf8').replace(/^﻿/, '');
	let trimmed = text.replace(/^(\s*(\/\/ *@ts-\w+.*|'use client';?|"use client";?)\s*\n)+/, '');
	// leading documented topic blocks (with @category) are documentation, not a description of the file
	for (;;) {
		const lead = /^\s*\/\*\*[\s\S]*?\*\//.exec(trimmed);
		if (!lead || !/^\s*\*\s*@category\b/m.test(lead[0])) break;
		trimmed = trimmed.slice(lead[0].length).replace(/^(\s*('use client';?|"use client";?)\s*\n)+/, '');
	}
	const sentence = (lines: string[]): string => lines.filter((l) => l.trim() && !l.startsWith('@')).join(' ').split(/(?<=[.:])\s/)[0] ?? '';
	const block = /^\s*\/\*\*?([\s\S]*?)\*\//.exec(trimmed);
	let first = '';
	let guessed = false;
	if (block && trimmed.trimStart().startsWith('/*')) {
		first = sentence(commentLines('/**' + block[1] + '*/'));
	} else {
		const line = /^\s*\/\/\s?(.*)/.exec(trimmed);
		first = line?.[1] ?? '';
	}
	if (!first.trim()) {
		const any = /\/\*\*([\s\S]*?)\*\//.exec(trimmed);
		if (any) {
			first = sentence(commentLines('/**' + any[1] + '*/'));
			guessed = true;
		}
	}
	const out = first.replace(/\s+/g, ' ').trim().replace(/\|/g, '\|');
	return out && guessed ? '~ ' + out : out;
}
