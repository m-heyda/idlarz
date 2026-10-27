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
	goldFind: { label: 'Gold Find', unit: '%' }, // % more gold from kills and chests
	dodge: { label: 'Dodge', unit: '%', decimals: 1 }, // chance in % that a monster's hit misses (capped by COMBAT.maxDodge)
} as const satisfies Record<string, StatDef>;

export type StatKey = keyof typeof STAT_DEFS;
export const STAT_KEYS = Object.keys(STAT_DEFS) as StatKey[];

/** Item level every item has for now; stats scale with it later (see `statScale`). */
export const DEFAULT_ITEM_LEVEL = 10;

/** Multiplier on an item's base stats: 1 at the default item level, so raising or lowering the level scales everything. */
export const statScale = (itemLevel: number): number => itemLevel / DEFAULT_ITEM_LEVEL;

/**
 * The flat value one stat starts at for gear of each tier (index 0 = tier 1 wood/cloth ... 4 = tier 5 legendary), at the
 * default item level. Every row rises with the tier. Items pick the stats they carry; where a stat is new it takes its
 * number from here (`baseStat`), so a later item-level system only has to change `statScale`.
 */
export const STAT_BASE_BY_TIER: Record<StatKey, readonly [number, number, number, number, number]> = {
	damage: [6, 12, 18, 24, 33],
	armor: [1, 3, 5, 7, 10],
	maxHp: [3, 5, 8, 12, 18],
	critChance: [1, 2, 3, 4, 6],
	superCrit: [0.5, 1, 2, 3, 4],
	regen: [0.2, 0.4, 0.8, 1.2, 1.8],
	luck: [1, 2, 3, 4, 6],
	goldFind: [2, 4, 6, 9, 12],
	dodge: [1, 1.5, 2, 3, 4],
};

/** The base value of a stat for a tier (1-5) at an item level, rounded to 2 decimals. */
export const baseStat = (stat: StatKey, tier: number, itemLevel = DEFAULT_ITEM_LEVEL): number => {
	const row = STAT_BASE_BY_TIER[stat];
	const base = row[Math.min(row.length, Math.max(1, Math.round(tier))) - 1];
	return Math.round(base * statScale(itemLevel) * 100) / 100;
};

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

const statNumber = (key: string, value: number): string => {
	const def = (STAT_DEFS as Record<string, StatDef>)[key];
	return `${def?.decimals ? value.toFixed(def.decimals) : String(value)}${def?.unit ?? ''}`;
};

/** '8%', '1.5/s': the value alone, for a stat table whose row already names the stat */
export const formatStatValue = (key: string, value: number): string => statNumber(key, value);

/** '+2', '-1', '+0.5/s': a signed change without the stat name */
export const formatStatChange = (key: string, delta: number): string => `${delta < 0 ? '-' : '+'}${statNumber(key, Math.abs(delta))}`;
