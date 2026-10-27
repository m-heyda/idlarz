// Suffixes for large numbers: thousand steps from K (the first at 10,000), then M, B, T, Qa, Qi, Sx; beyond that scientific
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx'];

/** "1.23M"-style text for |n| >= 1,000,000 up to the largest suffix, "1.23e24" past it; below 1e6 returns null. */
const compact = (n: number): string | null => {
	const abs = Math.abs(n);
	if (abs < 1_000_000) return null;
	if (!Number.isFinite(n)) return n > 0 ? '∞' : '-∞';
	const tier = Math.floor(Math.log10(abs) / 3);
	if (tier >= SUFFIXES.length) return n.toExponential(2).replace('e+', 'e');
	return `${(n / Math.pow(1000, tier)).toFixed(2)}${SUFFIXES[tier]}`;
};

export const formatNumber = (num: number | undefined): string => {
  if (num === undefined || num === null) return '0';
  if (Math.abs(num) < 0.01) return '0';

  // Format large numbers with suffix - only apply to numbers > 10,000
  const big = compact(num);
  if (big !== null) return big;
  if (Math.abs(num) >= 10_000) return `${(num / 1_000).toFixed(2)}K`;

  // Normal formatting for small numbers
  const decimalPlaces = Math.abs(num) < 100 ? 2 : Math.abs(num) < 1000 ? 1 : 0;
  return num.toFixed(decimalPlaces);
};

/** A percentage in the same short style as the numbers: 450%, 4.93K%, 1.20M% (short from 5,000) */
export const formatPercent = (pct: number): string => {
  if (!Number.isFinite(pct) || Math.abs(pct) < 5000) return `${Math.round(pct)}%`;
  return `${compact(pct) ?? `${(pct / 1_000).toFixed(2)}K`}%`;
};

const trimmed = (n: number, decimals: number): string => String(Math.round(n * 10 ** decimals) / 10 ** decimals);

/** A stat or count: plain up to 9,999 (at most `decimals` places, none trailing: 40.8, 281, 6), then 12.34K / M / B / T */
export const formatCompact = (n: number | undefined, decimals = 1): string => {
  if (n === undefined || n === null || Number.isNaN(n)) return '0';
  if (Math.abs(n) >= 10_000 || !Number.isFinite(n)) return formatNumber(n);
  return trimmed(n, decimals);
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
  if (Math.abs(rate) >= 10_000) return `${sign}${(rate / 1_000).toFixed(2)}K/s`;

  return `${sign}${rate.toFixed(2)}/s`;
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
