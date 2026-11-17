import { SHOP_VERSION } from '@/config/rebirth';
import type { PrestigeState } from '@/types/game';

/**
 * The shop generation and the free grants are the server's, never the upload's: a client could otherwise grant itself Potion Reflex (grants cost nothing).
 *
 * - the stored save is already on the new shop: its `shopVersion` and `grants` replace whatever the upload says;
 * - the stored save is from before the rework (no `shopVersion`): the upload is judged by the migration rule (`refundOldShop`) and kept as it is;
 * - no stored save (a first save): there is nothing to grant from, so the upload keeps no grants.
 */
export const stampShopFromServer = (uploaded: PrestigeState, stored: PrestigeState | undefined): PrestigeState => {
	const stripped = (prestige: PrestigeState): PrestigeState => {
		if (!prestige.grants) return prestige;
		const rest = { ...prestige };
		delete rest.grants;
		return rest;
	};
	if (!stored) return stripped(uploaded);
	if ((stored.shopVersion ?? 0) < SHOP_VERSION) return uploaded;
	const same = uploaded.shopVersion === stored.shopVersion && JSON.stringify(uploaded.grants ?? []) === JSON.stringify(stored.grants ?? []);
	if (same) return uploaded;
	return { ...stripped(uploaded), shopVersion: stored.shopVersion, ...(stored.grants?.length ? { grants: stored.grants } : {}) };
};

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
