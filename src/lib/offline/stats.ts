// SERVER ONLY. The lifetime counters of a player (`player_ledger.stats`): kills per monster type, chests opened, tiles bought and the income earned while playing.
// They feed achievements (IDL-73), the glossary and mastery (R6) and rankings; nothing shows them yet. Every number is counted by the server from its own events or from accepted
// saves (never from a figure the client claims), and the record stays small: one map of kill counts and a few numbers.

/** Lifetime counters. Stored as one jsonb value; a player who has counted nothing yet has `null` in the column and reads as {@link emptyStats}. */
export interface LifetimeStats {
	/** Kills per monster type id (bosses and golden monsters included) */
	kills: Record<string, number>;
	/** Golden (lucky) monster kills, and boss kills, on top of the per-type counts */
	golden: number;
	bosses: number;
	/** Chests opened */
	chests: number;
	/** Tiles bought, counted as the increase of the owned tiles between accepted saves of the same run (a rebirth's fresh land does not count as bought) */
	tiles: number;
	/** Resources earned by income while playing: the rates of the previous accepted save times the verified online seconds. Offline pay, chests and kills are the server's own payouts (`granted`), not counted here. */
	income: Record<string, number>;
	/** Where the last count stopped: wall clock (epoch ms), the save's play seconds and owned tiles. 0 = never counted (the next accepted save only sets them). */
	at: number;
	playAt: number;
	tilesAt: number;
}

/** Counters are written to the ledger at most this often by the save path (kills and chests are written with their own request, which writes the ledger anyway). */
export const STATS_EVERY_MS = 10 * 60_000;

export const emptyStats = (): LifetimeStats => ({ kills: {}, golden: 0, bosses: 0, chests: 0, tiles: 0, income: {}, at: 0, playAt: 0, tilesAt: 0 });

const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0);
const counts = (value: unknown): Record<string, number> => {
	const out: Record<string, number> = {};
	if (value && typeof value === 'object') for (const [key, amount] of Object.entries(value)) if (num(amount) > 0) out[key] = num(amount);
	return out;
};

/** Reads the stored column back: a missing column, null or anything malformed reads as zeros. */
export const readStats = (raw: unknown): LifetimeStats => {
	if (!raw || typeof raw !== 'object') return emptyStats();
	const r = raw as Record<string, unknown>;
	return {
		kills: counts(r.kills),
		golden: Math.floor(num(r.golden)),
		bosses: Math.floor(num(r.bosses)),
		chests: Math.floor(num(r.chests)),
		tiles: Math.floor(num(r.tiles)),
		income: counts(r.income),
		at: num(r.at),
		playAt: num(r.playAt),
		tilesAt: Math.floor(num(r.tilesAt)),
	};
};

/** True when nothing was ever counted (stored as null, so most rows keep the column empty). */
export const isEmptyStats = (s: LifetimeStats): boolean =>
	s.at === 0 && s.golden === 0 && s.bosses === 0 && s.chests === 0 && s.tiles === 0 && Object.keys(s.kills).length === 0 && Object.keys(s.income).length === 0;

/** A kill of monster `type`: counted once, when the server pays it. */
export const recordKill = (stats: LifetimeStats, kill: { type: string; lucky: boolean; boss: boolean }): LifetimeStats => ({
	...stats,
	kills: { ...stats.kills, [kill.type]: (stats.kills[kill.type] ?? 0) + 1 },
	golden: stats.golden + (kill.lucky ? 1 : 0),
	bosses: stats.bosses + (kill.boss ? 1 : 0),
});

/** A chest opened: counted once, when the server pays it. */
export const recordChest = (stats: LifetimeStats): LifetimeStats => ({ ...stats, chests: stats.chests + 1 });

/** What an accepted save tells the counters. */
export interface SaveCount {
	nowMs: number;
	/** The accepted save's play seconds and owned tiles */
	playSeconds: number;
	tilesOwned: number;
	/** The previous accepted save's income per second (the rates the player was earning at), null for a first save */
	rates: Record<string, number> | null;
	/** A rebirth or a New Game: the land and play time start over, so the baselines are reset and nothing is added */
	newRun: boolean;
}

/** Whether enough time has passed since the last count for the save path to write the ledger for it. */
export const statsDue = (stats: LifetimeStats, nowMs: number): boolean => stats.at === 0 || nowMs - stats.at >= STATS_EVERY_MS;

/**
 * Counts what an accepted save adds: tiles bought (the rise of owned tiles since the last count, same run only) and income earned while playing (the previous save's
 * rates times the online seconds, which are the smaller of the play-time rise and the wall-clock time since the last count, so a wall-clock gap is never counted twice
 * as both away pay and income). The first count of a player, and the first after a rebirth or New Game, only set the baselines.
 */
export const countSave = (stats: LifetimeStats, save: SaveCount): LifetimeStats => {
	const base = { ...stats, at: save.nowMs, playAt: save.playSeconds, tilesAt: save.tilesOwned };
	if (save.newRun || stats.at === 0) return base;
	const onlineSec = Math.max(0, Math.min(save.playSeconds - stats.playAt, (save.nowMs - stats.at) / 1000));
	const income = { ...stats.income };
	if (save.rates && onlineSec > 0)
		for (const [key, perSec] of Object.entries(save.rates)) if (num(perSec) > 0) income[key] = (income[key] ?? 0) + num(perSec) * onlineSec;
	return { ...base, tiles: stats.tiles + Math.max(0, save.tilesOwned - stats.tilesAt), income };
};
