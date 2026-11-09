// Gear crafting maths, pure (IDL-241): the item level window, the rarity ceiling, the pity multiplier and the roll itself. The server (src/lib/offline/craft.ts) rolls with a sealed rng and the
// Crafting window shows the odds from the very same request, so the panel can never disagree with the roll.
import { RARITIES } from '@/catalog/rarity';
import { GRADE_INFO, gradeLevels } from '@/catalog/items/grades';
import { GEAR_UNLOCK, type CraftGrade, type GearTarget } from '@/catalog/recipes';
import { CRAFT_GEAR } from '@/config/crafting';
import { generateLoot, type LootRequest } from '@/lib/loot/generate';
import { LOOT_DATA, type LootData } from '@/lib/loot/data';
import type { Rng } from '@/lib/rng';
import type { ItemInstance } from '@/types/game';

/** The player's numbers a gear craft reads. `pity` is the grade's miss counter from `craft.pity`. */
export interface GearEnv {
	craftLevel: number;
	luck: number;
	intelligence: number;
	pity?: number;
}

const GRADES: readonly CraftGrade[] = Object.keys(GEAR_UNLOCK) as CraftGrade[];

/** The crafting level a grade stops climbing its window at: the next grade's unlock (G4 climbs until G5's, 35). */
const nextUnlockOf = (grade: CraftGrade): number => {
	const next = GRADES[GRADES.indexOf(grade) + 1];
	return next ? GEAR_UNLOCK[next] : CRAFT_GEAR.nextUnlock;
};

/**
 * The item level a recipe of this grade makes, by crafting level: the grade's window (`gradeLevels`) is climbed from its bottom at the grade's unlock to its top at the next grade's unlock, and the roll is +-1 around that centre, never outside the window.
 *
 * @category Progression/Crafting
 * @order 3
 * @formula
 * centre = round(window low + (window high - window low) x clamp((crafting level - unlock) / (next unlock - unlock), 0, 1))
 * item level = centre - 1 .. centre + 1, held inside the grade's window
 */
export const gearItemLevels = (grade: CraftGrade, craftLevel: number): { min: number; max: number; windowMin: number; windowMax: number } => {
	const [lo, hi] = gradeLevels(grade);
	const unlock = GEAR_UNLOCK[grade];
	const progress = Math.min(1, Math.max(0, (craftLevel - unlock) / Math.max(1, nextUnlockOf(grade) - unlock)));
	const centre = Math.round(lo + (hi - lo) * progress);
	return { min: Math.max(lo, centre - 1), max: Math.min(hi, centre + 1), windowMin: lo, windowMax: hi };
};

/** The best rarity a craft can roll at this crafting level (`CRAFT_GEAR.rarityCeiling`): rare, then epic from level 50; never legendary. */
export const rarityCeilingAt = (craftLevel: number): string =>
	[...CRAFT_GEAR.rarityCeiling].reverse().find((step) => craftLevel >= step.from)?.rarity ?? CRAFT_GEAR.rarityCeiling[0].rarity;

/**
 * Intelligence's lean on the quality and the affix magnitudes of a craft, for `rollLeaning`.
 *
 * @category Progression/Crafting
 * @order 4
 * @formula
 * bias = min(1, 0.01 x (Intelligence - 5)), 0 at 5 or less
 */
export const qualityBiasOf = (intelligence: number): number =>
	Number.isFinite(intelligence) ? Math.min(CRAFT_GEAR.qualityBiasCap, Math.max(0, (intelligence - CRAFT_GEAR.baseIntelligence) * CRAFT_GEAR.qualityPerInt)) : 0;

/** The rarity the pity counter of a grade chases: the best one the grade carries under the ceiling that the craft profile weights. Undefined when the grade can only roll one rarity. */
export const pityRarityOf = (grade: CraftGrade, craftLevel: number, data: LootData = LOOT_DATA): string | undefined => {
	const profile = data.profiles.craft;
	const ceiling = data.rarities[rarityCeilingAt(craftLevel)];
	const rolls = GRADE_INFO[grade].rarities
		.filter((id) => (profile.rarityWeights[id] ?? 0) > 0 && data.rarities[id] && data.rarities[id].order <= ceiling.order)
		.sort((a, b) => data.rarities[a].order - data.rarities[b].order);
	return rolls.length > 1 ? rolls[rolls.length - 1] : undefined;
};

/**
 * The pity multiplier on the grade's best rarity after `misses` crafts that missed it.
 *
 * @category Progression/Crafting
 * @order 5
 * @formula
 * multiplier = min(1.5, 1 + 0.05 x misses)        a hit resets the counter; a grade with one rarity has none
 */
export const pityMultiplier = (misses: number): number => Math.min(CRAFT_GEAR.pity.maxMultiplier, 1 + CRAFT_GEAR.pity.perMiss * Math.max(0, misses));

/** The loot request of one craft of `target`: the same object the roll and the odds panel use. */
export const gearRequest = (target: GearTarget, env: GearEnv, data: LootData = LOOT_DATA): LootRequest => {
	const levels = gearItemLevels(target.grade as CraftGrade, env.craftLevel);
	const chase = pityRarityOf(target.grade as CraftGrade, env.craftLevel, data);
	return {
		sourceId: 'craft',
		level: Math.round((levels.min + levels.max) / 2),
		minItemLevel: levels.min,
		maxItemLevel: levels.max,
		slot: target.slot === 'ring' ? 'ring' : target.slot,
		luck: env.luck,
		maxRarity: rarityCeilingAt(env.craftLevel),
		qualityBias: qualityBiasOf(env.intelligence),
		...(chase && env.pity ? { rarityBoost: { rarity: chase, multiplier: pityMultiplier(env.pity) } } : {}),
	};
};

export interface GearRoll {
	item: ItemInstance;
	/** The grade's miss counter after this craft (0 after a hit or for a grade with one rarity) */
	pity: number;
}

/**
 * One crafted piece: the `craft` loot source rolls rarity (Luck, pity, ceiling), base, quality and affixes (Intelligence) for the recipe's slot inside the grade's item level window, and the piece is marked `crafted`. Null when nothing is eligible (a
 * configuration error, never silently replaced).
 *
 * The roll of one gear craft. The server calls it once per delivered piece with `sealedRng(secret, user, 0, 'craft', craft.ord + n)`: the lifetime counter, not the run's, so a rebirth never repeats a sequence and a replayed claim rolls the same pieces.
 * Rarity: the `craft` profile's weights among the grade's rarities, Luck on rare and better, the pity multiplier on the grade's best rarity, the crafting level's ceiling. Item level: {@link gearItemLevels}. Quality and affix magnitudes: {@link qualityBiasOf}.
 *
 * @category Progression/Crafting
 * @order 6
 * @see gearOdds, CRAFT_GEAR
 */
export const rollGear = (target: GearTarget, env: GearEnv, rng: Rng, data: LootData = LOOT_DATA): GearRoll | null => {
	const result = generateLoot(gearRequest(target, env, data), rng, data);
	const drop = result.drops.find((d) => d.kind === 'gear');
	if (!drop || drop.kind !== 'gear') return null;
	const chase = pityRarityOf(target.grade as CraftGrade, env.craftLevel, data);
	const pity = chase && drop.item.rarity !== chase ? (env.pity ?? 0) + 1 : 0;
	return { item: { ...drop.item, crafted: true }, pity };
};

export interface GearOdds {
	/** The item level range a craft rolls in now */
	itemLevel: { min: number; max: number };
	/** Rarity chances (0-1) at this Luck, pity and crafting level, worst rarity first */
	rarities: { id: string; chance: number }[];
	/** The pity multiplier in effect on the best rarity (1: none) */
	pityMultiplier: number;
	/** The quality bias Intelligence gives (0-1) */
	qualityBias: number;
}

/**
 * What the Crafting window's odds panel shows for a recipe: the rarity chances at the player's Luck, pity and crafting level, the item level range, the pity multiplier and the quality lean. Read from the roll's own loot trace (`generateLoot` with a fixed rng), so the panel is the real odds and cannot drift from the roll.
 *
 * @category Progression/Crafting
 * @order 7
 */
export const gearOdds = (target: GearTarget, env: GearEnv, data: LootData = LOOT_DATA): GearOdds => {
	const request = gearRequest(target, env, data);
	const trace = generateLoot(request, () => 0.5, data).trace[0];
	const rarities = Object.entries(trace?.rarityChances ?? {})
		.map(([id, chance]) => ({ id, chance }))
		.sort((a, b) => (RARITIES[a.id as keyof typeof RARITIES]?.order ?? 0) - (RARITIES[b.id as keyof typeof RARITIES]?.order ?? 0));
	return {
		itemLevel: { min: request.minItemLevel ?? 1, max: request.maxItemLevel ?? 1 },
		rarities,
		pityMultiplier: request.rarityBoost?.multiplier ?? 1,
		qualityBias: request.qualityBias ?? 0,
	};
};
