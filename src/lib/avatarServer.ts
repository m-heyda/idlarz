import type { SupabaseClient } from '@supabase/supabase-js';
import { classAvatarIds, fitAvatar } from '@/catalog/avatars';
import type { PlayerClassId } from '@/config/playerClasses';
import { checkAvatar } from '@/lib/authValidation';

// SERVER ONLY. Reads what an account has earned and writes `profiles.avatar_id`, always through the service-role client (the column is not writable by the player, see
// supabase/migrations/profiles_server_columns.sql). The rule itself is `checkAvatar`.

/** The achievement ids this account has earned (`player_achievements`); a failed read throws, so an outage never turns into "nothing unlocked". */
export const loadEarnedAchievements = async (db: SupabaseClient, userId: string): Promise<string[]> => {
	const { data, error } = await db.from('player_achievements').select('achievement_id').eq('user_id', userId);
	if (error) throw new Error(error.message);
	return (data ?? []).map((row) => String(row.achievement_id));
};

/** The avatar ids this account may pick with `playerClass`: the class's own starters plus the rewards it has earned. */
export const loadUnlockedAvatars = async (db: SupabaseClient, userId: string, playerClass: PlayerClassId): Promise<string[]> =>
	classAvatarIds(playerClass, await loadEarnedAchievements(db, userId));

/** Checks `raw` against the class and what the account has earned. Used by the routes that take an avatar from the player (chapter, avatar change). */
export const checkAvatarFor = async (db: SupabaseClient, userId: string, raw: unknown, playerClass: PlayerClassId) =>
	checkAvatar(raw, playerClass, await loadEarnedAchievements(db, userId));

/** The profile's stored avatar as it is shown: the stored id when it still fits the class and is earned, else the class default (a class change must not strand a wrong face). */
export const fittingAvatarId = async (db: SupabaseClient, userId: string, stored: string | null, playerClass: PlayerClassId): Promise<string> =>
	fitAvatar(stored, playerClass, await loadEarnedAchievements(db, userId)).id;

/** Stores the (already checked) avatar on the profile. */
export const writeAvatar = async (db: SupabaseClient, userId: string, avatarId: string): Promise<void> => {
	const { error } = await db.from('profiles').update({ avatar_id: avatarId }).eq('id', userId);
	if (error) throw new Error(error.message);
};
