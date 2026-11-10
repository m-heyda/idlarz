/**
 * The resource art roster: the pictures in public/pixel/resources/ and which resource each one is for. Same idea as the monster roster
 * (catalog/monsters.ts): `enabled: false` means the resource does not exist in the game yet, only its art is ready.
 *
 * - enabled (art in the game today): gold, gems, embers, xp, wood, stone, coal, food, meat, eggs, milk, hide, fish. The build
 *   (scripts/pixel/sprites_resource_art.py) pads these to 40 x 40 and writes them to public/pixel/icons/, which is what the game draws.
 * - planned (disabled): the T2 biome goods and T3 extracts of docs/plan/12-rebirth-biomes.md and docs/plan/18-biome-buildings-and-material-tiers.md. `art: false` = no picture yet.
 * - spare: files named `_<name>.png` are generated art nobody needs yet; they are not in this list (see public/pixel/resources/README.md).
 *
 * Pictures are 32 x 32. A planned key joins `RESOURCES` only when it is enabled (see the T2 checklist in docs/plan/ROADMAP.md).
 */

export type ResourceArtTier = 'currency' | 't0' | 't1' | 't2' | 't3';

export interface ResourceArtEntry {
	/** camelCase key; the file is `public/pixel/resources/<kebab-id>.png` */
	id: string;
	label: string;
	tier: ResourceArtTier;
	/** Biome the planned resource belongs to (docs/plan/12-rebirth-biomes.md, docs/plan/18-biome-buildings-and-material-tiers.md) */
	biome?: string;
	/** true = the resource exists in the game today (and its icon is built from this picture) */
	enabled: boolean;
	/** true when the picture file exists */
	art: boolean;
}

export const resourceArtUrl = (entry: Pick<ResourceArtEntry, 'id'>): string =>
	`/pixel/resources/${entry.id.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}.png`;

const live = (id: string, label: string, tier: ResourceArtTier): ResourceArtEntry => ({ id, label, tier, enabled: true, art: true });
const planned = (id: string, label: string, tier: ResourceArtTier, biome: string, art: boolean): ResourceArtEntry => ({
	id,
	label,
	tier,
	biome,
	enabled: false,
	art,
});

export const RESOURCE_ART: readonly ResourceArtEntry[] = [
	// In the game today
	live('gold', 'Gold', 'currency'),
	live('gems', 'Gems', 'currency'),
	live('embers', 'Embers', 'currency'),
	live('xp', 'XP', 'currency'),
	live('wood', 'Wood', 't0'),
	live('stone', 'Stone', 't0'),
	live('coal', 'Coal', 't0'),
	live('food', 'Food', 't0'),
	live('meat', 'Meat', 't0'),
	live('eggs', 'Eggs', 't1'),
	live('milk', 'Milk', 't1'),
	live('hide', 'Hide', 't1'),
	live('wool', 'Wool', 't1'),
	// A reserved icon (RESERVED_RESOURCES in config/pixelIcons.ts), not a header resource
	live('fish', 'Fish', 't0'),

	// T2 biome goods (docs/plan/12-rebirth-biomes.md)
	planned('hardwood', 'Hardwood', 't2', 'jungle', true),
	planned('cloth', 'Cloth', 't2', 'fields', true),
	planned('honey', 'Honey', 't2', 'orchard', true),
	planned('ichor', 'Ichor', 't2', 'blight', false),
	planned('medals', 'War Medals', 't2', 'battlefield', false),

	// T3 extracts, one per biome (docs/plan/18-biome-buildings-and-material-tiers.md)
	live('herbs', 'Herbs', 't3'),
	live('sap', 'Sap', 't3'),
	live('ironOre', 'Iron Ore', 't3'),
	live('spores', 'Spores', 't3'),
	live('frostshard', 'Frostshard', 't3'),
	live('pearls', 'Pearls', 't3'),
	live('salt', 'Salt', 't3'),
	planned('venom', 'Venom', 't3', 'jungle', false),
	planned('dye', 'Dye', 't3', 'fields', true),
	planned('royalJelly', 'Royal Jelly', 't3', 'orchard', false),
	planned('corruptedCore', 'Corrupted Core', 't3', 'blight', true),
	planned('scrapSteel', 'Scrap Steel', 't3', 'battlefield', true),
];
