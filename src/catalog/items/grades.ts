import type { EquipmentRarity } from '@/types/game';
import { MAX_ITEM_LEVEL } from '../stats';

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
 * The grades whose items are enabled and so drop (IDL-220, IDL-224): the early game, G1-G3. G4 and up stay disabled data until the
 * biomes that hand them out exist. Enabling the next grade is adding it here; the loot pools select by the `grade:` tag, never by id.
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
