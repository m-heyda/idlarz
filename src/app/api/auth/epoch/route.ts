import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { supabaseSaveRepo } from '@/lib/cloudSave/supabaseRepo';
import { checkProfile } from '@/lib/authValidation';
import { fail, json, readBody, unavailable } from '@/lib/authRoute';
import { requirePlayer } from '@/lib/playerRoute';
import { supabaseLedgerRepo } from '@/lib/offline/supabaseLedger';
import { checkAvatarFor } from '@/lib/avatarServer';
import { startNewChapter, supabaseChapterRepo } from '@/lib/offline/chapter';

export const dynamic = 'force-dynamic';

/**
 * The "A new chapter" confirm: `{ characterName, playerClass, avatarId? }` (the avatar must be a starter or one this account has unlocked, else 400 and nothing is reset). Archives the account's game into a pinned history row and starts it over (see `startNewChapter`); idempotent, so a repeated
 * request (a second tab, a lost answer) answers `already: true` and changes nothing. 409 `nameTaken`: another account holds that name, nothing was reset. 503 `archive_failed`: the old game could not be archived, nothing was deleted.
 */
export async function POST(request: Request) {
	try {
		const player = await requirePlayer(); // no epoch header check: a browser that still carries the old epoch is exactly the one that has to be able to confirm
		if (!player.userId) return player.response;
		const input = checkProfile(await readBody(request));
		if (!input.ok) return fail(input.error, 400);
		const admin = createSupabaseAdmin();
		// a forged or locked avatar id ends the request before anything is touched
		const avatar = await checkAvatarFor(admin, player.userId, input.value.avatarId);
		if (!avatar.ok) return fail(avatar.error, 400);
		const out = await startNewChapter(
			{ ledgers: supabaseLedgerRepo(admin), saves: supabaseSaveRepo(admin) },
			supabaseChapterRepo(admin),
			player.userId,
			{ ...input.value, avatarId: avatar.value },
			Date.now(),
		);
		switch (out.kind) {
			case 'ok':
				return json({ ok: true, already: out.already });
			case 'name_taken':
				return json({ error: 'That name is taken. Pick another.', nameTaken: true }, 409);
			case 'no_profile':
				return fail('Create your hero first.', 400);
			case 'archive_failed':
				console.warn(JSON.stringify({ event: 'chapter_archive_failed', userId: player.userId }));
				return json({ error: 'Your old game could not be archived, so nothing was changed. Try again in a moment.', archiveFailed: true }, 503);
		}
	} catch {
		return unavailable();
	}
}
