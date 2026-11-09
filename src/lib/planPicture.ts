import type { FightPlan } from '@/lib/offline/fightTypes';

/**
 * The hero's HP and the monster's HP `elapsedSec` after the server's picture, read off the plan it sent (straight lines between the samples,
 * the last sample held once the fight is over). The browser draws this between answers, so a fight needs one poll, not one every 2 s.
 */
export const planPictureAt = (plan: FightPlan, elapsedSec: number): { hp: number; monsterHp: number } => {
	const rows = plan.samples;
	const t = Math.max(0, elapsedSec);
	let next = rows.findIndex((row) => row[0] > t);
	if (next === -1) return { hp: rows[rows.length - 1][1], monsterHp: rows[rows.length - 1][2] };
	if (next === 0) next = 1;
	const a = rows[next - 1];
	const b = rows[next];
	const k = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 1;
	return { hp: a[1] + (b[1] - a[1]) * k, monsterHp: a[2] + (b[2] - a[2]) * k };
};
