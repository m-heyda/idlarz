import type { SupabaseClient } from '@supabase/supabase-js';

// SERVER ONLY. Reads and writes `profiles.badge_id` / `profiles.title_id` with the service-role client; the rule itself is `checkBadgeChoice` (catalog/badges.ts).

/** The stored choice of this account; a missing row is "nothing chosen". A failed read throws. */
export const loadBadgeChoice = async (db: SupabaseClient, userId: string): Promise<{ badgeId: string | null; titleId: string | null }> => {
	const { data, error } = await db.from('profiles').select('badge_id, title_id').eq('id', userId).maybeSingle();
	if (error) throw new Error(error.message);
	return { badgeId: typeof data?.badge_id === 'string' ? data.badge_id : null, titleId: typeof data?.title_id === 'string' ? data.title_id : null };
};

/** Stores the (already checked) choice. */
export const writeBadgeChoice = async (db: SupabaseClient, userId: string, badgeId: string | null, titleId: string | null): Promise<void> => {
	const { error } = await db.from('profiles').update({ badge_id: badgeId, title_id: titleId }).eq('id', userId);
	if (error) throw new Error(error.message);
};
