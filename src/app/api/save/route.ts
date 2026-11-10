import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { supabaseSaveRepo } from '@/lib/cloudSave/supabaseRepo';
import { acceptSave, storedToText } from '@/lib/cloudSave/pipeline';
import { isNonProduction } from '@/lib/cloudSave/environment';
import { needsResetFor } from '@/config/epoch';
import { fail, json, loadProfile, readBody, unavailable } from '@/lib/authRoute';
import { requirePlayer } from '@/lib/playerRoute';
import { supabaseLedgerRepo } from '@/lib/offline/supabaseLedger';
import { startNewGame } from '@/lib/offline/service';
import { ensureSeasonReset, readLastReset, readPlayerReset } from '@/lib/offline/season';

export const dynamic = 'force-dynamic';

// Real saves are far smaller (a 55,000-tile map is about 85 KB as text); this keeps one account from storing megabytes
const SAVE_BODY_MAX = 600_000;

/** The account's cloud save (text the client imports, plus headline numbers for the start hub), or `{ empty: true }`. */
export async function GET(request: Request) {
	try {
		const player = await requirePlayer(request);
		if (!player.userId) return player.response;
		const admin = createSupabaseAdmin();
		// a season reset this player has not been through yet happens now, before anything of the old game is handed out
		let lastReset: number | null = null;
		try {
			lastReset = (
				await ensureSeasonReset({ ledgers: supabaseLedgerRepo(admin), saves: supabaseSaveRepo(admin) }, await readLastReset(admin), player.userId, Date.now())
			).lastReset;
			// a reset of this one account (reset-players --user) counts like a season reset for the browser's copy of the game
			const own = await readPlayerReset(admin, player.userId);
			if (own !== null) lastReset = Math.max(lastReset ?? 0, own);
		} catch {
			// the marker could not be read: the login goes on, the next one looks again
		}
		const stored = await supabaseSaveRepo(admin).load(player.userId, { world: true });
		if (!stored) return json({ empty: true, lastReset });
		const { level, tilesOwned, playSeconds, gold } = stored.summary;
		return json({
			rev: stored.rev,
			serverSavedAt: stored.serverSavedAt,
			text: storedToText(stored),
			summary: { level, tilesOwned, playSeconds, gold },
			lastReset,
		});
	} catch {
		return unavailable();
	}
}

/** New Game: the account's cloud game is replaced (the old save is kept pinned in the history), so nothing of it is paid or kept. Gems stay. */
export async function DELETE(request: Request) {
	try {
		const player = await requirePlayer(request);
		if (!player.userId) return player.response;
		const admin = createSupabaseAdmin();
		await startNewGame({ ledgers: supabaseLedgerRepo(admin), saves: supabaseSaveRepo(admin) }, player.userId, Date.now());
		return json({ ok: true });
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
		const player = await requirePlayer(request);
		if (!player.userId) return player.response;
		const body = (await readBody(request, SAVE_BODY_MAX)) as { text?: unknown; baseRev?: unknown } | null;
		if (!body || typeof body.text !== 'string' || !Number.isInteger(body.baseRev) || (body.baseRev as number) < 0) return fail('Bad save request.', 400);

		// The leaderboard name comes from the player's profile row (the owner-only name set at registration), never from the save
		const { profile, epoch } = await loadProfile(player.supabase, player.userId);
		// an account that has not been through the new chapter screen yet may not upload: its game is the old chapter's (dark while the epoch is the baseline)
		if (needsResetFor(epoch)) return json({ error: 'Start the new chapter first.', needsReset: true }, 412);
		const outcome = await acceptSave(
			supabaseSaveRepo(createSupabaseAdmin()),
			player.userId,
			profile?.characterName ?? 'Player',
			body.text,
			body.baseRev as number,
			Date.now(),
			isNonProduction(),
			supabaseLedgerRepo(createSupabaseAdmin()),
			undefined,
			profile?.playerClass,
		);
		switch (outcome.kind) {
			case 'ok':
				// a save that replaced one holding more (the browser re-based its game over it): the replaced save is pinned in the history, and this line says which
				if (outcome.replaced)
					console.warn(
						JSON.stringify({ event: 'save_overwrite', userId: player.userId, rev: outcome.rev, ...outcome.replaced, nonProduction: isNonProduction() }),
					);
				return json({ rev: outcome.rev, serverSavedAt: outcome.serverSavedAt, gems: outcome.gems, xp: outcome.xp, prestige: outcome.prestige });
			case 'conflict':
				// counted in the server log so the frequency of stale uploads is visible (the client resolves most of them on its own)
				console.warn(
					JSON.stringify({
						event: 'save_conflict',
						userId: player.userId,
						baseRev: body.baseRev,
						rev: outcome.rev,
						ageMs: Date.now() - outcome.serverSavedAt,
						nonProduction: isNonProduction(),
					}),
				);
				return json({ error: 'Your account has a newer save.', conflict: true, rev: outcome.rev, serverSavedAt: outcome.serverSavedAt }, 409);
			case 'too_soon':
				return json({ error: 'Saving too often.', retryAfterMs: outcome.retryAfterMs }, 429);
			case 'rejected':
				// the decision is recorded in the server log (no table for it yet); the account keeps its last accepted save
				console.warn(JSON.stringify({ event: 'save_rejected', userId: player.userId, flags: outcome.flags }));
				return json({ error: 'This save was refused.', rejected: true, flags: outcome.flags }, 422);
			case 'invalid':
				return fail(outcome.reason, 422);
		}
	} catch {
		return unavailable();
	}
}
