import type { AchievementDef, DeedDef } from './achievements';
import { createDeedBuilder, ROMAN } from './deedBuilder';

// The Paragon deed (docs/plan/paragon.md, project 3 of 3, IDL-394): one tier per paragon level goal. The tiers from paragon 100 up are the **milestones**: each also gives a title and one bonus paragon point once claimed
// (`paragonBonusPoints`), and the name frame follows the paragon level (`paragonFrame` in `config/paragon.ts`). Every id is new and appended after the earlier batches (never reordered).

const { out, deed } = createDeedBuilder();

/** The paragon levels of the tiers, ascending. Milestones are the ones from `PARAGON_MILESTONE_FROM` up (100, 200, 300, 400, 500, 750, 1,000). */
export const PARAGON_TIER_GOALS: readonly number[] = [1, 10, 25, 50, 100, 200, 300, 400, 500, 750, 1000];

/** The first paragon level that is a milestone: its tier gives a title and a bonus point */
export const PARAGON_MILESTONE_FROM = 100;

/** The title of each milestone tier, by paragon level */
const TITLES: Readonly<Record<number, { id: string; name: string }>> = {
	100: { id: 'paragon-100', name: 'Paragon' },
	200: { id: 'paragon-200', name: 'Exalted' },
	300: { id: 'paragon-300', name: 'Ascendant' },
	400: { id: 'paragon-400', name: 'Eternal' },
	500: { id: 'paragon-500', name: 'Immortal' },
	750: { id: 'paragon-750', name: 'Demigod' },
	1000: { id: 'paragon-1000', name: 'Celestial' },
};

/** Deed points of each tier: a little at the start, a lot at the top (the Hall of Deeds total is the score) */
const POINTS: Readonly<Record<number, number>> = { 1: 5, 10: 10, 25: 20, 50: 35, 100: 60, 200: 90, 300: 120, 400: 150, 500: 200, 750: 300, 1000: 500 };

deed(
	'paragon',
	'Paragon',
	'Climb the paragon levels past level 100.',
	'hero',
	['paragon', 'xp'],
	'star_silver',
	'Past the last level the road keeps going.',
	'Every paragon level is one more point to spend. From paragon 100 each tier is a milestone: a title, and one bonus paragon point once you claim it.',
	PARAGON_TIER_GOALS.map((min, i) => ({
		suffix: ROMAN[i],
		id: `paragon_${min}`,
		when: { kind: 'paragon' as const, min },
		text: `Reach paragon level ${min.toLocaleString('en-US')}.`,
		points: POINTS[min],
		...(TITLES[min] ? { title: TITLES[min] } : {}),
	})),
);

export const PARAGON_ACHIEVEMENTS: readonly AchievementDef[] = out.achievements;
export const PARAGON_DEEDS: readonly DeedDef[] = out.deeds;

/** The achievement ids of the milestone tiers (paragon 100 and up) */
export const PARAGON_MILESTONE_IDS: readonly string[] = PARAGON_TIER_GOALS.filter((min) => min >= PARAGON_MILESTONE_FROM).map((min) => `paragon_${min}`);
