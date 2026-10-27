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
	/** Rolled values of this stat are whole numbers (a stat that is on an item at all never rounds down to 0) */
	integer?: boolean;
	/**
	 * How much of the item level growth this stat follows, 0-1 (default 1). Flat stats (damage, armor, max HP) follow it
	 * fully; capped percentage stats follow a share, or they would reach their caps (crit 75 %, dodge 40 %...) within a few levels.
	 */
	levelShare?: number;
}

export const STAT_DEFS = {
	damage: { label: 'Damage', integer: true },
	armor: { label: 'Armor', integer: true },
	maxHp: { label: 'Max HP', integer: true },
	critChance: { label: 'Crit Chance', unit: '%', levelShare: 0.3 }, // chance in % that a click crits (x2 damage), added to the character's own
	superCrit: { label: 'Super Crit', unit: '%', levelShare: 0.3 }, // chance in % that a crit becomes a super crit (x5), on top of the base chance
	regen: { label: 'HP Regen', unit: '/s', decimals: 1, levelShare: 0.6 }, // HP per second, in and out of fights
	luck: { label: 'Luck', integer: true, levelShare: 0.5 }, // adds to the Luck of the character: better chest and kill gold and rarer chest finds
	goldFind: { label: 'Gold Find', unit: '%', levelShare: 0.5 }, // % more gold from kills and chests
	dodge: { label: 'Dodge', unit: '%', decimals: 1, levelShare: 0.3 }, // chance in % that a monster's hit misses (capped by COMBAT.maxDodge)
	maxMana: { label: 'Max Mana', integer: true, levelShare: 0.7 }, // added to the character's mana pool (skills spend it)
	manaRegen: { label: 'Mana Regen', unit: '/s', decimals: 2, levelShare: 0.5 }, // mana per second, in and out of fights
	spellPower: { label: 'Spell Power', unit: '%', levelShare: 0.4 }, // % more healing from skills
	lifeLeech: { label: 'Life Leech', unit: '%', decimals: 1, levelShare: 0.3 }, // % of click damage returned as HP (capped by STAT_RULES.lifeLeechCap)
} as const satisfies Record<string, StatDef>;

export type StatKey = keyof typeof STAT_DEFS;
export const STAT_KEYS = Object.keys(STAT_DEFS) as StatKey[];

/**
 * The flat value one stat starts at for gear of each tier (index 0 = tier 1 wood/cloth ... 4 = tier 5 legendary), at the
 * default item level. Every row rises with the tier. Items pick the stats they carry; where a stat is new it takes its
 * number from here (`baseStat`); the rolled item level scales from there (`levelScale`).
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
	maxMana: [8, 12, 18, 26, 36],
	manaRegen: [0.2, 0.3, 0.45, 0.65, 0.9],
	spellPower: [4, 7, 10, 14, 18],
	lifeLeech: [0.5, 1, 1.5, 2, 3],
};

/** The base value of a stat for a tier (1-5) at the item's authored level. */
export const baseStat = (stat: StatKey, tier: number): number => {
	const row = STAT_BASE_BY_TIER[stat];
	return row[Math.min(row.length, Math.max(1, Math.round(tier))) - 1];
};

export type ItemStats = Partial<Record<StatKey, number>>;
export type StatTotals = Record<StatKey, number>;

// ---- item level curve ---------------------------------------------------------------------------------------------
// The one place that says how power grows with item level. Gear is authored at its own `minItemLevel`; an instance of
// level L has `baseStats x levelScale(L) / levelScale(minItemLevel)`, then the quality roll. Affix values use the same
// curve (`affixMagnitude`). Retune the whole game's power curve here (a lookup table would drop in just as well).

/** The highest item level the game generates; sources and bases are clamped to 1..MAX_ITEM_LEVEL. */
export const MAX_ITEM_LEVEL = 100;

/** Each item level adds this share of the level-1 power (linear: 1 at level 1, 1.63 at 10, 7.9 at 100). */
export const POWER_PER_LEVEL = 0.07;

export const clampItemLevel = (level: number): number => Math.min(MAX_ITEM_LEVEL, Math.max(1, Math.round(level)));

// ---- item value curve ---------------------------------------------------------------------------------------------
// What gear is worth in gold. The economy grows far faster than gear power, so value follows its own curve: steep while the
// early game's income climbs (levels up to the knee), flatter after it. The merchant pays `rarity base x curve x quality x
// affixes` (`sellValueOf`) and sells at a multiple of that (`MERCHANT_GOODS.priceFactor`). One place to retune the whole market.

export const ITEM_VALUE = {
	/** Growth of the value per item level up to `kneeLevel`, and above it */
	growthLow: 1.3,
	growthHigh: 1.12,
	kneeLevel: 10,
	/** The quality roll (0-100, 50 = neutral) scales the value between these */
	quality: { min: 0.75, max: 1.25 },
	/** Every affix adds `base` plus up to `perRoll` (by how well it rolled) to the value multiplier */
	affix: { base: 0.15, perRoll: 0.35 },
} as const;

/** Value multiplier of an item level (1 at level 1). */
export const valueCurve = (itemLevel: number): number => {
	const level = clampItemLevel(itemLevel);
	const low = Math.min(level, ITEM_VALUE.kneeLevel) - 1;
	const high = Math.max(0, level - ITEM_VALUE.kneeLevel);
	return Math.pow(ITEM_VALUE.growthLow, low) * Math.pow(ITEM_VALUE.growthHigh, high);
};

/** Value multiplier of a quality roll (0-100). */
export const qualityValue = (quality: number): number =>
	ITEM_VALUE.quality.min + (ITEM_VALUE.quality.max - ITEM_VALUE.quality.min) * (Math.min(100, Math.max(0, quality)) / 100);

/** Value multiplier of the affixes of an item: 1 with none, more for every one, more still for good rolls. */
export const affixesValue = (rolls: readonly number[]): number =>
	1 + rolls.reduce((sum, roll) => sum + ITEM_VALUE.affix.base + ITEM_VALUE.affix.perRoll * (Math.min(100, Math.max(0, roll)) / 100), 0);

/** Power multiplier of an item level (1 at level 1). */
export const levelScale = (itemLevel: number): number => 1 + POWER_PER_LEVEL * (clampItemLevel(itemLevel) - 1);

/** The quality roll moves base stats by at most this much either way (quality 0-100, 50 = the authored value). */
export const QUALITY_SPREAD = 0.08;

export const qualityMultiplier = (quality: number): number => 1 + ((Math.min(100, Math.max(0, quality)) - 50) / 50) * QUALITY_SPREAD;

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Rounds one stat value the way its definition says: whole numbers (never below 1 when it is on the item) or 2 decimals. */
export const roundStat = (key: StatKey, value: number): number => {
	if (!value) return 0;
	return (STAT_DEFS[key] as StatDef).integer ? Math.max(1, Math.round(value)) : round2(value);
};

/** The part of a level ratio a stat follows: `1 + (ratio - 1) x levelShare`. A ratio of 1 stays 1. */
export const statLevelFactor = (key: StatKey, ratio: number): number => 1 + (ratio - 1) * ((STAT_DEFS[key] as StatDef).levelShare ?? 1);

/**
 * Scales a stat block from one item level to another (`levelRatio`, each stat following its own share of it) and by a plain
 * `multiplier` (quality, rarity), rounding every stat. A ratio and multiplier of exactly 1 return the same values.
 */
export const scaleStats = (stats: ItemStats, levelRatio: number, multiplier = 1): ItemStats => {
	const out: ItemStats = {};
	for (const key of STAT_KEYS) {
		const value = stats[key];
		if (value) out[key] = roundStat(key, value * statLevelFactor(key, levelRatio) * multiplier);
	}
	return out;
};

/** What one point of an affix on this stat is worth at an item level: the level-1 wooden-tier value, grown by the stat's share of the curve. */
export const affixMagnitude = (stat: StatKey, itemLevel: number): number => STAT_BASE_BY_TIER[stat][0] * statLevelFactor(stat, levelScale(itemLevel));

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
