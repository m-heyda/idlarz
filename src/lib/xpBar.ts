import { MAX_LEVEL } from '@/config/character';
import { calculateParagon, xpToNextLevel } from '@/utils/game/character';
import { compact } from '../../packages/design-system/src/logic';

/** The XP bar of the Hero window: which track it shows, the XP inside the current level and the size of its step (a bar value and max), the XP still to go, its text, and what the next level is called. */
export interface XpBar {
	track: 'level' | 'paragon';
	into: number;
	max: number;
	remaining: number;
	label: string;
	/** "level up" or "paragon level": finishes "Time until ..." in the XP tooltip */
	next: string;
}

/**
 * The bar numbers and words for either track from the character level and the lifetime XP: levels 1 to 99 show the level (the same text the Hero window always had), level 100 shows the paragon level (docs/plan/paragon.md) with the XP inside it and its
 * step, and the paragon ceiling shows a full bar that says MAX. Pure: the Hero window, the level-up timer and the Overview all read it.
 *
 * @category Progression/Levels
 * @order 9
 */
export const xpBarOf = (level: { level: number; progress: number }, xp: number): XpBar => {
	if (level.level < MAX_LEVEL) {
		const max = xpToNextLevel(level.level);
		const into = Math.floor(level.progress * max);
		return {
			track: 'level',
			into,
			max,
			remaining: max - into,
			label: `Level ${level.level} · ${Math.floor(level.progress * 100)}% · ${compact(into)} / ${compact(max)}`,
			next: 'level up',
		};
	}
	const paragon = calculateParagon(xp);
	if (paragon.needed === 0) return { track: 'paragon', into: 1, max: 1, remaining: 0, label: `Paragon ${paragon.paragon} · MAX`, next: 'paragon level' };
	const into = Math.floor(paragon.into);
	return {
		track: 'paragon',
		into,
		max: paragon.needed,
		remaining: Math.max(0, paragon.needed - into),
		label: `Paragon ${paragon.paragon} · ${Math.floor(paragon.progress * 100)}% · ${compact(into)} / ${compact(paragon.needed)}`,
		next: 'paragon level',
	};
};
