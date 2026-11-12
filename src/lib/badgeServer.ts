import type { SupabaseClient } from '@supabase/supabase-js';
import { NICK_COLORS_ITEM, NICK_EFFECTS } from '@/config/nickColors';
import type { NameColorAccess } from '@/catalog/badges';
import { readGemShop } from '@/lib/offline/ledger';

// SERVER ONLY. Reads and writes `profiles.badge_id` / `title_id` / `name_color` with the service-role client (the rules are `checkBadgeChoice` and `checkNameColor`, catalog/badges.ts); `profiles.is_admin` is only read.

export interface StoredIdentity {
	badgeId: string | null;
	titleId: string | null;
	nameColor: string | null;
	/** `profiles.is_admin`: the owner's account (free name colours, the gold nickname) */
	admin: boolean;
}

/** The stored choice of this account; a missing row is "nothing chosen". A failed read throws. */
export const loadBadgeChoice = async (db: SupabaseClient, userId: string): Promise<StoredIdentity> => {
	const { data, error } = await db.from('profiles').select('badge_id, title_id, name_color, is_admin').eq('id', userId).maybeSingle();
	if (error) throw new Error(error.message);
	return {
		badgeId: typeof data?.badge_id === 'string' ? data.badge_id : null,
		titleId: typeof data?.title_id === 'string' ? data.title_id : null,
		nameColor: typeof data?.name_color === 'string' ? data.name_color : null,
		admin: data?.is_admin === true,
	};
};

/** Stores the (already checked) choice. */
export const writeBadgeChoice = async (db: SupabaseClient, userId: string, badgeId: string | null, titleId: string | null): Promise<void> => {
	const { error } = await db.from('profiles').update({ badge_id: badgeId, title_id: titleId }).eq('id', userId);
	if (error) throw new Error(error.message);
};

/** Stores the (already checked) nickname colour; null = the default colour. */
export const writeNameColor = async (db: SupabaseClient, userId: string, nameColor: string | null): Promise<void> => {
	const { error } = await db.from('profiles').update({ name_color: nameColor }).eq('id', userId);
	if (error) throw new Error(error.message);
};

/**
 * Which nickname colours this account may use: the Name colours and name effect purchases (the purchase counts in `player_ledger.gem_shop`; a missing ledger row is "none"), and everything for an admin account (`profiles.is_admin`). A failed read throws.
 */
export const loadNameColorAccess = async (db: SupabaseClient, userId: string, isAdmin: boolean): Promise<NameColorAccess> => {
	const { data, error } = await db.from('player_ledger').select('gem_shop').eq('user_id', userId).maybeSingle();
	if (error) throw new Error(error.message);
	const bought = readGemShop(data?.gem_shop).bought;
	const admin = isAdmin;
	return {
		admin,
		unlocked: admin || (bought[NICK_COLORS_ITEM] ?? 0) > 0,
		effects: NICK_EFFECTS.filter((effect) => admin || (bought[effect.item] ?? 0) > 0).map((effect) => effect.id),
	};
};
