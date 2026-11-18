import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { fail, unavailable } from '@/lib/authRoute';
import { requirePlayer } from '@/lib/playerRoute';
import { isLiveBoard } from '@/lib/rankings';
import { loadBoard } from '@/lib/rankingsServer';
import { supabaseSaveRepo } from '@/lib/cloudSave/supabaseRepo';
import { recordRankPlace } from '@/lib/offline/curiosity';
import { lootConfigured, lootSecret } from '@/lib/offline/secret';
import { withLedger } from '@/lib/offline/service';
import { supabaseAchievementRepo, supabaseLedgerRepo } from '@/lib/offline/supabaseLedger';

export const dynamic = 'force-dynamic';

/**
 * The Rankings: `GET /api/rankings?board=level|rebirths|crafting|tiles|kills|deeds`. Answers the first 50 places of the board (rank, the change since the last rebuild, the name with its colour, badge, title and avatar, the value) and the
 * asking player's own place when it is further down. Every non-test account of the current chapter is ranked (`refresh_rankings()`), and no account id is sent. The places are rebuilt at most once per 24 hours, by the first request after that (`refresh_rankings()`, a single
 * SQL call, so no scheduled job is needed); the cosmetics are read live. The `quests` board is not built and is a 400.
 *
 * @category Saves & Server/Endpoints
 * @title GET /api/rankings
 */
export async function GET(request: Request) {
	try {
		const player = await requirePlayer();
		if (!player.userId) return player.response;
		const board = new URL(request.url).searchParams.get('board') ?? 'level';
		if (!isLiveBoard(board)) return fail('That ranking is not available yet.', 400);
		const admin = createSupabaseAdmin();
		const answer = await loadBoard(admin, board, player.userId);
		// a podium place (1st to 3rd on any board) is a deed: the server records it from the board it just read; best effort, the board is answered either way
		const place = answer.rows.find((row) => row.me)?.rank ?? answer.mine?.rank ?? 0;
		if (place >= 1 && place <= 3 && lootConfigured()) {
			try {
				await withLedger(
					{ ledgers: supabaseLedgerRepo(admin), saves: supabaseSaveRepo(admin), secret: lootSecret(), achievements: supabaseAchievementRepo(admin) },
					player.userId,
					Date.now(),
					(ledger) => {
						const next = recordRankPlace(ledger, place);
						return { ledger: next, result: null, skipWrite: next === ledger };
					},
				);
			} catch {
				// the place is recorded the next time the board is read
			}
		}
		// the answer is the same for every viewer but their own row, and changes at most daily: let the browser keep it for a minute (the places only change at the daily rebuild, but a rebuild or a new player must show soon)
		return NextResponse.json(answer, { headers: { 'Cache-Control': 'private, max-age=60' } });
	} catch {
		return unavailable();
	}
}
