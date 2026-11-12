import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { fail, unavailable } from '@/lib/authRoute';
import { requirePlayer } from '@/lib/playerRoute';
import { isLiveBoard } from '@/lib/rankings';
import { loadBoard } from '@/lib/rankingsServer';

export const dynamic = 'force-dynamic';

/**
 * The Rankings: `GET /api/rankings?board=level|rebirths|crafting|tiles|kills`. Answers the first 50 places of the board (rank, the change since the last rebuild, the name with its colour, badge, title and avatar, the value) and the
 * asking player's own place when it is further down. Only trusted players are ranked, and no account id is sent. The places are rebuilt at most once per 24 hours, by the first request after that (`refresh_rankings()`, a single
 * SQL call, so no scheduled job is needed); the cosmetics are read live. The `quests` and `deeds` boards are not built and are a 400.
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
		const answer = await loadBoard(createSupabaseAdmin(), board, player.userId);
		// the answer is the same for every viewer but their own row, and changes at most daily: let the browser keep it for five minutes
		return NextResponse.json(answer, { headers: { 'Cache-Control': 'private, max-age=300' } });
	} catch {
		return unavailable();
	}
}
