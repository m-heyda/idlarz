import type { UiPrefKey } from '@/lib/uiPrefs';

/** The map marks: chests, ores and monsters, and four kinds of monster and the strongest one(s). Each is a remembered view option (`UiPrefKey`), not game state. */
export type MarkPref = Extract<
	UiPrefKey,
	'markChests' | 'markOres' | 'markMonsters' | 'markBosses' | 'markGolden' | 'markGrown' | 'markGrowing' | 'markStrongest'
>;
export const MARK_PREFS: readonly MarkPref[] = [
	'markChests',
	'markOres',
	'markMonsters',
	'markBosses',
	'markGolden',
	'markGrown',
	'markGrowing',
	'markStrongest',
];

/** What the map rings: the three kinds of thing (it also picks the ring colour) */
export type MarkKind = 'chests' | 'ores' | 'monsters';
/** Which monsters of the kind `monsters` get a ring: all of them, or only the bosses, the golden ones, those at their growth limit, those still growing, or those at the highest level on the map */
export type MonsterFilter = 'all' | 'bosses' | 'golden' | 'grown' | 'growing' | 'strongest';

/** What each mark rings: its kind of thing and, for monsters, which of them */
export const MARK_TARGETS: Record<MarkPref, { kind: MarkKind; filter: MonsterFilter }> = {
	markChests: { kind: 'chests', filter: 'all' },
	markOres: { kind: 'ores', filter: 'all' },
	markMonsters: { kind: 'monsters', filter: 'all' },
	markBosses: { kind: 'monsters', filter: 'bosses' },
	markGolden: { kind: 'monsters', filter: 'golden' },
	markGrown: { kind: 'monsters', filter: 'grown' },
	markGrowing: { kind: 'monsters', filter: 'growing' },
	markStrongest: { kind: 'monsters', filter: 'strongest' },
};

/**
 * One map mark as the buttons draw it: the pref it switches, its names and hover text, and its picture. `size` is the picture's width in px so the three read as the same size; `shift` is the px that centre the artwork inside its picture
 * (measured from the opaque pixels: the rock sits low and to the left in its file). The small buttons under the minimap (`MapHighlightBar`) draw the first three marks; the Kingdom overview's "Find on the map" tiles draw all of them (`MARK_TILES`).
 */
export interface MarkButton {
	pref: MarkPref;
	/** The button's name (aria-label and tip title) */
	label: string;
	/** The short name on a Kingdom tile */
	card: string;
	icon: string;
	text: string;
	size: number;
	shift: [number, number];
}

export const MARK_BUTTONS: readonly MarkButton[] = [
	{
		pref: 'markChests',
		label: 'Highlight chests',
		card: 'Chests',
		icon: '/pixel/icons/bonus_chest.png',
		size: 20,
		shift: [0, 0],
		text: 'Rings the treasure chests on the map and points to the nearest one out of view.',
	},
	{
		pref: 'markOres',
		label: 'Highlight ores',
		card: 'Ore nodes',
		icon: '/pixel/rocks/rock_silver.png',
		size: 26,
		shift: [2, -1.5],
		text: 'Rings the rocks and ores you can mine and points to the nearest one out of view.',
	},
	{
		pref: 'markMonsters',
		label: 'Highlight monsters',
		card: 'Monsters',
		icon: '/pixel/items/junk/junk_claw.png',
		size: 22,
		shift: [0.5, 0.5],
		text: 'Rings the monsters on the map and points to the nearest one out of view.',
	},
];

/** The Kingdom overview's tiles after the three above: monsters of one kind, with the words for the tile and its hover text */
export const MONSTER_MARK_TILES: readonly { pref: MarkPref; label: string; card: string; text: string }[] = [
	{ pref: 'markBosses', label: 'Highlight bosses', card: 'Bosses', text: 'Rings only the bosses on the map and points to the nearest one out of view.' },
	{
		pref: 'markStrongest',
		label: 'Highlight the strongest',
		card: 'Strongest',
		text: 'Rings the monsters at the highest level on the map and points to the nearest one out of view.',
	},
	{
		pref: 'markGolden',
		label: 'Highlight golden monsters',
		card: 'Golden',
		text: 'Rings only the golden monsters on the map and points to the nearest one out of view.',
	},
	{
		pref: 'markGrown',
		label: 'Highlight fully grown monsters',
		card: 'Fully grown',
		text: 'Rings the monsters that have reached their growth limit and points to the nearest one out of view.',
	},
	{
		pref: 'markGrowing',
		label: 'Highlight monsters still growing',
		card: 'Still growing',
		text: 'Rings the monsters that are still gaining levels and points to the nearest one out of view.',
	},
];

/**
 * Pressing a map mark: the marks are one choice, so pressing one switches every other off and pressing the lit one switches it off. Returns the next state of all of them.
 *
 * @category Architecture/Map markers
 * @formula
 * next[pref] = !current[pref]        next[other] = false
 */
export const chooseMark = (current: Record<MarkPref, boolean>, pref: MarkPref): Record<MarkPref, boolean> => {
	const turnOn = !current[pref];
	return Object.fromEntries(MARK_PREFS.map((key) => [key, key === pref && turnOn])) as Record<MarkPref, boolean>;
};
