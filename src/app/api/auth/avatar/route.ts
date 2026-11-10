import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { fail, json, readBody, unavailable } from '@/lib/authRoute';
import { requirePlayer } from '@/lib/playerRoute';
import { checkAvatarFor, loadUnlockedAvatars, writeAvatar } from '@/lib/avatarServer';
import { isRecord } from '@/lib/isRecord';

export const dynamic = 'force-dynamic';

/** The picker's data: the avatar the account has chosen (null = none yet) and every avatar id it may pick (starters plus the unlockables it has earned). */
export async function GET() {
	try {
		const player = await requirePlayer();
		if (!player.userId) return player.response;
		const admin = createSupabaseAdmin();
		const { data, error } = await admin.from('profiles').select('avatar_id').eq('id', player.userId).maybeSingle();
		if (error) return unavailable();
		return json({ avatarId: typeof data?.avatar_id === 'string' ? data.avatar_id : null, unlocked: await loadUnlockedAvatars(admin, player.userId) });
	} catch {
		return unavailable();
	}
}

/**
 * Changes the signed-in player's avatar: `{ avatarId }`. The id must be in the catalog and, for an unlockable one, earned by this account (`checkAvatar`); an unknown or locked id is a 400 and
 * nothing is written. The column is written with the service role only.
 */
export async function POST(request: Request) {
	try {
		const player = await requirePlayer(request);
		if (!player.userId) return player.response;
		const body = await readBody(request);
		const raw = isRecord(body) ? body.avatarId : undefined;
		if (typeof raw !== 'string') return fail('Pick one of the avatars.', 400);
		const admin = createSupabaseAdmin();
		const checked = await checkAvatarFor(admin, player.userId, raw);
		if (!checked.ok || checked.value === null) return fail(checked.ok ? 'Pick one of the avatars.' : checked.error, 400);
		await writeAvatar(admin, player.userId, checked.value);
		return json({ ok: true, avatarId: checked.value });
	} catch {
		return unavailable();
	}
}
