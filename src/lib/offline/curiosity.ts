import type { Ledger } from '@/lib/offline/ledger';

// SERVER ONLY. One-off events for the secret deeds (IDL-305): the browser reports that something happened (it opened the empty Gambling tab) and the server records it once, from a short allowlist, so a made-up id earns nothing.

/** The events a deed may be waiting for. Append only. */
export const CURIOSITIES: readonly string[] = ['gambling_empty'];

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
