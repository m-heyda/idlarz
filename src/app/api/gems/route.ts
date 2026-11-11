import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { KEY, onlineRoute } from '@/lib/offlineRoute';
import type { GemsRequest } from '@/lib/offline/gemTypes';
import { runGems } from '@/lib/offline/gemsFlow';
import { supabaseIdentityRepo } from '@/lib/offline/identity';

export const dynamic = 'force-dynamic';

type Body = { key: string | null; request: GemsRequest };

const text = (value: unknown): string | undefined => (typeof value === 'string' && value.length <= 40 ? value : undefined);

/**
 * The gem shop: `{ action: 'status' }` reads the balance, the daily bonus and the cooldowns; `{ action: 'daily', key }` claims today's bonus; `{ action: 'spend', key, itemId, value? }` buys one item of the price book (class change, name change,
 * attribute respec). The body names no price and no amount: the server's price book decides, the balance is the ledger's. `key` is the idempotency key (a repeated request gets the stored answer).
 */
export async function POST(request: Request) {
	return onlineRoute(
		request,
		(body): Body | null => {
			if (body.action === 'status') return { key: null, request: { action: 'status' } };
			if (typeof body.key !== 'string' || !KEY.test(body.key)) return null;
			if (body.action === 'daily') return { key: body.key, request: { action: 'daily' } };
			if (body.action === 'spend' && typeof body.itemId === 'string' && body.itemId.length <= 40)
				return { key: body.key, request: { action: 'spend', itemId: body.itemId, value: text(body.value) } };
			return null;
		},
		(deps, userId, body, nowMs) => runGems(deps, supabaseIdentityRepo(createSupabaseAdmin()), userId, body.key, body.request, nowMs),
	);
}
