import { incomeSources, type ResourceBreakdownEntry } from '@/utils/game/income';
import { formatPercent, formatRateAuto } from '@/utils/formatters';

/** One line of the "Sources" block of a header tooltip (the shape of the design system's `TipRow`) */
export interface SourceRow {
	label: string;
	value: string;
	tone?: 'green';
}

/** Most lines shown before the rest fold into "and N more" */
export const MAX_SOURCE_ROWS = 5;

/**
 * The "Sources" lines of one resource's header tooltip (IDL-339): where its income comes from (the realm's base, tiles, farm, castle range and levels, each as a rate after the bonuses, so they add up to the income shown) followed by what lifts it
 * (Castle, Plains, Attributes, Embers, Foreman, Set bonus as percentages). At most {@link MAX_SOURCE_ROWS} lines, then "and N more". Empty when there is nothing to list or only one source and no bonus (the Income line already says it).
 */
export const sourceRows = (entry: ResourceBreakdownEntry | undefined): SourceRow[] => {
	if (!entry) return [];
	const { sources, bonuses } = incomeSources(entry);
	if (sources.length + bonuses.length <= 1) return [];
	const rows: SourceRow[] = [
		...sources.flatMap((source) => {
			const value = formatRateAuto(source.value);
			return value ? [{ label: source.label, value }] : [];
		}),
		...bonuses.map((bonus) => ({
			label: bonus.label,
			value: `${bonus.pct > 0 ? '+' : ''}${formatPercent(bonus.pct * 100)}`,
			tone: bonus.pct > 0 ? ('green' as const) : undefined,
		})),
	];
	if (rows.length <= MAX_SOURCE_ROWS) return rows;
	return [...rows.slice(0, MAX_SOURCE_ROWS - 1), { label: `and ${rows.length - (MAX_SOURCE_ROWS - 1)} more`, value: '' }];
};
