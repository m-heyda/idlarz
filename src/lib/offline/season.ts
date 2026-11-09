import type { SupabaseClient } from '@supabase/supabase-js';
import { startNewGame, type ServiceDeps } from '@/lib/offline/service';

// The season reset marker. The CLI (scripts/reset-players.ts) writes `last_reset` once; each player's ledger carries `reset_at`. A player whose
// ledger has no reset at or after the marker has not been reset yet: their game is reset the first time they log in, once, and the record
// (`reset_at`) says so. A game created after the marker is never touched.

const KEY = 'last_reset';

/** When the last season reset happened (epoch ms), or null when there never was one. */
export const readLastReset = async (db: SupabaseClient): Promise<number | null> => {
	const { data, error } = await db.from('app_settings').select('value').eq('key', KEY).maybeSingle();
	if (error) throw new Error(error.message);
	const at = Date.parse((data?.value as { at?: string } | undefined)?.at ?? '');
	return Number.isFinite(at) ? at : null;
};

/** Records a season reset (the CLI and tests use it). */
export const writeLastReset = async (db: SupabaseClient, atMs: number): Promise<void> => {
	const { error } = await db.from('app_settings').upsert({ key: KEY, value: { at: new Date(atMs).toISOString() }, updated_at: new Date(atMs).toISOString() });
	if (error) throw new Error(error.message);
};

/**
 * Resets the player's game when a season reset happened that their ledger does not know about. Returns the marker (for the browser, which
 * drops a local save older than it) and whether a reset was done now. A failure to read the marker never blocks a login.
 *
 * Season resets: `npm run reset-players` writes `app_settings.last_reset`; a player whose ledger `resetAt` is older is reset once at their next login. Operating guide: the Ops page (season reset CLI).
 *
 * @category Saves & Server/Away time
 * @order 2
 */
export const ensureSeasonReset = async (
	deps: Pick<ServiceDeps, 'ledgers' | 'saves'>,
	lastReset: number | null,
	userId: string,
	nowMs: number,
): Promise<{ lastReset: number | null; reset: boolean }> => {
	if (lastReset === null) return { lastReset, reset: false };
	const ledger = await deps.ledgers.load(userId);
	if (!ledger || (ledger.resetAt ?? 0) >= lastReset) return { lastReset, reset: false }; // no game yet, or already reset since
	await startNewGame(deps, userId, nowMs);
	return { lastReset, reset: true };
};
