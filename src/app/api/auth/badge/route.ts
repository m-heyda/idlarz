import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { fail, json, readBody, unavailable } from '@/lib/authRoute';
import { requirePlayer } from '@/lib/playerRoute';
import { loadEarnedAchievements } from '@/lib/avatarServer';
import { loadBadgeChoice, loadNameColorsBought, writeBadgeChoice, writeNameColor } from '@/lib/badgeServer';
import { checkBadgeChoice, checkNameColor, shownNameColor, titleOptions } from '@/catalog/badges';
import { isRecord } from '@/lib/isRecord';

export const dynamic = 'force-dynamic';

/** The badge, title and nickname colour the profile shows (`null` badge = the default, `"none"` = hidden), the achievements it has earned (they decide what it may pick), and what the colour picker allows: `colorsUnlocked` (bought in the Gem shop, or admin) and `admin`. */
export async function GET() {
	try {
		const player = await requirePlayer();
		if (!player.userId) return player.response;
		const admin = createSupabaseAdmin();
		const [stored, earned, bought] = await Promise.all([
			loadBadgeChoice(admin, player.userId),
			loadEarnedAchievements(admin, player.userId),
			loadNameColorsBought(admin, player.userId),
		]);
		return json({
			badgeId: stored.badgeId,
			titleId: stored.titleId,
			nameColor: shownNameColor(stored.nameColor, stored.admin),
			colorsUnlocked: stored.admin || bought,
			admin: stored.admin,
			earned,
		});
	} catch {
		return unavailable();
	}
}

/**
 * Changes the badge, the title and the nickname colour: `{ badgeId, titleId, nameColor }`, each `null` (or left out to keep it), or (badge) `"none"` to hide it. A badge or title that is not earned, a colour that is not unlocked (Gem shop, or `profiles.is_admin`)
 * and the gold nickname on a non-admin account are a 400 and nothing is written. A request that only sends `nameColor` leaves the badge and title untouched.
 */
export async function POST(request: Request) {
	try {
		const player = await requirePlayer(request);
		if (!player.userId) return player.response;
		const body = await readBody(request);
		if (!isRecord(body)) return fail('Pick a badge and a title.', 400);
		const admin = createSupabaseAdmin();
		const stored = await loadBadgeChoice(admin, player.userId);
		if ('nameColor' in body) {
			const unlocked = stored.admin || (await loadNameColorsBought(admin, player.userId));
			const color = checkNameColor(body.nameColor ?? null, { admin: stored.admin, unlocked });
			if (!color.ok) return fail(color.error, 400);
			await writeNameColor(admin, player.userId, color.nameColor);
			if (!('badgeId' in body) && !('titleId' in body)) return json({ ok: true, nameColor: color.nameColor });
		}
		const earned = await loadEarnedAchievements(admin, player.userId);
		// a field the request leaves out keeps what is stored (a badge pick must not fail on an old title, and the other way round)
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
