// Suffixes for large numbers: thousand steps from K (the first at 10,000), then M, B, T, Qa, Qi, Sx; beyond that scientific
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx'];

/**
 * Drops the zeros a fixed-decimals number carries at the end: "7.00" is "7", "1.50K" is "1.5K", "0.90" is "0.9", "1.00M" is "1M" (a number with no decimal point is left alone). Every number the game shows goes through this, so a value
 * never reads as 1.0K or 7.00.
 */
export const tidy = (text: string): string => text.replace(/(\.\d*?)0+(?=\D|$)/, '$1').replace(/\.(?=\D|$)/, '');

/** "1.23M"-style text for |n| >= 1,000,000 up to the largest suffix, "1.23e24" past it; below 1e6 returns null. */
const compact = (n: number): string | null => {
	const abs = Math.abs(n);
	if (abs < 1_000_000) return null;
	if (!Number.isFinite(n)) return n > 0 ? '∞' : '-∞';
	const tier = Math.floor(Math.log10(abs) / 3);
	if (tier >= SUFFIXES.length) return tidy(n.toExponential(2).replace('e+', 'e'));
	return `${tidy((n / Math.pow(1000, tier)).toFixed(2))}${SUFFIXES[tier]}`;
};

/**
 * A typed amount: "250", "1,500", "1.5k", "2M", "3b" (the suffixes of `formatNumber`, any case). A whole number of at least 1, or null
 * for anything else (empty, negative, unknown suffix, fractions of a unit).
 */
export const parseAmount = (text: string): number | null => {
	const match = /^(\d+(?:\.\d+)?)\s*([a-z]*)$/i.exec(text.replace(/[,_\s]+/g, '').toLowerCase());
	if (!match) return null;
	const tier = match[2] === '' ? 0 : SUFFIXES.findIndex((suffix) => suffix !== '' && suffix.toLowerCase() === match[2]);
	if (tier < 0) return null;
	const value = Math.floor(Number(match[1]) * Math.pow(1000, tier) + 1e-6);
	return Number.isFinite(value) && value >= 1 ? value : null;
};

export const formatNumber = (num: number | undefined): string => {
	if (num === undefined || num === null) return '0';
	if (Math.abs(num) < 0.01) return '0';

	// Format large numbers with suffix - only apply to numbers > 10,000
	const big = compact(num);
	if (big !== null) return big;
	if (Math.abs(num) >= 10_000) return `${tidy((num / 1_000).toFixed(2))}K`;

	// Normal formatting for small numbers
	const decimalPlaces = Math.abs(num) < 100 ? 2 : Math.abs(num) < 1000 ? 1 : 0;
	return tidy(num.toFixed(decimalPlaces));
};

/**
 * The amount on a header chip. It is built so a ticking counter never changes its width except at a suffix step:
 * below 1,000 a whole number (no decimals to appear and vanish), from 1,000 three significant digits with a suffix
 * (1.23K, 12.3K, 123K, 1.23M ...), so it is at most 5 characters up to T and 6 for Qa and beyond.
 */
export const formatHeaderAmount = (num: number | undefined): string => {
	if (num === undefined || num === null || Number.isNaN(num)) return '0';
	if (!Number.isFinite(num)) return num > 0 ? '∞' : '-∞';
	const sign = num < 0 ? '-' : '';
	const abs = Math.abs(num);
	if (abs < 1000) return `${sign}${Math.floor(abs)}`;

	let tier = Math.floor(Math.log10(abs) / 3);
	if (tier >= SUFFIXES.length) return `${sign}${tidy(abs.toExponential(1).replace('e+', 'e'))}`;
	let text = (abs / Math.pow(1000, tier)).toPrecision(3);
	if (Number(text) >= 1000) {
		// 999.96K rounds to "1000": carry into the next suffix instead
		tier += 1;
		if (tier >= SUFFIXES.length) return `${sign}${tidy(abs.toExponential(1).replace('e+', 'e'))}`;
		text = (abs / Math.pow(1000, tier)).toPrecision(3);
	}
	return `${sign}${tidy(text)}${SUFFIXES[tier]}`;
};

/**
 * A production rate in the unit that reads best for how much there is: per second from 1/s, per minute from 1/min,
 * else per hour. Null when it is too small to mean anything (under 0.01 an hour) or not a number.
 */
export const pickRateUnit = (perSecond: number | undefined): { value: number; unit: 's' | 'min' | 'h' } | null => {
	if (perSecond === undefined || perSecond === null || !Number.isFinite(perSecond)) return null;
	const abs = Math.abs(perSecond);
	if (abs >= 1) return { value: perSecond, unit: 's' };
	if (abs * 60 >= 1) return { value: perSecond * 60, unit: 'min' };
	if (abs * 3600 >= 0.01) return { value: perSecond * 3600, unit: 'h' };
	return null;
};

/** "+1.25/min" for a tooltip: the rate in its best unit, or null when there is no production */
export const formatRateAuto = (perSecond: number | undefined): string | null => {
	const rate = pickRateUnit(perSecond);
	if (!rate) return null;
	return `${rate.value > 0 ? '+' : ''}${formatNumber(rate.value)}/${rate.unit}`;
};

/** A percentage in the same short style as the numbers: 450%, 4.93K%, 1.20M% (short from 5,000) */
export const formatPercent = (pct: number): string => {
	if (!Number.isFinite(pct) || Math.abs(pct) < 5000) return `${Math.round(pct)}%`;
	return `${compact(pct) ?? `${tidy((pct / 1_000).toFixed(2))}K`}%`;
};

const trimmed = (n: number, decimals: number): string => String(Math.round(n * 10 ** decimals) / 10 ** decimals);

/** A stat or count: plain up to 9,999 (at most `decimals` places, none trailing: 40.8, 281, 6), then 12.34K / M / B / T */
export const formatCompact = (n: number | undefined, decimals = 1): string => {
	if (n === undefined || n === null || Number.isNaN(n)) return '0';
	if (Math.abs(n) >= 10_000 || !Number.isFinite(n)) return formatNumber(n);
	return trimmed(n, decimals);
};

/** A stack count on a bag slot: plain up to 999, then short in lower case from 1k (1k, 1.5k, 100k, 2.5m) */
export const formatStack = (n: number): string => {
	if (!Number.isFinite(n) || n < 1000) return String(Math.max(0, Math.floor(n)));
	const [div, unit] = n >= 1_000_000 ? [1_000_000, 'm'] : [1000, 'k'];
	return `${Math.floor((n / div) * 10) / 10}${unit}`;
};

/** A whole count for counters and costs: 7, 73, 9,999 as is (never 7.00), from 10,000 short (12.3K, 1.23M) */
export const formatInt = (n: number | undefined): string => {
	if (n === undefined || n === null || Number.isNaN(n)) return '0';
	if (!Number.isFinite(n) || Math.abs(n) >= 10_000) return formatHeaderAmount(n);
	return Math.round(n).toLocaleString('en');
};

/** A percentage with decimals (27.3%) that turns into 5.01K% / 1.20M% from 5,000 */
export const formatPct = (pct: number | undefined, decimals = 1): string => {
	if (pct === undefined || pct === null || Number.isNaN(pct)) return '0%';
	if (Math.abs(pct) >= 5000 || !Number.isFinite(pct)) return formatPercent(pct);
	return `${trimmed(pct, decimals)}%`;
};

export const formatRate = (rate: number): string => {
	if (Math.abs(rate) < 0.01) return '0/s';
	const sign = rate > 0 ? '+' : '';

	// Format large rates with suffix - only apply to rates > 10,000
	const big = compact(rate);
	if (big !== null) return `${sign}${big}/s`;
	if (Math.abs(rate) >= 10_000) return `${sign}${tidy((rate / 1_000).toFixed(2))}K/s`;

	return `${sign}${tidy(rate.toFixed(2))}/s`;
};

// Format time to display in the appropriate units
export const formatTime = (seconds: number): string => {
	if (!isFinite(seconds) || seconds < 0) return '∞';

	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	if (days > 0) {
		return `${days}d ${hours}h`;
	} else if (hours > 0) {
		return `${hours}h ${minutes}m`;
	} else if (minutes > 0) {
		return `${minutes}m ${secs}s`;
	} else {
		return `${secs}s`;
	}
};
