import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { fail, json, readBody, unavailable } from '@/lib/authRoute';
import { requirePlayer } from '@/lib/playerRoute';
import { loadEarnedAchievements } from '@/lib/avatarServer';
import { loadBadgeChoice, writeBadgeChoice } from '@/lib/badgeServer';
import { checkBadgeChoice } from '@/catalog/badges';
import { isRecord } from '@/lib/isRecord';

export const dynamic = 'force-dynamic';

/** The badge and title the profile shows (`null` badge = the default, `"none"` = hidden) and the achievements it has earned, which decide what it may pick. */
export async function GET() {
	try {
		const player = await requirePlayer();
		if (!player.userId) return player.response;
		const admin = createSupabaseAdmin();
		const [choice, earned] = await Promise.all([loadBadgeChoice(admin, player.userId), loadEarnedAchievements(admin, player.userId)]);
		return json({ ...choice, earned });
	} catch {
		return unavailable();
	}
}

/** Changes the badge and the title: `{ badgeId, titleId }`, each `null`, or (badge) `"none"` to hide it. A badge or title that is not earned is a 400 and nothing is written. */
export async function POST(request: Request) {
	try {
		const player = await requirePlayer(request);
		if (!player.userId) return player.response;
		const body = await readBody(request);
		if (!isRecord(body)) return fail('Pick a badge and a title.', 400);
		const admin = createSupabaseAdmin();
		const checked = checkBadgeChoice({ badgeId: body.badgeId ?? null, titleId: body.titleId ?? null }, await loadEarnedAchievements(admin, player.userId));
		if (!checked.ok) return fail(checked.error, 400);
		await writeBadgeChoice(admin, player.userId, checked.badgeId, checked.titleId);
		return json({ ok: true, badgeId: checked.badgeId, titleId: checked.titleId });
	} catch {
		return unavailable();
	}
}
