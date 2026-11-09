import type { EquipmentRarity } from '@/types/game';
import { MAX_ITEM_LEVEL } from '../stats';
import { RARITY_ORDER } from '../rarity';

// The grade ladder's grades and what each one is (split out of ladder.ts so reuse.ts can read the windows without an import cycle).

export const GRADES = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'S1', 'S2', 'S3'] as const;
export type Grade = (typeof GRADES)[number];

interface GradeInfo {
	/** Name of the grade in the planning doc */
	label: string;
	/** Relative planning strength (not a stat): 1.0 for G1 up to 32 for the strongest set */
	index: number;
	/** The item level window the grade can be generated in */
	levels: readonly [number, number];
	/** The material tier (1-5) the grade belongs to, for the code that still reads `tier` */
	tier: 1 | 2 | 3 | 4 | 5;
	/** Rarities a base of this grade may roll as */
	rarities: readonly EquipmentRarity[];
}

export const GRADE_INFO: Record<Grade, GradeInfo> = {
	G1: { label: 'Starter', index: 1, levels: [1, 8], tier: 1, rarities: ['common'] },
	G2: { label: 'Hide', index: 1.6, levels: [9, 18], tier: 1, rarities: ['common', 'uncommon'] },
	G3: { label: 'Iron', index: 2.4, levels: [19, 30], tier: 2, rarities: ['uncommon'] },
	G4: { label: 'Steel', index: 3.5, levels: [31, 42], tier: 2, rarities: ['uncommon', 'rare'] },
	G5: { label: 'Knight', index: 5, levels: [43, 54], tier: 3, rarities: ['rare'] },
	G6: { label: 'Obsidian', index: 7, levels: [55, 66], tier: 3, rarities: ['rare', 'epic'] },
	G7: { label: 'Runed', index: 10, levels: [67, 78], tier: 4, rarities: ['epic'] },
	G8: { label: 'Ancient', index: 14, levels: [79, 90], tier: 4, rarities: ['epic', 'legendary'] },
	G9: { label: 'Legendary', index: 20, levels: [91, MAX_ITEM_LEVEL], tier: 5, rarities: ['legendary'] },
	S1: { label: 'Sunhoney', index: 22, levels: [MAX_ITEM_LEVEL, MAX_ITEM_LEVEL], tier: 5, rarities: ['legendary'] },
	S2: { label: 'Ashen Warlord', index: 28, levels: [MAX_ITEM_LEVEL, MAX_ITEM_LEVEL], tier: 5, rarities: ['legendary'] },
	S3: { label: 'Blightbound', index: 32, levels: [MAX_ITEM_LEVEL, MAX_ITEM_LEVEL], tier: 5, rarities: ['legendary'] },
};

/**
 * The grades whose items are enabled and so drop (IDL-220, IDL-224, IDL-243): the early game, G1-G3. G4 and up (the legacy Steel armour at G4 and
 * the Obsidian family at G6 included) stay disabled data until the
 * biomes that hand them out exist. Enabling the next grade is adding it here; the loot pools select by the `grade:` tag, never by id.
 *
 * The grade ladder: G1-G9 plus the special sets S1-S3, each with an item level window, rarities and tier (`GRADE_INFO`). Only the grades listed here have enabled items and so drop: today G1-G3.
 * Enabling the next grade is adding it here; the loot pools select by the `grade:` tag, never by id. The legacy Steel armour (G4) and the Obsidian family (G6) are on the ladder but stay dark until their grades are live.
 *
 * @category Loot/Items
 * @order 5
 * @see gradeLevels, gradeRarities, gradeLegacyItems
 */
export const LIVE_GRADES: readonly Grade[] = ['G1', 'G2', 'G3'];

/** The grade an item belongs to, read from its `grade:G3` tag (undefined for the pieces outside the ladder) */
export const gradeOfItem = (item: { tags?: readonly string[] }): Grade | undefined => {
	const tag = item.tags?.find((t) => t.startsWith('grade:'));
	const grade = tag?.slice('grade:'.length);
	return GRADES.find((g) => g === grade);
};

/** Whether an item is at most `maxGrade`; an item outside the ladder has no grade and passes. */
export const gradeAllowed = (item: { tags?: readonly string[] }, maxGrade: Grade): boolean => {
	const grade = gradeOfItem(item);
	return !grade || GRADES.indexOf(grade) <= GRADES.indexOf(maxGrade);
};

/** The highest grade that is live: while the next one is dark, nothing may be left without an item above it (see `gradeLevels`) */
const topLive = (): Grade => LIVE_GRADES.reduce((top, g) => (GRADES.indexOf(g) > GRADES.indexOf(top) ? g : top), LIVE_GRADES[0]);

/**
 * The item level window an item of this grade is generated in. It is the grade's own window (`GRADE_INFO`), except for the highest
 * live grade, which stays open at the top until the next grade goes live: bosses (levels 15-45), chests and the shelf reach item
 * levels past G3's 30 today, and with the legacy Steel and Obsidian gone from the pool they would have nothing to drop (IDL-243).
 * Enabling the next grade (adding it to `LIVE_GRADES`) closes the window of the one below by itself.
 *
 * The highest live grade is open at the top, so adding the next grade to `LIVE_GRADES` closes it by itself.
 *
 * @category Loot/Items
 * @order 6
 */
export const gradeLevels = (grade: Grade): readonly [number, number] => {
	const [min, max] = GRADE_INFO[grade].levels;
	return grade === topLive() ? [min, MAX_ITEM_LEVEL] : [min, max];
};

/**
 * The rarities an item of this grade may roll as: the grade's own (`GRADE_INFO`), except for the highest live grade, which takes every
 * rarity until a grade that carries the others is live (today the loot profiles roll common to legendary at item levels 19 and up, and a
 * rolled rarity must find a base). Enabling the next grade narrows the one below to its own rarities by itself.
 *
 * The highest live grade takes every rarity until a grade that carries the others is live.
 *
 * @category Loot/Items
 * @order 7
 */
export const gradeRarities = (grade: Grade): readonly EquipmentRarity[] => (grade === topLive() ? RARITY_ORDER : GRADE_INFO[grade].rarities);
