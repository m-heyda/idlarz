import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { fail, json, readBody, unavailable } from '@/lib/authRoute';
import { requirePlayer } from '@/lib/playerRoute';
import { PLAYER_CLASSES, type PlayerClassId } from '@/config/playerClasses';
import { checkAvatarFor, fittingAvatarId, loadUnlockedAvatars, writeAvatar } from '@/lib/avatarServer';
import { isRecord } from '@/lib/isRecord';

export const dynamic = 'force-dynamic';

/** The profile's class and stored avatar; `null` when the account has no profile yet. */
const loadProfile = async (admin: ReturnType<typeof createSupabaseAdmin>, userId: string) => {
	const { data, error } = await admin.from('profiles').select('avatar_id, player_class').eq('id', userId).maybeSingle();
	if (error) throw new Error(error.message);
	const playerClass =
		typeof data?.player_class === 'string' && PLAYER_CLASSES[data.player_class as PlayerClassId] ? (data.player_class as PlayerClassId) : null;
	return playerClass ? { playerClass, avatarId: typeof data?.avatar_id === 'string' ? data.avatar_id : null } : null;
};

/**
 * The picker's data: the profile's class, the avatar it wears (a stored one that no longer fits the class or the earned list falls back to the class default; null = none chosen yet) and every avatar id it may pick
 * (the class's own starters plus the rewards earned). 400 without a profile.
 */
export async function GET() {
	try {
		const player = await requirePlayer();
		if (!player.userId) return player.response;
		const admin = createSupabaseAdmin();
		const profile = await loadProfile(admin, player.userId);
		if (!profile) return fail('Create your hero first.', 400);
		const avatarId = profile.avatarId === null ? null : await fittingAvatarId(admin, player.userId, profile.avatarId, profile.playerClass);
		return json({ playerClass: profile.playerClass, avatarId, unlocked: await loadUnlockedAvatars(admin, player.userId, profile.playerClass) });
	} catch {
		return unavailable();
	}
}

/**
 * Changes the signed-in player's avatar: `{ avatarId }`. The id must be in the catalog, a starter must belong to the profile's class, and a reward must be earned by this account (`checkAvatar`); an unknown, locked or other-class id is a 400 and
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
		const profile = await loadProfile(admin, player.userId);
		if (!profile) return fail('Create your hero first.', 400);
		const checked = await checkAvatarFor(admin, player.userId, raw, profile.playerClass);
		if (!checked.ok || checked.value === null) return fail(checked.ok ? 'Pick one of the avatars.' : checked.error, 400);
		await writeAvatar(admin, player.userId, checked.value);
		return json({ ok: true, avatarId: checked.value });
	} catch {
		return unavailable();
	}
}
