import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { onlineRoute } from '@/lib/offlineRoute';
import { runGems } from '@/lib/offline/gemsFlow';
import { parseGemsBody } from '@/lib/offline/gemsParse';
import { supabaseIdentityRepo } from '@/lib/offline/identity';

export const dynamic = 'force-dynamic';

/**
 * The gem shop: `{ action: 'status' }` reads the balance, the daily bonus and the cooldowns; `{ action: 'daily', key }` claims today's bonus; `{ action: 'claim', key, id }` pays one earned achievement tier (the Hall of Deeds Claim button) and `{ action: 'claimAll', key }` pays every earned tier that is waiting, in one request;
 * `{ action: 'spend', key, itemId, value? }` buys one item of the price book (class change, name change, attribute respec). The body names no price and no amount: the server's price book decides, the balance is the ledger's.
 * `key` is the idempotency key (a repeated request gets the stored answer). The body is read by `parseGemsBody`.
 */
export async function POST(request: Request) {
	return onlineRoute(request, parseGemsBody, (deps, userId, body, nowMs) =>
		runGems(deps, supabaseIdentityRepo(createSupabaseAdmin()), userId, body.key, body.request, nowMs),
	);
}
