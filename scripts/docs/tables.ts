/**
 * Tables embedded in the reference with `@table <id>`. Every cell is computed from the live config and maths, so a table cannot go stale
 * the way a hand-copied number does. Add a function here, then write `@table id` in the JSDoc of the rule it illustrates.
 */
export interface DocTable {
	title: string;
	md: string;
}

export const mdTable = (headers: string[], rows: (string | number)[][]): string =>
	[`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map((c) => String(c).replace(/\|/g, '\|')).join(' | ')} |`)].join('\n');

/** 1234567 -> "1.23 M", small numbers keep up to 3 significant digits */
export const fmt = (n: number): string => {
	if (!Number.isFinite(n)) return String(n);
	const a = Math.abs(n);
	if (a >= 1e9) return `${+(n / 1e9).toPrecision(3)} B`;
	if (a >= 1e6) return `${+(n / 1e6).toPrecision(3)} M`;
	if (a >= 1e4) return `${+(n / 1e3).toPrecision(3)} K`;
	if (Number.isInteger(n)) return n.toLocaleString('en-US');
	return String(+n.toPrecision(3));
};

export const TABLES: Record<string, () => DocTable> = {};
