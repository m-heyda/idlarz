import type { AchievementDef } from './achievements';
import { tierGems } from './deedRewards';

// Deeds batch 3 (IDL-321): longer ladders for the grind deeds, up to billions and trillions, appended to deeds that already shipped. Every id is new and the tiers are appended at the end of their deed (never reordered).
// Gems follow the tier position (`tierGems`); points are placeholders for the balance pass (IDL-310). The badge is the deed's own.

interface Step {
	/** Goal; the id is `<prefix>_<goal>` */
	min: number;
	points: number;
	/** A title this tier unlocks: id and the words shown next to the name */
	title?: { id: string; name: string };
}

/** The extension of one deed: which deed, how many tiers it has already (the next tier's position), the id prefix, the condition and its sentence, and the new steps. */
interface Ladder {
	deed: string;
	/** Tiers the deed had before this batch */
	from: number;
	prefix: string;
	/** Title of the achievement without the roman numeral ("Slayer") */
	name: string;
	when: (min: number) => AchievementDef['when'];
	text: (min: number) => string;
	steps: Step[];
}

const n = (value: number): string => value.toLocaleString('en-US');
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const LADDERS: Ladder[] = [
	{
		deed: 'slayer',
		from: 4,
		prefix: 'slayer',
		name: 'Slayer',
		when: (min) => ({ kind: 'kills', min }),
		text: (min) => `Defeat ${n(min)} monsters.`,
		steps: [
			{ min: 50_000, points: 150 },
			{ min: 250_000, points: 250 },
			{ min: 1_000_000, points: 400, title: { id: 'bane-of-beasts', name: 'Bane of Beasts' } },
			{ min: 5_000_000, points: 600 },
		],
	},
	{
		deed: 'hoarder',
		from: 3,
		prefix: 'hoarder',
		name: 'Hoarder',
		when: (min) => ({ kind: 'goldPeak', min }),
		text: (min) => `Hold ${n(min)} gold at once.`,
		steps: [
			{ min: 100_000_000, points: 80 },
			{ min: 1_000_000_000, points: 120 },
			{ min: 10_000_000_000, points: 180 },
			{ min: 100_000_000_000, points: 260 },
			{ min: 1_000_000_000_000, points: 400, title: { id: 'dragons-hoard', name: "Dragon's Hoard" } },
		],
	},
	{
		deed: 'market',
		from: 3,
		prefix: 'market',
		name: 'Market Day',
		when: (min) => ({ kind: 'unitsSold', min }),
		text: (min) => `Sell ${n(min)} resource units to the merchant.`,
		steps: [
			{ min: 1_000_000_000, points: 150 },
			{ min: 10_000_000_000, points: 250, title: { id: 'grand-merchant', name: 'Grand Merchant' } },
		],
	},
	{
		deed: 'smith',
		from: 3,
		prefix: 'smith',
		name: 'Apprentice Smith',
		when: (min) => ({ kind: 'crafted', min }),
		text: (min) => `Craft ${n(min)} items.`,
		steps: [
			{ min: 50_000, points: 150 },
			{ min: 250_000, points: 250, title: { id: 'grandmaster-smith', name: 'Grandmaster Smith' } },
		],
	},
	{
		deed: 'reborn',
		from: 3,
		prefix: 'reborn',
		name: 'Reborn',
		when: (min) => ({ kind: 'rebirths', min }),
		text: (min) => `Rebirth ${n(min)} times.`,
		steps: [
			{ min: 50, points: 100 },
			{ min: 100, points: 200, title: { id: 'eternal-phoenix', name: 'Eternal Phoenix' } },
		],
	},
	{
		deed: 'untouched',
		from: 3,
		prefix: 'untouched',
		name: 'Untouched',
		when: (min) => ({ kind: 'flawless', min }),
		text: (min) => `Win ${n(min)} fights without taking damage.`,
		steps: [
			{ min: 500, points: 100 },
			{ min: 2500, points: 150, title: { id: 'untouchable', name: 'The Untouchable' } },
		],
	},
	{
		deed: 'wolfsbane',
		from: 3,
		prefix: 'wolfsbane',
		name: 'Wolfsbane',
		when: (min) => ({ kind: 'kill', monster: 'mossbackWolf', min }),
		text: (min) => `Slay ${n(min)} Mossback Wolves.`,
		steps: [{ min: 5000, points: 80 }],
	},
	{
		deed: 'golden_touch',
		from: 1,
		prefix: 'golden',
		name: 'Golden touch',
		when: (min) => ({ kind: 'golden', min }),
		text: (min) => `Kill ${n(min)} golden monsters.`,
		steps: [
			{ min: 10, points: 20 },
			{ min: 50, points: 40 },
			{ min: 250, points: 80 },
			{ min: 1000, points: 150 },
			{ min: 5000, points: 300, title: { id: 'midas', name: 'Midas' } },
		],
	},
	{
		deed: 'bossbane',
		from: 3,
		prefix: 'boss_kills',
		name: 'Bossbane',
		when: (min) => ({ kind: 'bosses', min }),
		text: (min) => `Defeat ${n(min)} bosses.`,
		steps: [
			{ min: 250, points: 100 },
			{ min: 1000, points: 200 },
			{ min: 5000, points: 400, title: { id: 'worldbreaker', name: 'Worldbreaker' } },
		],
	},
];

/** The badge a deed already uses (the new tiers keep it) */
export const BATCH3_BADGES: Readonly<Record<string, string>> = {
	slayer: 'badge_skull_bronze',
	hoarder: 'badge_chest_bronze',
	market: 'badge_star_silver',
	smith: 'badge_hammer_bronze',
	reborn: 'badge_first_rebirth_fire',
	untouched: 'badge_shield_silver',
	wolfsbane: 'badge_sword_silver',
	golden_touch: 'badge_golden_monster_gold',
	bossbane: 'badge_great_auroch_boss',
};

/** The new tier achievements, in order. */
export const buildBatch3 = (): AchievementDef[] =>
	LADDERS.flatMap((l) =>
		l.steps.map(
			(s, i): AchievementDef => ({
				id: `${l.prefix}_${s.min}`,
				title: `${l.name} ${ROMAN[l.from + i]}`,
				description: l.text(s.min),
				when: l.when(s.min),
				badge: BATCH3_BADGES[l.deed],
				rewards: { gems: tierGems(l.from + i), points: s.points, ...(s.title ? { titleId: s.title.id, titleName: s.title.name } : {}) },
			}),
		),
	);

/** Deed id -> the ids of the tiers appended to it. */
export const BATCH3_TIERS: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
	LADDERS.map((l) => [l.deed, l.steps.map((s) => `${l.prefix}_${s.min}`)]),
);
