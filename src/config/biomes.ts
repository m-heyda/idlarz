// The map: tile size, biome list and spawn weights, and the ambient critters.
// Part of the former gameConfig.ts (split in IDL-15); the values are unchanged.
import { BiomeInfo, BiomeType } from '@/types/game';
import { BIOME_COLORS } from '@/config/biomePalette';
import { RESOURCE_ICONS } from './resources';
import { CASTLE_BASE_RATES } from './castle';

export const TILE_SIZE = 48; // Balanced for visibility

export const SPECIAL_SINGLE_TYPE_BIOMES: BiomeType[] = ['castle'];
export const EMPTY_BIOMES: BiomeType[] = ['empty'];

/**
 * Which biome a random purchase turns up. Everything weighs 1 unless listed; water clusters and gets a shore:
 * next to a lake or a coast both become likelier, so ponds grow into bays with beaches instead of single specks.
 */
export const BIOME_SPAWN = {
	weights: { coast: 0.6 } as Record<string, number>,
	nearLake: { lake: 3, coast: 3 } as Record<string, number>,
	nearCoast: { lake: 2, coast: 2 } as Record<string, number>,
};

/**
 * Output of the five rebirth biomes (unlocked one per rebirth, `BIOME_RULES.unlockAfterRebirths`): a **flat multiple of a basic tile's output**, existing resources only. `base` is the
 * output of the basic tile it is measured against (per second, before `BIOME_YIELD.scale`); `multiplier` rises with the rebirth that unlocks it, from x1.5 (jungle) to x2
 * (battlefield). No new resource types: T2 materials, monsters and buildings for these biomes come after the release. Pinned by tests/economy/rebirthBiomes.test.ts.
 *
 * @category Economy/Biomes
 * @order 3
 * @table rebirth-biome-output
 */
export const REBIRTH_BIOME_OUTPUT: Record<string, { rebirth: number; multiplier: number; base: Record<string, number>; measuredAgainst: string }> = {
	jungle: { rebirth: 1, multiplier: 1.5, base: { gold: 0.1, wood: 0.3 }, measuredAgainst: 'forest' },
	fields: { rebirth: 2, multiplier: 1.6, base: { gold: 0.1, food: 0.3 }, measuredAgainst: 'plains' },
	orchard: { rebirth: 3, multiplier: 1.75, base: { gold: 0.1, food: 0.2, wood: 0.1 }, measuredAgainst: 'a plains and forest mix' },
	blight: { rebirth: 4, multiplier: 1.9, base: { gold: 0.1, coal: 0.35 }, measuredAgainst: 'tundra' },
	battlefield: { rebirth: 5, multiplier: 2, base: { stone: 0.3, wood: 0.2 }, measuredAgainst: 'hills (stone) and swamp (wood)' },
};

/** The per-second output of a rebirth biome tile: its `base` times its `multiplier`, rounded to four places. */
function rebirthBiomeOutput(biome: string): Record<string, number> {
	const { base, multiplier } = REBIRTH_BIOME_OUTPUT[biome];
	return Object.fromEntries(Object.entries(base).map(([resource, rate]) => [resource, Math.round(rate * multiplier * 1e4) / 1e4]));
}

/**
 * Every biome with its config output per second. Multiply by `BIOME_YIELD.scale` (1.3) for what a tile really makes; the castle is not scaled.
 *
 * @category Economy/Biomes
 * @order 2
 * @table biome-output
 */
export const BIOMES: Record<string, BiomeInfo> = {
	empty: {
		name: 'empty',
		label: 'Empty',
		baseColor: BIOME_COLORS.empty,
		unique: true,
		upgradeable: false,
		resourceGeneration: {},
		resourceIcons: [RESOURCE_ICONS.coal],
		description: 'Empty land, waiting to be claimed',
	},
	castle: {
		name: 'castle',
		label: 'Castle',
		baseColor: BIOME_COLORS.castle,
		unique: true,
		upgradeable: true,
		resourceGeneration: Object.fromEntries(Object.entries(CASTLE_BASE_RATES).filter(([, rate]) => rate > 0)),
		resourceIcons: [RESOURCE_ICONS.gold, RESOURCE_ICONS.xp],
		description: 'Your castle generates resources over time',
	},
	forest: {
		name: 'forest',
		label: 'Forest',
		baseColor: BIOME_COLORS.forest,
		unique: false,
		upgradeable: false,
		resourceGeneration: {
			gold: 0.1,
			wood: 0.3,
		},
		resourceIcons: [RESOURCE_ICONS.wood],
		description: 'Forests provide wood and gold',
	},
	plains: {
		name: 'plains',
		label: 'Plains',
		baseColor: BIOME_COLORS.plains,
		unique: false,
		upgradeable: false,
		resourceGeneration: {
			gold: 0.1,
			food: 0.3,
		},
		resourceIcons: [RESOURCE_ICONS.food],
		description: 'Plains provide food and gold',
	},
	hills: {
		name: 'hills',
		label: 'Hills',
		baseColor: BIOME_COLORS.hills,
		unique: false,
		upgradeable: false,
		resourceGeneration: {
			gold: 0.05,
			stone: 0.3,
			coal: 0.2,
		},
		resourceIcons: [RESOURCE_ICONS.stone, RESOURCE_ICONS.coal],
		description: 'Hills provide stone and coal',
	},
	swamp: {
		name: 'swamp',
		label: 'Swamp',
		baseColor: BIOME_COLORS.swamp,
		unique: false,
		upgradeable: false,
		resourceGeneration: {
			food: 0.1,
			wood: 0.2,
		},
		resourceIcons: [RESOURCE_ICONS.food, RESOURCE_ICONS.wood],
		description: 'Swamps provide food and wood',
	},
	tundra: {
		name: 'tundra',
		label: 'Tundra',
		baseColor: BIOME_COLORS.tundra,
		unique: false,
		upgradeable: false,
		resourceGeneration: {
			gold: 0.1,
			coal: 0.35,
		},
		resourceIcons: [RESOURCE_ICONS.gold, RESOURCE_ICONS.coal],
		description: 'Tundras provide gold and coal',
	},
	lake: {
		name: 'lake',
		label: 'Lake',
		baseColor: BIOME_COLORS.lake,
		unique: false,
		upgradeable: false,
		resourceGeneration: {
			gold: 0.05,
			food: 0.25,
		},
		resourceIcons: [RESOURCE_ICONS.gold, RESOURCE_ICONS.food],
		description: 'Lakes provide gold and food',
	},
	coast: {
		name: 'coast',
		label: 'Coast',
		baseColor: BIOME_COLORS.coast,
		unique: false,
		upgradeable: false,
		resourceGeneration: {
			gold: 0.1,
			food: 0.2,
		},
		resourceIcons: [RESOURCE_ICONS.gold, RESOURCE_ICONS.food],
		description: 'Sandy shores provide gold and food, and border the water',
	},
	// The five rebirth biomes (docs/plan/12-rebirth-biomes.md), one per rebirth (BIOME_RULES.unlockAfterRebirths). MVP output: existing resources only, a flat
	// multiple of a basic tile's output (REBIRTH_BIOME_OUTPUT); the T2 materials, monsters and buildings of these biomes come after the new chapter ships.
	jungle: {
		name: 'jungle',
		label: 'Jungle',
		baseColor: BIOME_COLORS.jungle,
		unique: false,
		upgradeable: false,
		resourceGeneration: rebirthBiomeOutput('jungle'),
		resourceIcons: [RESOURCE_ICONS.wood],
		description: 'A river-cut rainforest: wood and gold, half as much again as a forest',
	},
	fields: {
		name: 'fields',
		label: 'Fields',
		baseColor: BIOME_COLORS.fields,
		unique: false,
		upgradeable: false,
		resourceGeneration: rebirthBiomeOutput('fields'),
		resourceIcons: [RESOURCE_ICONS.food],
		description: 'A patchwork of farm plots: food and gold, well above plains',
	},
	orchard: {
		name: 'orchard',
		label: 'Blossom Orchard',
		baseColor: BIOME_COLORS.orchard,
		unique: false,
		upgradeable: false,
		resourceGeneration: rebirthBiomeOutput('orchard'),
		resourceIcons: [RESOURCE_ICONS.food, RESOURCE_ICONS.wood],
		description: 'Blossom trees and beehives: food, wood and gold',
	},
	blight: {
		name: 'blight',
		label: 'Blight',
		baseColor: BIOME_COLORS.blight,
		unique: false,
		upgradeable: false,
		resourceGeneration: rebirthBiomeOutput('blight'),
		resourceIcons: [RESOURCE_ICONS.coal],
		description: 'A violet spore wasteland: nearly twice the coal of a tundra',
	},
	battlefield: {
		name: 'battlefield',
		label: 'Battlefield',
		baseColor: BIOME_COLORS.battlefield,
		unique: false,
		upgradeable: false,
		resourceGeneration: rebirthBiomeOutput('battlefield'),
		resourceIcons: [RESOURCE_ICONS.stone, RESOURCE_ICONS.wood],
		description: 'Churned mud, graves and bones: double the stone and wood of a basic tile',
	},
} as const;

/**
 * Cute life on the map: butterflies, bees, ladybugs and rabbits wander over owned land of a matching biome.
 * Purely decorative: they never take a click and give nothing.
 */
export const AMBIENT_LIFE = {
	firstSpawnMs: 6000, // the first critter shows up this long after the map opens
	spawnMinMs: 14000,
	spawnMaxMs: 30000,
	maxAlive: 3,
	lifeMinMs: 6000,
	lifeMaxMs: 10000,
	roamTiles: 1.5, // how far a critter strays from where it appears
	// which critter likes which biome (a name twice = twice as common). Fish only swim where the lake has water on all four
	// sides.
	byBiome: {
		forest: ['butterfly', 'bee', 'wolf'],
		plains: ['bee', 'butterfly'],
		swamp: ['ladybug', 'frog', 'frog'],
		hills: ['rabbit', 'goat', 'goat'],
		tundra: ['rabbit'],
		lake: ['fish', 'fish', 'butterfly'],
		coast: ['butterfly', 'bee', 'crab', 'crab'],
	} as Record<string, readonly AmbientCritterType[]>,
	// how far a critter strays, as a share of roamTiles (swimmers and crawlers stay close to where they appear)
	roamScale: { fish: 0.35, frog: 0.45, crab: 0.5, goat: 0.8, wolf: 1 } as Record<string, number>,
};

export type AmbientCritterType = 'butterfly' | 'bee' | 'ladybug' | 'rabbit' | 'fish' | 'frog' | 'crab' | 'goat' | 'wolf';
