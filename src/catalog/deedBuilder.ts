import type { AchievementDef, DeedDef } from './achievements';
import { tierGems } from './deedRewards';

// The shared way to write a deed in code (batches 2 and 4): one call adds the deed and an ordinary achievement per tier. Gems follow the tier position (`tierGems`), the badge is a stand-in until the deed has art of its own.

export interface BuiltDeeds {
	achievements: AchievementDef[];
	deeds: DeedDef[];
}

export interface TierInput {
	/** Added to the deed's title for the tier ("I", "II", "Bronze") */
	suffix: string;
	id: string;
	when: AchievementDef['when'];
	text: string;
	points: number;
	/** A title this tier unlocks */
	title?: { id: string; name: string };
}

const badge = (name: string) => `badge_${name}`;

/** Starts a batch: `deed(...)` adds a deed and its tiers to `out`. */
export const createDeedBuilder = () => {
	const out: BuiltDeeds = { achievements: [], deeds: [] };
	const deed = (
		id: string,
		title: string,
		description: string,
		category: DeedDef['category'],
		tags: string[],
		art: string,
		lore: string,
		how: string,
		tiers: TierInput[],
	) => {
		out.deeds.push({ id, title, description, category, tags, badge: badge(art), lore, how, tiers: tiers.map((t) => t.id) });
		for (const [i, t] of tiers.entries())
			out.achievements.push({
				id: t.id,
				title: tiers.length > 1 ? `${title} ${t.suffix}` : title,
				description: t.text,
				when: t.when,
				badge: badge(art),
				badgePlaceholder: true,
				rewards: { gems: tierGems(i), points: t.points, ...(t.title ? { titleId: t.title.id, titleName: t.title.name } : {}) },
			});
	};
	return { out, deed };
};

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
