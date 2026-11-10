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
