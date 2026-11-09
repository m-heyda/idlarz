import type { FightPlan } from '@/lib/offline/fightTypes';

/**
 * The hero's HP, the monster's HP and the hero's mana `elapsedSec` after the server's picture, read off the plan it sent (straight lines between
 * the samples, the last sample held once the fight is over). The browser draws this between answers, so a fight needs one poll, not one every 2 s.
 * `mp` is null for a plan without the mana column (an older server).
 */
export const planPictureAt = (plan: FightPlan, elapsedSec: number): { hp: number; monsterHp: number; mp: number | null } => {
	const rows = plan.samples;
	const t = Math.max(0, elapsedSec);
	let next = rows.findIndex((row) => row[0] > t);
	if (next === -1) {
		const last = rows[rows.length - 1];
		return { hp: last[1], monsterHp: last[2], mp: last[3] ?? null };
	}
	if (next === 0) next = 1;
	const a = rows[next - 1];
	const b = rows[next];
	const k = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 1;
	const mp = a[3] !== undefined && b[3] !== undefined ? a[3] + (b[3] - a[3]) * k : null;
	return { hp: a[1] + (b[1] - a[1]) * k, monsterHp: a[2] + (b[2] - a[2]) * k, mp };
};
