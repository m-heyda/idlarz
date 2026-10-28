import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { supabaseSaveRepo } from '@/lib/cloudSave/supabaseRepo';
import { fail, json, readBody, unavailable } from '@/lib/authRoute';
import { requirePlayer } from '@/lib/playerRoute';
import { supabaseLedgerRepo } from '@/lib/offline/supabaseLedger';
import { lootConfigured, lootSecret } from '@/lib/offline/secret';
import type { Online } from '@/lib/offline/online';
import type { ServiceDeps } from '@/lib/offline/service';

/** An idempotency key: the client makes one per request and repeats it if the answer got lost. */
export const KEY = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * The shared shell of the signed-in game routes (/api/spawn, /api/chest, /api/kill): the player comes from the cookie, the body is small
 * JSON checked by `parse` (null = refuse), and the answer is what the server rolled. 404 = no cloud save yet, 409 + `needClaim` = an
 * absence has to be claimed first (POST /api/offline), 503 = not set up or an outage.
 */
export const onlineRoute = async <Body>(
	request: Request,
	parse: (body: Record<string, unknown>) => Body | null,
	run: (deps: ServiceDeps, userId: string, body: Body, nowMs: number) => Promise<Online<unknown>>
): Promise<Response> => {
	try {
		const player = await requirePlayer();
		if (!player.userId) return player.response ?? fail('Not signed in.', 401);
		if (!lootConfigured()) return unavailable('not_configured');
		const raw = (await readBody(request)) as Record<string, unknown> | null;
		const body = raw && typeof raw === 'object' ? parse(raw) : null;
		if (!body) return fail('Bad request.', 400);
		const admin = createSupabaseAdmin();
		const out = await run({ ledgers: supabaseLedgerRepo(admin), saves: supabaseSaveRepo(admin), secret: lootSecret() }, player.userId, body, Date.now());
		if (out.kind === 'no_save') return json({ error: 'No cloud save yet.', noSave: true }, 404);
		if (out.kind === 'claim_first') return json({ error: 'Claim your time away first.', needClaim: true }, 409);
		return json(out.value);
	} catch {
		return unavailable();
	}
};
