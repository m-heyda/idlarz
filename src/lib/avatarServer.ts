import type { SupabaseClient } from '@supabase/supabase-js';
import { unlockedAvatarIds } from '@/catalog/avatars';
import { checkAvatar } from '@/lib/authValidation';

// SERVER ONLY. Reads what an account has earned and writes `profiles.avatar_id`, always through the service-role client (the column is not writable by the player, see
// supabase/migrations/profiles_server_columns.sql). The rule itself is `checkAvatar`.

/** The achievement ids this account has earned (`player_achievements`); a failed read throws, so an outage never turns into "nothing unlocked". */
export const loadEarnedAchievements = async (db: SupabaseClient, userId: string): Promise<string[]> => {
	const { data, error } = await db.from('player_achievements').select('achievement_id').eq('user_id', userId);
	if (error) throw new Error(error.message);
	return (data ?? []).map((row) => String(row.achievement_id));
};

/** The avatar ids this account may pick: the starters plus the unlockables it has earned. */
export const loadUnlockedAvatars = async (db: SupabaseClient, userId: string): Promise<string[]> => unlockedAvatarIds(await loadEarnedAchievements(db, userId));

/** Checks `raw` against what the account has earned. Used by the routes that take an avatar from the player (chapter, avatar change). */
export const checkAvatarFor = async (db: SupabaseClient, userId: string, raw: unknown) => checkAvatar(raw, await loadEarnedAchievements(db, userId));

/** Stores the (already checked) avatar on the profile. */
export const writeAvatar = async (db: SupabaseClient, userId: string, avatarId: string): Promise<void> => {
	const { error } = await db.from('profiles').update({ avatar_id: avatarId }).eq('id', userId);
	if (error) throw new Error(error.message);
};
