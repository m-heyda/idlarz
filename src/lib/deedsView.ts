import { DEEDS, achievementById, type DeedDef } from '@/catalog/achievements';
import { avatarById } from '@/catalog/avatars';
import { DEED_MILESTONES } from '@/catalog/deedMilestones';
import { claimableMilestones, conditionProgress, deedBonusText, milestoneStates, TOTAL_DEED_POINTS, type DeedFacts } from '@/lib/deeds';
import { emptyStats } from '@/lib/offline/stats';
import type { DeedTierVM, DeedVM, MilestoneVM } from '../../packages/design-system/src/views/deeds';

// What the Hall of Deeds window shows, built from the server's report (the achievement store). Pure: no store, no clock. The browser decides nothing; every state here is the server's, and the numbers
// towards a goal are the server's `progress`.

/** The report fields the window reads (the store's state). */
export interface DeedsInput {
	earned: readonly string[];
	claimed: readonly string[];
	earnedAt: Readonly<Record<string, number>>;
	claimedAt: Readonly<Record<string, number>>;
	milestonesClaimed: readonly string[];
	/** Deed id -> the player's number towards it (the server's) */
	progress: Readonly<Record<string, number>>;
	points: number;
}

/** The groups of the window, in order: id and label. */
export const DEED_CATEGORIES: readonly [string, string][] = [
	['combat', 'Combat'],
	['bestiary', 'Bestiary'],
	['realm', 'Realm'],
	['explorer', 'Explorer'],
	['economy', 'Economy'],
	['craft', 'Crafting'],
	['gear', 'Gear'],
	['hero', 'Hero'],
	['farm', 'Farm'],
	['rebirth', 'Rebirth'],
	['special', 'Special'],
	['fun', 'Secrets'],
];

/** A goal does not depend on the player: read it off a condition with empty facts. */
const NO_FACTS: DeedFacts = { stats: emptyStats(), castleLevel: 0, rebirths: 0, buildings: 0 };
const goalOf = (id: string): number => {
	const def = achievementById(id);
	return def ? conditionProgress(def.when, NO_FACTS).goal : 1;
};

const SECRET = '???';
/** The medal drawn as a silhouette for a deed without art yet */
const PLACEHOLDER_BADGE = 'badge_star_bronze';

const tierOf = (input: DeedsInput, id: string): DeedTierVM => {
	const def = achievementById(id)!;
	const isEarned = input.earned.includes(id);
	const isClaimed = isEarned && input.claimed.includes(id);
	const unlocks = [
		def.rewards.titleId && `Title: ${def.rewards.titleName ?? def.title}`,
		def.rewards.avatarId && `Avatar: ${avatarById(def.rewards.avatarId)?.name ?? 'new portrait'}`,
	].filter((u): u is string => !!u);
	return {
		id,
		goal: goalOf(id),
		gems: def.rewards.gems,
		points: def.rewards.points ?? 0,
		text: def.description,
		state: isClaimed ? 'claimed' : isEarned ? 'earned' : 'locked',
		unlocks,
	};
};

/** A deed as the window shows it. A secret deed with no tier earned yet is `???`, as the old list hid its locked achievements. */
export const deedViewOf = (deed: DeedDef, input: DeedsInput): DeedVM => {
	const tiers = deed.tiers.filter((id) => achievementById(id)).map((id) => tierOf(input, id));
	// a deed whose picture is only a stand-in shows the shared medal, as a silhouette (the window darkens it)
	const placeholder = !!achievementById(deed.tiers[0])?.badgePlaceholder;
	const hidden = deed.tags.includes('secret') && tiers.every((t) => t.state === 'locked');
	return {
		id: deed.id,
		name: hidden ? SECRET : deed.title,
		desc: hidden ? SECRET : deed.description,
		category: deed.category,
		tags: deed.tags,
		icon: `/pixel/achievements/${placeholder ? PLACEHOLDER_BADGE : deed.badge}.png`,
		placeholder,
		lore: hidden ? SECRET : deed.lore,
		how: hidden ? 'Find out.' : deed.how,
		cur: input.progress[deed.id] ?? 0,
		tiers: hidden ? tiers.map((t) => ({ ...t, text: SECRET, unlocks: [] })) : tiers,
	};
};

export const deedViewsOf = (input: DeedsInput): DeedVM[] => DEEDS.map((deed) => deedViewOf(deed, input));

const bonusOf = (m: (typeof DEED_MILESTONES)[number]): string => (m.bonus ? `+${m.bonus.pct}% kill ${m.bonus.stat === 'gold' ? 'gold' : 'XP'}` : 'no bonus');

export const milestoneViewsOf = (input: DeedsInput): MilestoneVM[] =>
	milestoneStates(input.points, input.milestonesClaimed).map(({ milestone, reached, claimed }) => ({
		id: milestone.id,
		points: milestone.points,
		gems: milestone.gems,
		bonus: bonusOf(milestone),
		state: claimed ? 'claimed' : reached ? 'ready' : 'locked',
	}));

/** Tiers and milestones waiting for Claim (what Claim all pays: the tiers first, then the milestones their points reach). */
export const waitingCount = (input: DeedsInput): number => {
	const waiting = input.earned.filter((id) => !input.claimed.includes(id) && !!achievementById(id));
	const pointsAfter = input.points + waiting.reduce((sum, id) => sum + (achievementById(id)?.rewards.points ?? 0), 0);
	return waiting.length + claimableMilestones(pointsAfter, input.milestonesClaimed).length;
};

export const bonusLine = (input: Pick<DeedsInput, 'milestonesClaimed'>): string => deedBonusText(input.milestonesClaimed);
export { TOTAL_DEED_POINTS };
