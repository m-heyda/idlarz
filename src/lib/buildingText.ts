import { BIOMES } from '@/config/biomes';
import { BUILDING_RULES } from '@/config/buildings';
import { RESOURCES } from '@/catalog/resources';
import type { BuildingDef } from '@/catalog/buildings';
import { buildingOutput, producerBonus } from '@/lib/buildingOutput';
import type { Resources } from '@/types/game';
import { formatNumber } from '@/utils/formatters';

/** The plain-language lines of a Producer or Extractor card in the Build window; every number comes from `BUILDING_RULES` and the output formulas (`lib/buildingOutput.ts`). */
export interface BuildingEffectText {
	/** What it makes now: "Produces +1.2K wood and +800 gold per hour." */
	produces: string;
	/** What each level above 1 adds: "Each level adds +600 wood and +400 gold per hour." */
	perLevel: string;
	/** What the tile count means: how the output is worked out and how the biome's size grows it */
	scale: string;
	/** That levels exist, where they are bought and what they improve */
	levels: string;
}

const HOUR = 3600;

const label = (key: keyof Resources) => RESOURCES[key]?.label.toLowerCase() ?? key;

/** "+12 wood and +3 gold" / "+12 wood, +3 gold and +1 coal": the amounts per hour */
const perHour = (amounts: Partial<Resources>): string => {
	const parts = Object.entries(amounts)
		.filter(([, amount]) => (amount ?? 0) > 0)
		.map(([key, amount]) => `+${formatNumber((amount ?? 0) * HOUR)} ${label(key as keyof Resources)}`);
	return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : (parts[0] ?? '');
};

/**
 * The effect text of a Producer or Extractor (an Idol has its own, `IdolInfo`), for a player owning `ownedOfBiome` tiles of the building's biome. Amounts are per hour, before the global modifiers (castle, Embers, ...); a level adds the
 * same fixed step to the level 1 output, so "per level" is one number. Returns null for an Idol.
 */
export const buildingEffectText = (def: BuildingDef, ownedOfBiome: number): BuildingEffectText | null => {
	if (def.kind === 'idol') return null;
	const first = buildingOutput(def, 1, ownedOfBiome);
	const second = buildingOutput(def, 2, ownedOfBiome);
	const step: Partial<Resources> = {};
	for (const key of Object.keys(first) as (keyof Resources)[]) step[key] = (second[key] ?? 0) - (first[key] ?? 0);
	const biome = (BIOMES[def.biome]?.label ?? def.biome).toLowerCase();
	const { perOwnedTile, bonusCap } = BUILDING_RULES.producer;
	const grow = `Every ${biome} tile you own adds +${Math.round(perOwnedTile * 100)} % (up to +${Math.round(bonusCap * 100)} %), now +${Math.round(producerBonus(ownedOfBiome) * 100)} %.`;
	return {
		produces: `Produces ${perHour(first)} per hour.`,
		perLevel: `Each level adds ${perHour(step)} per hour.`,
		scale:
			def.kind === 'producer'
				? `Its output equals ${BUILDING_RULES.producer.tileEquivalents} ${biome} tiles working at once. ${grow}`
				: `Works on its own, ${formatNumber(BUILDING_RULES.extractor.baseRate)} per second at level 1. ${grow}`,
		levels: `Levels 1 to ${BUILDING_RULES.maxLevel}: upgrade it from its tile menu (each level needs the castle at that level, resources and build time).`,
	};
};
