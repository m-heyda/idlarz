import { emptyProgress } from '@/lib/tutorial/engine';
import { isEmptyStats, readStats, type LifetimeStats } from '@/lib/offline/stats';

/**
 * The lifetime counters of a stored `player_ledger.stats` column with the **tutorial progress wiped** and everything else kept (kills, glossary, chests, achievements): what a season restart (`reset-players` without `--reset-stats`)
 * writes, so every player starts the new game with the guided tutorial again and its bundles can pay again. null when nothing is left to store (the column stays empty). `--reset-stats` and a New Game / new chapter clear the whole column instead.
 *
 * @category Saves & Server/The ledger
 * @order 7
 */
export const statsWithoutTutorial = (raw: unknown): LifetimeStats | null => {
	const stats: LifetimeStats = { ...readStats(raw), tutorial: emptyProgress() };
	return isEmptyStats(stats) ? null : stats;
};
