import type { SupabaseClient } from '@supabase/supabase-js';
import { fitAvatar } from '@/catalog/avatars';
import { PLAYER_CLASSES, type PlayerClassId } from '@/config/playerClasses';
import { loadEarnedAchievements } from '@/lib/avatarServer';
import type { PendingIdentity } from '@/lib/offline/gemTypes';

// SERVER ONLY. The hero's name and class are the server's to change (migration identity_server_only revoked the player's own update grant): the gem shop charges for the change in the ledger, then the profile row is written here with the service-role client.

export interface IdentityInfo {
	characterName: string;
	playerClass: string | null;
	/** Epoch seconds of the last paid name change; null = never changed */
	nameChangedAtSec: number | null;
}

export type ApplyResult = 'ok' | 'name_taken' | 'no_profile';

/** Where identity lives: Supabase in the app, a Map in the tests. */
export interface IdentityRepo {
	load(userId: string): Promise<IdentityInfo | null>;
	/** Whether another account holds this name (case-insensitive, like the unique index `profiles_character_name_ci`) */
	nameTaken(userId: string, name: string): Promise<boolean>;
	/** Writes the change. Idempotent: writing the same class or name again changes nothing, and a name change stamps `name_changed_at` only when it actually changes the name. */
	apply(userId: string, pending: PendingIdentity, nowSec: number): Promise<ApplyResult>;
}

/** Escapes the characters `ilike` treats as patterns, so a name matches only itself. */
const likeLiteral = (name: string): string => name.replace(/[\\%_]/g, '\\$&');

export const supabaseIdentityRepo = (db: SupabaseClient): IdentityRepo => ({
	async load(userId) {
		const { data, error } = await db.from('profiles').select('character_name, player_class, name_changed_at').eq('id', userId).maybeSingle();
		if (error) throw new Error(error.message);
		if (!data) return null;
		const changed = typeof data.name_changed_at === 'string' ? Date.parse(data.name_changed_at) : NaN;
		return {
			characterName: String(data.character_name),
			playerClass: typeof data.player_class === 'string' ? data.player_class : null,
			nameChangedAtSec: Number.isFinite(changed) ? Math.floor(changed / 1000) : null,
		};
	},

	async nameTaken(userId, name) {
		const { data, error } = await db.from('profiles').select('id').ilike('character_name', likeLiteral(name)).neq('id', userId).limit(1);
		if (error) throw new Error(error.message);
		return (data?.length ?? 0) > 0;
	},

	async apply(userId, pending, nowSec) {
		const { data: row, error: readError } = await db.from('profiles').select('character_name, player_class, avatar_id').eq('id', userId).maybeSingle();
		if (readError) throw new Error(readError.message);
		if (!row) return 'no_profile';
		if (pending.kind === 'name') {
			if (row.character_name === pending.value) return 'ok'; // already written (a retry)
			const { error } = await db
				.from('profiles')
				.update({ character_name: pending.value, name_changed_at: new Date(nowSec * 1000).toISOString() })
				.eq('id', userId);
			if (error?.code === '23505') return 'name_taken';
			if (error) throw new Error(error.message);
			return 'ok';
		}
		const playerClass = pending.value as PlayerClassId;
		if (!PLAYER_CLASSES[playerClass]) return 'no_profile';
		// an avatar that belongs to the old class (or is not earned) is swapped for the new class's default, so a class change never strands a wrong face
		const earned = await loadEarnedAchievements(db, userId);
		const avatarId = fitAvatar(typeof row.avatar_id === 'string' ? row.avatar_id : null, playerClass, earned).id;
		const { error } = await db.from('profiles').update({ player_class: playerClass, avatar_id: avatarId }).eq('id', userId);
		if (error) throw new Error(error.message);
		return 'ok';
	},
});
