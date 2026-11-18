import type { Ledger } from '@/lib/offline/ledger';

// SERVER ONLY. One-off events for the secret deeds (IDL-305): the browser reports that something happened (it opened the empty Gambling tab) and the server records it once, from a short allowlist, so a made-up id earns nothing.

/**
 * The events the browser may report for a deed (`visit`): opening the empty Gambling tab, the smallest a window can be, the map at its largest and smallest zoom, a look into the World boss window, and putting a skin on the castle.
 * Cosmetic one-offs: a made-up report only earns the joke. Append only.
 */
export const CURIOSITIES: readonly string[] = ['gambling_empty', 'window_min', 'map_zoom_max', 'map_zoom_min', 'boss_window', 'castle_skin'];

/** The podium places (1st, 2nd, 3rd on any Ranking board). Only the server records these, from the Rankings it reads itself, so `visit` does not accept them. Append only. */
export const RANK_CURIOSITIES: readonly string[] = ['rank_1', 'rank_2', 'rank_3'];

/**
 * Records a curiosity once. An id that is not on the list, or one already recorded, changes nothing (the same ledger comes back).
 *
 * @category Progression/Achievements
 * @order 6
 */
export const recordCuriosity = (ledger: Ledger, id: string): Ledger =>
	CURIOSITIES.includes(id) && !ledger.stats.curiosity.includes(id)
		? { ...ledger, stats: { ...ledger.stats, curiosity: [...ledger.stats.curiosity, id] } }
		: ledger;

/**
 * Records the podium place a player holds on a Ranking board (1 to 3, any board): `rank_<place>` once. Called by the server when it reads a board for the player, never from a request body. Other places change nothing.
 *
 * @category Progression/Achievements
 * @order 7
 */
export const recordRankPlace = (ledger: Ledger, place: number): Ledger => {
	const id = `rank_${place}`;
	return RANK_CURIOSITIES.includes(id) && !ledger.stats.curiosity.includes(id)
		? { ...ledger, stats: { ...ledger.stats, curiosity: [...ledger.stats.curiosity, id] } }
		: ledger;
};
