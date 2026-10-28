import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { supabaseSaveRepo } from '@/lib/cloudSave/supabaseRepo';
import { acceptSave, storedToText } from '@/lib/cloudSave/pipeline';
import { isNonProduction } from '@/lib/cloudSave/environment';
import { fail, json, loadProfile, readBody, unavailable } from '@/lib/authRoute';
import { requirePlayer } from '@/lib/playerRoute';
import { supabaseLedgerRepo } from '@/lib/offline/supabaseLedger';

export const dynamic = 'force-dynamic';

// Real saves are far smaller (a 55,000-tile map is about 85 KB as text); this keeps one account from storing megabytes
const SAVE_BODY_MAX = 600_000;

/** The account's cloud save (text the client imports, plus headline numbers for the start hub), or `{ empty: true }`. */
export async function GET() {
	try {
		const player = await requirePlayer();
		if (!player.userId) return player.response;
		const stored = await supabaseSaveRepo(createSupabaseAdmin()).load(player.userId, { world: true });
		if (!stored) return json({ empty: true });
		const { level, tilesOwned, playSeconds, gold } = stored.summary;
		return json({ rev: stored.rev, serverSavedAt: stored.serverSavedAt, text: storedToText(stored), summary: { level, tilesOwned, playSeconds, gold } });
	} catch {
		return unavailable();
	}
}

/**
 * Stores a save: `{ text, baseRev }`. The id comes from the cookie only. 409 means the cloud moved on since `baseRev`
 * (another browser saved): nothing is overwritten and the client lets the player choose.
 */
export async function POST(request: Request) {
	try {
		const player = await requirePlayer();
		if (!player.userId) return player.response;
		const body = (await readBody(request, SAVE_BODY_MAX)) as { text?: unknown; baseRev?: unknown } | null;
		if (!body || typeof body.text !== 'string' || !Number.isInteger(body.baseRev) || (body.baseRev as number) < 0) return fail('Bad save request.', 400);

		// The leaderboard name comes from the player's profile row (the owner-only name set at registration), never from the save
		const { profile } = await loadProfile(player.supabase, player.userId);
		const outcome = await acceptSave(supabaseSaveRepo(createSupabaseAdmin()), player.userId, profile?.characterName ?? 'Player', body.text, body.baseRev as number, Date.now(), isNonProduction(), supabaseLedgerRepo(createSupabaseAdmin()));
		switch (outcome.kind) {
			case 'ok':
				return json({ rev: outcome.rev, serverSavedAt: outcome.serverSavedAt, gems: outcome.gems, xp: outcome.xp });
			case 'conflict':
				return json({ error: 'Your account has a newer save.', conflict: true, rev: outcome.rev, serverSavedAt: outcome.serverSavedAt }, 409);
			case 'too_soon':
				return json({ error: 'Saving too often.', retryAfterMs: outcome.retryAfterMs }, 429);
			case 'invalid':
				return fail(outcome.reason, 422);
		}
	} catch {
		return unavailable();
	}
}
