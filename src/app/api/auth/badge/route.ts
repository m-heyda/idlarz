import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { fail, json, readBody, unavailable } from '@/lib/authRoute';
import { requirePlayer } from '@/lib/playerRoute';
import { loadEarnedAchievements } from '@/lib/avatarServer';
import { loadBadgeChoice, writeBadgeChoice } from '@/lib/badgeServer';
import { checkBadgeChoice, titleOptions } from '@/catalog/badges';
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

/** Changes the badge and the title: `{ badgeId, titleId }`, each `null` (or left out to keep it), or (badge) `"none"` to hide it. A badge or title that is not earned is a 400 and nothing is written. */
export async function POST(request: Request) {
	try {
		const player = await requirePlayer(request);
		if (!player.userId) return player.response;
		const body = await readBody(request);
		if (!isRecord(body)) return fail('Pick a badge and a title.', 400);
		const admin = createSupabaseAdmin();
		const earned = await loadEarnedAchievements(admin, player.userId);
		// a field the request leaves out keeps what is stored (a badge pick must not fail on an old title, and the other way round)
		const stored = await loadBadgeChoice(admin, player.userId);
		const keptTitle = titleOptions(earned).some((t) => t.id === stored.titleId) ? stored.titleId : null;
		const checked = checkBadgeChoice(
			{ badgeId: 'badgeId' in body ? (body.badgeId ?? null) : stored.badgeId, titleId: 'titleId' in body ? (body.titleId ?? null) : keptTitle },
			earned,
		);
		if (!checked.ok) return fail(checked.error, 400);
		await writeBadgeChoice(admin, player.userId, checked.badgeId, checked.titleId);
		return json({ ok: true, badgeId: checked.badgeId, titleId: checked.titleId });
	} catch {
		return unavailable();
	}
}
