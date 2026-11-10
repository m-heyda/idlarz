import { BIOMES } from '@/config/biomes';
import { BIOME_YIELD } from '@/config/economy';
import { BUILDING_RULES } from '@/config/buildings';
import type { BuildingDef } from '@/catalog/buildings';
import type { Resources } from '@/types/game';

/** The Producer's bonus from the size of its biome, as a fraction (0.5 = +50 %): `perOwnedTile` per owned tile of that biome, capped. */
export const producerBonus = (ownedOfBiome: number): number =>
	Math.min(BUILDING_RULES.producer.bonusCap, Math.max(0, Math.floor(ownedOfBiome)) * BUILDING_RULES.producer.perOwnedTile);

/**
 * What a Producer of level `level` makes per second, before the global modifiers (castle, Embers, ...): its `produces` resources at the biome's tile rate.
 *
 * @category Economy/Buildings
 * @order 4
 * @formula
 * output[r] = tileEquivalents x biome tile rate[r] x BIOME_YIELD.scale x (1 + levelStep x (level - 1)) x (1 + min(bonusCap, perOwnedTile x owned tiles of the biome))
 * @see BUILDING_RULES, producerBonus
 */
export const producerOutput = (def: BuildingDef, level: number, ownedOfBiome: number): Partial<Resources> => {
	const { tileEquivalents, levelStep } = BUILDING_RULES.producer;
	const levelMult = 1 + levelStep * (Math.max(1, level) - 1);
	const sizeMult = 1 + producerBonus(ownedOfBiome);
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
 * output = baseRate x (1 + levelStep x (level - 1)) x (1 + min(bonusCap, perOwnedTile x owned tiles of the biome))
 * @see BUILDING_RULES, producerBonus
 */
export const extractorOutput = (def: BuildingDef, level: number, ownedOfBiome: number): Partial<Resources> => {
	const { baseRate, levelStep } = BUILDING_RULES.extractor;
	const amount = baseRate * (1 + levelStep * (Math.max(1, level) - 1)) * (1 + producerBonus(ownedOfBiome));
	return Object.fromEntries(def.produces.map((key) => [key, amount])) as Partial<Resources>;
};

/** What a building makes per second before the global modifiers: {@link producerOutput} or {@link extractorOutput} by its kind. */
export const buildingOutput = (def: BuildingDef, level: number, ownedOfBiome: number): Partial<Resources> =>
	def.kind === 'extractor' ? extractorOutput(def, level, ownedOfBiome) : producerOutput(def, level, ownedOfBiome);
