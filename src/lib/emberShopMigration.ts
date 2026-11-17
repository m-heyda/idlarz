import { SHOP_VERSION } from '@/config/rebirth';
import type { PrestigeState } from '@/types/game';

/**
 * The Ember shop was reworked (new ids, costs and effects). An account from before it has no `shopVersion`: its spent shop levels were bought under other numbers, so they are refunded once.
 *
 * - every shop level is cleared and every Ember ever earned is unspent again (`legacyPoints = legacyEarned`), so the player spends them in the new shop; `legacyEarned` and `rebirths` stay, so the income bonus does not change;
 * - the account moves to `SHOP_VERSION`, which marks it done: running it again changes nothing (a stale tab or an old client cannot undo it, and the SQL in `supabase/migrations/ember_refund_v2.sql` is the same step run on the stored saves);
 * - a player who already had auto-potion (the old rule: unlocked with the first rebirth) gets Potion Reflex for free as a grant, so nobody loses a feature.
 *
 * Pure, idempotent, and part of reading a save (`sanitizeSave`), so every path that loads or accepts a save applies it.
 *
 * @category Saves & Server/Migrations
 * @order 3
 */
export const refundOldShop = (prestige: PrestigeState): PrestigeState => {
	if ((prestige.shopVersion ?? 0) >= SHOP_VERSION) return prestige;
	const grants = new Set(prestige.grants ?? []);
	if (prestige.rebirths >= 1) grants.add('potion');
	return {
		...prestige,
		upgrades: {},
		legacyPoints: prestige.legacyEarned,
		shopVersion: SHOP_VERSION,
		...(grants.size ? { grants: [...grants] } : {}),
	};
};
