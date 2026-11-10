import type { Resources } from '@/types/game';
import type { SaveSummary } from './summary';

/**
 * One rebirth, as the Rebirths tab lists it. The numbers are those of the run that ENDED: the last save the server accepted before the
 * one that showed the new rebirth count (an honest client saves every ~90 s and right when it rebirths), never numbers the client sends.
 */
export interface RebirthRecord {
	/** The rebirth count reached: 1 for the first rebirth */
	rebirthNo: number;
	/** When the server saw it (ms) */
	at: number;
	/** Total play time at the end of the run (seconds) */
	playSeconds: number;
	tiles: number;
	castleLevel: number;
	level: number;
	xp: number;
	gold: number;
	/** The run's gold income per second when it ended */
	goldPerSec: number;
	clickLevel: number;
	/** The Embers this rebirth paid, and all Embers ever earned after it */
	embersGained: number;
	legacyEarned: number;
	/** Income per second of every resource at the end of the run */
	rates: Resources;
}

/** What the tab shows (a record plus the length of the run, worked out from the one before it) */
export interface RebirthEntry extends Omit<RebirthRecord, 'at'> {
	/** ISO time */
	at: string;
	runSeconds: number;
}

/**
 * The rebirth an accepted save shows, or null when it shows none: `previous` is the summary of the last accepted save (the run that
 * ended), `next` the one just accepted. A New Game (play time going back) is not a rebirth.
 */
export const rebirthRecordOf = (previous: SaveSummary, next: SaveSummary, nowMs: number): RebirthRecord | null => {
	if (next.rebirths <= previous.rebirths) return null;
	if (next.playSeconds < previous.playSeconds - 1) return null;
	return {
		rebirthNo: next.rebirths,
		at: nowMs,
		playSeconds: previous.playSeconds,
		tiles: previous.tilesOwned,
		castleLevel: previous.castleLevel,
		level: previous.level,
		xp: previous.xp,
		gold: previous.gold,
		goldPerSec: previous.rates.gold,
		clickLevel: previous.clickLevel,
		embersGained: Math.max(0, next.legacyEarned - previous.legacyEarned),
		legacyEarned: next.legacyEarned,
		rates: previous.rates,
	};
};

/** Length of the run that ended with `record`: its play time minus the previous rebirth's (or all of it for the first one). */
export const runSecondsOf = (record: Pick<RebirthRecord, 'playSeconds'>, previousPlaySeconds: number | null): number =>
	Math.max(0, record.playSeconds - (previousPlaySeconds ?? 0));
