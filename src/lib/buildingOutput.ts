import { BIOMES, REBIRTH_BIOME_OUTPUT } from '@/config/biomes';
import { BIOME_YIELD } from '@/config/economy';
import { BIOME_MILESTONES, BUILDING_RULES } from '@/config/buildings';
import type { BuildingDef } from '@/catalog/buildings';
import type { Resources } from '@/types/game';

/** The Producer's bonus from the size of its biome, as a fraction (0.5 = +50 %): `perOwnedTile` per owned tile of that biome, capped. */
export const producerBonus = (ownedOfBiome: number): number =>
	Math.min(BUILDING_RULES.producer.bonusCap, Math.max(0, Math.floor(ownedOfBiome)) * BUILDING_RULES.producer.perOwnedTile);

/** The owned-tile counts at which a biome's Producer and Extractor get a milestone step (`BIOME_MILESTONES`): none for hills, lake and coast. */
export const milestoneThresholds = (biome: string): readonly number[] =>
	BIOME_MILESTONES.home[biome] ?? (REBIRTH_BIOME_OUTPUT[biome] ? BIOME_MILESTONES.rebirth : []);

/** The milestone steps of a biome reached with `ownedOfBiome` tiles (0 to 3). */
export const milestoneSteps = (biome: string, ownedOfBiome: number): number =>
	milestoneThresholds(biome).filter((threshold) => ownedOfBiome >= threshold).length;

/** The milestone share of the size bonus, as a fraction (0.25 = +25 %): `BIOME_MILESTONES.step` per step reached. */
export const milestoneBonus = (biome: string, ownedOfBiome: number): number => milestoneSteps(biome, ownedOfBiome) * BIOME_MILESTONES.step;

/** The whole size bonus of a Producer or Extractor of `biome`: the per-tile bonus plus the milestones. `withMilestones` false leaves the milestones out (the income panel lists them as their own line). */
export const biomeBonus = (biome: string, ownedOfBiome: number, withMilestones = true): number =>
	producerBonus(ownedOfBiome) + (withMilestones ? milestoneBonus(biome, ownedOfBiome) : 0);

/**
 * What a Producer of level `level` makes per second, before the global modifiers (castle, Embers, ...): its `produces` resources at the biome's tile rate.
 *
 * @category Economy/Buildings
 * @order 4
 * @formula
 * output[r] = tileEquivalents x biome tile rate[r] x BIOME_YIELD.scale x (1 + levelStep x (level - 1)) x (1 + min(bonusCap, perOwnedTile x owned tiles of the biome) + milestones)
 * @see BUILDING_RULES, producerBonus, milestoneBonus
 */
export const producerOutput = (def: BuildingDef, level: number, ownedOfBiome: number, withMilestones = true): Partial<Resources> => {
	const { tileEquivalents, levelStep } = BUILDING_RULES.producer;
	const levelMult = 1 + levelStep * (Math.max(1, level) - 1);
	const sizeMult = 1 + biomeBonus(def.biome, ownedOfBiome, withMilestones);
	const rates = (BIOMES[def.biome]?.resourceGeneration ?? {}) as Record<string, number>;
	const out: Partial<Resources> = {};
	for (const key of def.produces) {
		const rate = rates[key];
		if (rate) out[key] = tileEquivalents * rate * BIOME_YIELD.scale * levelMult * sizeMult;
	}
	return out;
};

/**
 * What an Extractor of level `level` makes per second, before the global modifiers: its T3 material at `extractor.baseRate`, grown by level and by the size of its biome.
 *
 * @category Economy/Buildings
 * @order 5
 * @formula
 * output = baseRate x (1 + levelStep x (level - 1)) x (1 + min(bonusCap, perOwnedTile x owned tiles of the biome) + milestones)
 * @see BUILDING_RULES, producerBonus, milestoneBonus
 */
export const extractorOutput = (def: BuildingDef, level: number, ownedOfBiome: number, withMilestones = true): Partial<Resources> => {
	const { baseRate, levelStep } = BUILDING_RULES.extractor;
	const amount = baseRate * (1 + levelStep * (Math.max(1, level) - 1)) * (1 + biomeBonus(def.biome, ownedOfBiome, withMilestones));
	return Object.fromEntries(def.produces.map((key) => [key, amount])) as Partial<Resources>;
};

/** What a building makes per second before the global modifiers: {@link producerOutput} or {@link extractorOutput} by its kind. */
export const buildingOutput = (def: BuildingDef, level: number, ownedOfBiome: number, withMilestones = true): Partial<Resources> =>
	def.kind === 'extractor' ? extractorOutput(def, level, ownedOfBiome, withMilestones) : producerOutput(def, level, ownedOfBiome, withMilestones);
