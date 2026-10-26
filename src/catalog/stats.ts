/**
 * Every stat an item or a set bonus can carry. One row per stat (label and how to print it); `sumStats` is the only
 * place stats are added together, so a new stat is one row here plus whatever reads it in combat.
 */
export interface StatDef {
	label: string;
	/** Printed right after the number: '+8% Crit Chance', '+1/s HP Regen' */
	unit?: string;
	/** Decimal places the tooltip shows */
	decimals?: number;
}

export const STAT_DEFS = {
	damage: { label: 'Damage' },
	armor: { label: 'Armor' },
	maxHp: { label: 'Max HP' },
	critChance: { label: 'Crit Chance', unit: '%' }, // chance in % that a click crits (x2 damage), added to the character's own
	superCrit: { label: 'Super Crit', unit: '%' }, // chance in % that a crit becomes a super crit (x5), on top of the base chance
	regen: { label: 'HP Regen', unit: '/s', decimals: 1 }, // HP per second, in and out of fights
	luck: { label: 'Luck' }, // adds to the Luck of the character: better chest and kill gold and rarer chest finds
} as const satisfies Record<string, StatDef>;

export type StatKey = keyof typeof STAT_DEFS;
export const STAT_KEYS = Object.keys(STAT_DEFS) as StatKey[];

export type ItemStats = Partial<Record<StatKey, number>>;
export type StatTotals = Record<StatKey, number>;

export const emptyStats = (): StatTotals => Object.fromEntries(STAT_KEYS.map((key) => [key, 0])) as StatTotals;

/** Adds any number of stat blocks. */
export const sumStats = (...blocks: (ItemStats | undefined)[]): StatTotals => {
	const total = emptyStats();
	for (const block of blocks) {
		if (!block) continue;
		for (const key of STAT_KEYS) total[key] += block[key] ?? 0;
	}
	return total;
};

export const statLabel = (key: string): string => (STAT_DEFS as Record<string, StatDef>)[key]?.label ?? key;

/** '+8% Crit Chance' */
export const formatStat = (key: string, value: number): string => {
	const def = (STAT_DEFS as Record<string, StatDef>)[key];
	const num = def?.decimals ? value.toFixed(def.decimals) : String(value);
	return `+${num}${def?.unit ?? ''} ${def?.label ?? key}`;
};

/** '+2 Armor', '-1 Damage', '+0.5/s HP Regen': a signed change, for comparing two items */
export const formatStatDelta = (key: string, delta: number): string => {
	const def = (STAT_DEFS as Record<string, StatDef>)[key];
	const num = def?.decimals ? Math.abs(delta).toFixed(def.decimals) : String(Math.abs(delta));
	return `${delta < 0 ? '-' : '+'}${num}${def?.unit ?? ''} ${def?.label ?? key}`;
};

/** '+3 Damage, +4 Max HP' */
export const formatStats = (stats: ItemStats): string =>
	Object.entries(stats)
		.filter(([, value]) => value)
		.map(([key, value]) => formatStat(key, value as number))
		.join(', ');
