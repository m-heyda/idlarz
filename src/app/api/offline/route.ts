import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { supabaseSaveRepo } from '@/lib/cloudSave/supabaseRepo';
import { fail, json, readBody, unavailable } from '@/lib/authRoute';
import { requirePlayer } from '@/lib/playerRoute';
import { supabaseLedgerRepo } from '@/lib/offline/supabaseLedger';
import { lootConfigured, lootSecret } from '@/lib/offline/secret';
import { claimOffline } from '@/lib/offline/service';

export const dynamic = 'force-dynamic';

/** An idempotency key: the client makes one per login and repeats it if the answer got lost. */
const CLAIM_ID = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Pays the player for the time they were away: `{ claimId }`. The id comes from the cookie only, the amount is computed here from the
 * last accepted save and the server clock, and the answer is remembered under `claimId` so repeating the call (a lost response, a
 * second tab) cannot pay twice. Nothing in the body can name an amount or a duration.
 */
export async function POST(request: Request) {
	try {
		const player = await requirePlayer();
		if (!player.userId) return player.response;
		if (!lootConfigured()) return unavailable('not_configured');
		const body = (await readBody(request)) as { claimId?: unknown } | null;
		if (!body || typeof body.claimId !== 'string' || !CLAIM_ID.test(body.claimId)) return fail('Bad offline request.', 400);

		const admin = createSupabaseAdmin();
		const outcome = await claimOffline({ ledgers: supabaseLedgerRepo(admin), saves: supabaseSaveRepo(admin), secret: lootSecret() }, player.userId, body.claimId, Date.now());
		if (outcome.kind === 'no_save') return json({ error: 'No cloud save yet.', noSave: true }, 404);
		return json(outcome.result);
	} catch {
		return unavailable();
	}
}
