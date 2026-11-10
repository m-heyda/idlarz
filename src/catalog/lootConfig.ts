import { GRADES, type Grade } from '@/catalog/items/grades';
import { CRAFT_GEAR } from '@/config/crafting';
import { SET_DEFS } from './sets';

// Loot configuration: which sources give what. Pure data; the pipeline in src/lib/loot reads it and nothing here is
// code. All numbers are STARTING POINTS to be tuned with `npm run loot-sim` (docs/reference/loot.md).
//
//   source (monster, boss, chest) --lootProfileId--> profile --generalPoolId / bonusTables--> pools --> item definitions
//
// Rarity, item level, drop quantity and eligibility are separate: the profile says how many rolls and which rarity weights,
// the source says what level it is, the pools say which items may appear, and the items say which levels they exist at.

/** A set of items a profile can draw from. Membership: listed ids, the item's own `pools`, or all `requireTags`. */
export interface PoolDef {
	id: string;
	includeIds?: string[];
	/** An item must have ALL of these tags (ItemDef.tags) */
	requireTags?: string[];
	/** No item of a higher ladder grade is in the pool (a biome's ceiling). Items outside the ladder (no `grade:` tag) are not held back. */
	maxGrade?: Grade;
	excludeTags?: string[];
	excludeIds?: string[];
	/** Per-item weight in this pool when it should differ from the item's `poolWeight` (potions drop differently per source) */
	weights?: Record<string, number>;
	/** Per-item minimum source item level in this pool (the greater potion only drops from older monsters, but freely from chests) */
	minLevels?: Record<string, number>;
	/** Per-item quantity of a consumable drop (default 1) */
	quantities?: Record<string, number>;
	enabled: boolean;
}

/** How many equipment rolls, and whether each succeeds. The first `guaranteed` rolls always succeed. */
export interface RollsDef {
	min: number;
	max: number;
	guaranteed?: number;
	chancePerRoll: number;
	/** Added to `chancePerRoll` per monster level above 1 */
	chancePerLevel?: number;
}

export interface ItemLevelDef {
	/** Added to the source level (a harder profile may offset it; never double-count a tier bonus that the source level already has) */
	offset: number;
	/** The item level is rolled in source level + offset +/- variance */
	variance: number;
	min: number;
	max: number;
}

/**
 * An extra reward channel on top of the general equipment rolls: a targeted pool (named items), potions, a boss's own
 * pool. `placement` says how it combines with the general rolls: `extra` adds to them (default), `fallback` only runs when
 * no equipment has dropped yet, `replace` cancels them when it triggers (a documented replacement, e.g. a chest's legendary).
 */
export interface BonusTable {
	id: string;
	poolId: string;
	/** Chance the table triggers at all (default 1) */
	chance?: number;
	/** Added to `chance` per monster level above 1 */
	chancePerLevel?: number;
	/** How many items it gives once triggered; default one */
	rolls?: RollsDef;
	/** `rolled`: the item's rarity is rolled from the profile's weights (bases). `fixed`: as the item defines it (named items, consumables). */
	mode: 'rolled' | 'fixed';
	/** Take every item in the pool once, with its quantity (a boss's potions) */
	takeAll?: boolean;
	/** Prefer pool items the player does not own yet while any remain (a boss's set pieces); works in both modes (`rolled` per rarity) */
	preferMissing?: boolean;
	/** Own item level window; default: the profile's */
	itemLevel?: Pick<ItemLevelDef, 'offset' | 'variance'>;
	/** Bad-luck protection: each miss adds `perMiss` to the chance (up to `maxBonus`); a drop resets it */
	pity?: { perMiss: number; maxBonus: number };
	placement?: 'extra' | 'fallback' | 'replace';
}

export interface LootProfile {
	id: string;
	rolls: RollsDef;
	itemLevel: ItemLevelDef;
	/** Relative weights, normalised at runtime (they need not sum to 100). A rarity missing here cannot drop from this profile. */
	rarityWeights: Record<string, number>;
	/** A rarity cannot drop below this item level (data, not an item-specific condition) */
	rarityLevelGate?: Record<string, number>;
	/** Pool the general equipment rolls draw from; null = no general rolls */
	generalPoolId: string | null;
	bonusTables: BonusTable[];
	enabled: boolean;
}

/** Where the level of a chest or a shelf comes from: the castle level (the game's world level). Never the player's level. */
export interface SourceLevelDef {
	base: number;
	perCastleLevel: number;
}

/**
 * A source either has a level of its own (`level`: chests, the merchant's shelf) or gets it from the caller (`levels`: a monster
 * passes its own level, and `levels` is the range it can have, which `validateLootData` checks the pools against).
 */
export interface LootSource {
	id: string;
	lootProfileId: string;
	level?: SourceLevelDef;
	levels?: { min: number; max: number };
}

/**
 * The grades a biome's normal monsters may drop (docs/plan/26-next-updates-plan.md C1: plains G1-G3, forest G2-G4, swamp G3-G5, tundra G5-G7).
 * The pool admits every ladder grade up to the biome's ceiling (`maxGrade`; since IDL-243 every piece that drops is on the ladder: the legacy wood, steel and Obsidian pieces are graded or retired); the floor needs no tag because an item only exists inside its grade's item level
 * window (items/grades.ts), so a level 30 monster cannot drop G1 whatever the pool says. (Excluding the lower grades by tag would leave
 * a forest kill at level 4-8 with nothing eligible while G1 is the only live grade there.) Only the grades in `LIVE_GRADES` have enabled items,
 * so a ceiling above the highest live grade changes nothing yet. With G1-G6 live (IDL-238) the item level decides, and a ceiling must reach the grade of the highest item level the biome can produce: plains monsters (levels 1-20, growing up to 30, plus 1 of variance) reach item level 31, so plains stops at G4, where G3 would leave a grown monster with nothing to drop.
 *
 * A biome's grade ceiling. Normal monsters drop from `monster_<biome>` (pool `equipment_<biome>`): ladder grades up to the biome's ceiling (plains G4, coast G4, forest G4, hills G4, swamp G5, lake G5, tundra G7, jungle G7); the floor is the item level window of each grade.
 * Every base that drops carries a `grade:` tag (IDL-243): the legacy wood, steel and Obsidian pieces that fill a ladder cell are graded by it (Wooden Club G1, Hunting Bow G2, Iron Sword G3, six Steel armour pieces G4, the Obsidian family G6; they keep their ids, art and set bonuses),
 * the rest of wood, steel and all of cloth are retired (`enabled: false`, ids kept, owned pieces keep working). A graded legacy piece is generated only in its grade's window and rarities (`dropLevels`, `dropRarities`) but stays valid at its old level range for pieces already owned.
 * The highest live grade is open at the top and takes every rarity ({@link gradeLevels}, {@link gradeRarities} in `src/catalog/items/grades.ts`) so nothing is left without a base while the next grade is dark; a rarity with no base at an item level is left out of the roll there.
 * The merchant's shelf passes `maxGrade` = the best grade the player wears ({@link bestWornGrade}).
 *
 * @category Loot/Config
 * @order 3
 */
export const BIOME_LOOT = {
	plains: { ceiling: 4, levels: { min: 1, max: 20 } },
	forest: { ceiling: 4, levels: { min: 4, max: 24 } },
	swamp: { ceiling: 5, levels: { min: 8, max: 28 } },
	tundra: { ceiling: 7, levels: { min: 12, max: 30 } },
	// IDL-201: the pool is the grade band of the tier the biome sits at (coast with plains, hills with forest, lake with swamp); levels are the spawn window's base to its cap plus the 10 levels of growth
	coast: { ceiling: 4, levels: { min: 2, max: 22 } },
	hills: { ceiling: 4, levels: { min: 6, max: 26 } },
	lake: { ceiling: 5, levels: { min: 10, max: 29 } },
	// the jungle follows the tundra's band (rebirth 1 players wear the best grades there are)
	jungle: { ceiling: 7, levels: { min: 14, max: 32 } },
} as const satisfies Record<string, { ceiling: number; levels: { min: number; max: number } }>;
export type LootBiome = keyof typeof BIOME_LOOT;

/** The loot source a normal monster of this biome drops from (`monster_plains`...) */
export const monsterSourceId = (biome: string): string => `monster_${biome}`;

/**
 * Every set's id is also the tag its pieces carry. Set pieces are boss loot (IDL-44): a boss's general roll ({@link bossGeneralPool}) never contains a set piece, and the only way a boss gives one is its own `set` table ({@link BOSS_LOOT}).
 * The rest of the sources keep the pieces of {@link OPEN_SETS} in their pools and leave every other set out: the special sets S1-S3 wait for their bosses (their pieces are disabled anyway).
 */
const SET_TAGS: readonly string[] = SET_DEFS.filter((set) => !set.retired).map((set) => set.id);

/**
 * Sets whose pieces still drop from the general pools (monsters, chests, the shelf is plain gear only). Today that is the Obsidian set, which predates the boss sets and has no owner yet (its pieces are grade G6, item level 55 and up, beyond what any
 * source reaches). TODO: give it to a boss when G6 becomes reachable, then empty this list; `tests/loot/bossOwnership.test.ts` fails if a set is neither owned nor listed here.
 */
export const OPEN_SETS: readonly string[] = ['obsidian'];
const GENERAL_EXCLUDED_TAGS: readonly string[] = ['named', ...SET_TAGS.filter((tag) => !OPEN_SETS.includes(tag))];

/** The pool of a boss's general roll: ladder gear up to the biome's ceiling (none: every grade) with no named item and no set piece at all */
export const bossGeneralPool = (biome?: string): string => (biome ? `boss_general_${biome}` : 'boss_general');

const biomePools = (): Record<string, PoolDef> =>
	Object.fromEntries(
		Object.entries(BIOME_LOOT).map(([biome, { ceiling }]) => {
			const id = `equipment_${biome}`;
			return [id, { id, requireTags: ['gear'], excludeTags: [...GENERAL_EXCLUDED_TAGS], maxGrade: GRADES[ceiling - 1], enabled: true } satisfies PoolDef];
		}),
	);

const bossPools = (): Record<string, PoolDef> => ({
	[bossGeneralPool()]: { id: bossGeneralPool(), requireTags: ['gear'], excludeTags: ['named', ...SET_TAGS], enabled: true },
	...Object.fromEntries(
		Object.entries(BIOME_LOOT).map(([biome, { ceiling }]) => {
			const id = bossGeneralPool(biome);
			return [id, { id, requireTags: ['gear'], excludeTags: ['named', ...SET_TAGS], maxGrade: GRADES[ceiling - 1], enabled: true } satisfies PoolDef];
		}),
	),
});

/** What one biome's boss owns (IDL-44) */
export interface BossLootDef {
	/** Named unique items (ids in the `legendary_weapons` pool) only this boss drops, as one table with a small chance and pity. Empty: the boss has none yet. */
	uniques: readonly string[];
	/**
	 * The set this boss owns (a `SetDef` id, also the tag of its pieces): the boss gives one piece of it per kill that triggers its set table, preferring pieces the player does not own yet.
	 * `null`: no set is wired to this boss yet. No set of the four biomes that exist today has live pieces, so every entry is `null`; the set table appears as soon as an id is filled in.
	 */
	setId: string | null;
	/** The levels the boss can have: its spawn window plus the growth (`limitOf('monsterGrowthLevels')`); `validateLootData` checks the biome's pool covers every item level they reach */
	levels: { min: number; max: number };
}

/** The loot source a biome's boss drops from (`boss_plains`...) */
export const bossSourceId = (biome: string): string => `boss_${biome}`;

/**
 * Who owns which drops (IDL-44, docs/plan/20-monster-families-and-rewards.md): each biome's boss has a source of its own (`boss_<biome>`, profile `boss_<biome>`) with
 *
 * - a guaranteed general roll from its own general pool (`boss_general_<biome>`: no named item, no set piece; the grades the biome's monsters drop up to the ceiling, at the boss's level),
 * - its potions (every kill),
 * - its **unique** table (`unique`, pool `boss_unique_<biome>`): `BOSS_UNIQUE_CHANCE` per kill, plus `BOSS_UNIQUE_PITY` per miss, a drop resets the counter (the ledger's `lootPity`, key `boss_<biome>:unique`),
 * - its **set** table (`set`, pool `boss_set_<biome>`), only when `setId` is filled in: `BOSS_SET_CHANCE` per kill with pity (`BOSS_SET_PITY`), one guaranteed roll of the set's pieces, missing pieces first.
 *
 * No boss drops another boss's unique or set: set pieces are kept out of every general pool (`GENERAL_EXCLUDED_TAGS`, the boss pools exclude all of them) and each unique sits in exactly one boss's pool. `tests/loot/bossOwnership.test.ts` enumerates every boss's source.
 *
 * **Adding a biome's boss (post release):** add the biome to {@link BIOME_LOOT}, its boss to `MONSTERS` with `lootSourceId: bossSourceId(biome)`, and one entry here. **Wiring a set:** fill in `setId`; its pieces must be enabled and have item levels the boss reaches (the validator reports an empty set pool).
 * The sets S1-S3 and Obsidian have no boss yet (their pieces are disabled or out of item level reach), so `setId` is `null` for all four bosses; `PENDING_SETS` in the test lists them so a set cannot be forgotten.
 * The uniques are the three legendary weapons, one per boss from the hardest down (Titan Maul from the Winter Wyrm, Emberbrand from the Mire Matriarch, Starfall Bow from the Elder Stag); the Great Auroch has none yet. Chests still drop them too (`basic_chest`, 1.9 %).
 *
 * @category Loot/Config
 * @order 4
 * @table boss-loot
 */
export const BOSS_LOOT: Record<LootBiome, BossLootDef> = {
	plains: { uniques: [], setId: null, levels: { min: 15, max: 35 } },
	forest: { uniques: ['starfall_bow'], setId: null, levels: { min: 20, max: 40 } },
	swamp: { uniques: ['emberbrand'], setId: null, levels: { min: 25, max: 45 } },
	tundra: { uniques: ['titan_maul'], setId: null, levels: { min: 30, max: 50 } },
	// IDL-201: no legendary weapon is left to give, so these three bosses have only the general roll and the potions (uniques and sets wait for IDL-111)
	coast: { uniques: [], setId: null, levels: { min: 17, max: 37 } },
	hills: { uniques: [], setId: null, levels: { min: 22, max: 42 } },
	lake: { uniques: [], setId: null, levels: { min: 27, max: 47 } },
	jungle: { uniques: [], setId: null, levels: { min: 32, max: 52 } },
};

/** A boss's chance per kill of its unique, and the bad-luck protection on it (the numbers of the old single boss table: 5 %, +1 % per miss up to +10 %) */
export const BOSS_UNIQUE_CHANCE = 0.05;
export const BOSS_UNIQUE_PITY = { perMiss: 0.01, maxBonus: 0.1 };
/** A boss's chance per kill that a piece of its set drops, and its pity: +15 % per miss up to +50 %, so a piece is certain after at most 4 kills in a row without one. TODO tune with `loot-sim` once a set is wired. */
export const BOSS_SET_CHANCE = 0.5;
export const BOSS_SET_PITY = { perMiss: 0.15, maxBonus: 0.5 };

/** The profile every boss starts from: one guaranteed general roll and the potions. The generic `boss` source (debug panel, `craft-sim`) uses it as is. */
const BOSS_BASE: LootProfile = {
	id: 'boss',
	rolls: { min: 1, max: 1, guaranteed: 1, chancePerRoll: 1 },
	itemLevel: { offset: 0, variance: 0, min: 1, max: 100 },
	rarityWeights: { common: 20, uncommon: 30, rare: 30, epic: 15, legendary: 5 },
	generalPoolId: bossGeneralPool(),
	// `king_potions` is a legacy id (from the Rat King): it names the roll in explain traces only
	bonusTables: [{ id: 'king_potions', poolId: 'potions_king', mode: 'fixed', takeAll: true }],
	enabled: true,
};

/** The pools, profiles and sources of the bosses in `loot` (data in, data out, so a test can try a boss with a set that does not exist yet). The unique and set tables run before the potions. */
export const buildBossLoot = (
	loot: Record<string, BossLootDef>,
): { pools: Record<string, PoolDef>; profiles: Record<string, LootProfile>; sources: Record<string, LootSource> } => {
	const pools: Record<string, PoolDef> = {};
	const profiles: Record<string, LootProfile> = {};
	const sources: Record<string, LootSource> = {};
	for (const [biome, def] of Object.entries(loot)) {
		const id = bossSourceId(biome);
		const tables: BonusTable[] = [];
		if (def.uniques.length) {
			pools[`boss_unique_${biome}`] = { id: `boss_unique_${biome}`, includeIds: [...def.uniques], enabled: true };
			tables.push({
				id: 'unique',
				poolId: `boss_unique_${biome}`,
				mode: 'fixed',
				chance: BOSS_UNIQUE_CHANCE,
				pity: BOSS_UNIQUE_PITY,
				itemLevel: { offset: 0, variance: 0 },
			});
		}
		if (def.setId) {
			pools[`boss_set_${biome}`] = { id: `boss_set_${biome}`, requireTags: [def.setId], enabled: true };
			tables.push({
				id: 'set',
				poolId: `boss_set_${biome}`,
				mode: 'rolled',
				chance: BOSS_SET_CHANCE,
				pity: BOSS_SET_PITY,
				rolls: { min: 1, max: 1, guaranteed: 1, chancePerRoll: 1 },
				preferMissing: true,
				itemLevel: { offset: 0, variance: 0 },
			});
		}
		profiles[id] = { ...BOSS_BASE, id, generalPoolId: bossGeneralPool(biome), bonusTables: [...tables, ...BOSS_BASE.bonusTables] };
		sources[id] = { id, lootProfileId: id, levels: def.levels };
	}
	return { pools, profiles, sources };
};

const BOSSES = buildBossLoot(BOSS_LOOT);

/**
 * Adding loot content is data only; the generator needs no change.
 *
 * - **A base item**: add `gear(id, name, slot, rarity, stats, { tier, ... })` ({@link gear}) to a file in `src/catalog/items/`. Its stats are authored at the first level of its tier's window (`LEVEL_WINDOW_BY_TIER`).
 *   It joins the general pool automatically (tags `gear`, not `named`). Register its icon as one line in `src/config/itemIcons/<slot>.json` if it has art (see its README).
 * - **A named item** (fixed identity and rarity): the same builder with `named: true, pools: ['some_pool']`, then put the pool in a profile's `bonusTables`.
 * - **A biome's grade ceiling**: {@link BIOME_LOOT}.
 * - **An affix**: one row in `src/catalog/affixes.ts` (`pair(...)` makes a prefix and a suffix of a stat).
 * - **A rarity**: one row in {@link RARITIES}, then a weight for it in each profile that should drop it; `allowedRarities` already includes every rarity key for bases. No generator change
 *   (`tests/loot/lootGenerate.test.ts` proves it with a fake rarity).
 * - **A profile / source** (an elite monster, a premium chest): add the profile and a {@link LOOT_SOURCES} entry, then point the monster or chest at it.
 * - **Tuning**: weights, chances, levels and curve are all config. Run `npm run loot-sim -- --md`, then {@link validateLootData} (the tests) tells you what no longer fits.
 *
 * @title Adding loot content (data only)
 * @category Loot/Adding content
 * @order 1
 * @see gear, RARITIES, LOOT_SOURCES
 */
export const LOOT_POOLS: Record<string, PoolDef> = {
	general_equipment: { id: 'general_equipment', requireTags: ['gear'], excludeTags: [...GENERAL_EXCLUDED_TAGS], enabled: true },
	...biomePools(),
	/** The craft source's pool (IDL-241): ladder gear up to the highest crafted grade; the request names the slot and the item level window, so the grade follows. */
	equipment_craft: { id: 'equipment_craft', requireTags: ['gear'], excludeTags: [...GENERAL_EXCLUDED_TAGS], maxGrade: CRAFT_GEAR.ceilingGrade, enabled: true },
	legendary_weapons: { id: 'legendary_weapons', enabled: true },
	...bossPools(),
	...BOSSES.pools,
	potions_rat: {
		id: 'potions_rat',
		includeIds: ['potion_minor', 'potion_greater'],
		weights: { potion_minor: 4, potion_greater: 1 },
		minLevels: { potion_greater: 7 },
		enabled: true,
	},
	/** Legacy id: the boss potion pool (named for the Rat King, which is gone). Kept because pool ids can appear in saves. */
	potions_king: { id: 'potions_king', includeIds: ['potion_minor', 'potion_greater'], quantities: { potion_minor: 2, potion_greater: 1 }, enabled: true },
	potions_chest: { id: 'potions_chest', includeIds: ['potion_minor', 'potion_greater'], weights: { potion_minor: 60, potion_greater: 25 }, enabled: true },
};

/** A normal monster's profile; each biome gets a copy that draws from its own pool (same rolls, same rarities) */
const NORMAL_MONSTER: LootProfile = {
	id: 'normal_monster',
	rolls: { min: 1, max: 1, chancePerRoll: 0.12, chancePerLevel: 0.01 },
	itemLevel: { offset: 0, variance: 1, min: 1, max: 100 },
	rarityWeights: { common: 70, uncommon: 22, rare: 7, epic: 1, legendary: 0.2 },
	rarityLevelGate: { rare: 3, epic: 8, legendary: 15 },
	generalPoolId: 'general_equipment',
	bonusTables: [{ id: 'rat_potion', poolId: 'potions_rat', chance: 0.25, chancePerLevel: 0.015, mode: 'fixed', itemLevel: { offset: 0, variance: 0 } }],
	enabled: true,
};

/**
 * Profiles: how many rolls, which rarity weights, which pool, which bonus tables. A normal monster's profile is copied per biome and draws from that biome's pool. All numbers are STARTING POINTS to be tuned with `npm run loot-sim -- --md`.
 *
 * @category Loot/Config
 * @order 2
 * @table loot-profiles
 */
export const LOOT_PROFILES: Record<string, LootProfile> = {
	normal_monster: NORMAL_MONSTER,
	...Object.fromEntries(
		Object.keys(BIOME_LOOT).map((biome) => [
			`normal_monster_${biome}`,
			{ ...NORMAL_MONSTER, id: `normal_monster_${biome}`, generalPoolId: `equipment_${biome}` } satisfies LootProfile,
		]),
	),
	boss: BOSS_BASE,
	...BOSSES.profiles,
	basic_chest: {
		id: 'basic_chest',
		// The chest's item reward is one item: gear 82% of the time, else a potion (the old pool's gear:potion weight ratio)
		rolls: { min: 1, max: 1, chancePerRoll: 0.82 },
		itemLevel: { offset: 0, variance: 1, min: 1, max: 100 },
		rarityWeights: { common: 62, uncommon: 24, rare: 9, epic: 4, legendary: 1 },
		rarityLevelGate: { rare: 3, epic: 6, legendary: 12 },
		generalPoolId: 'general_equipment',
		bonusTables: [
			{ id: 'chest_legendary', poolId: 'legendary_weapons', mode: 'fixed', chance: 0.019, placement: 'replace' },
			{ id: 'chest_potion', poolId: 'potions_chest', mode: 'fixed', placement: 'fallback' },
		],
		enabled: true,
	},
	/**
	 * Crafted gear (IDL-241, `craft` source): one guaranteed roll per craft. The weights are held at or below the chest's and the boss's for the same rarities (common 62/20, uncommon 24/30, rare 9/30: rare share
	 * among uncommon and rare is 21% here, 27% in a chest, 50% from a boss), and there is no epic or legendary: crafting never out-scales drops (`npm run craft-sim`). Luck, the pity counter, the crafting level's
	 * rarity ceiling and Intelligence come in with the request (`LootRequest`).
	 */
	craft: {
		id: 'craft',
		rolls: { min: 1, max: 1, guaranteed: 1, chancePerRoll: 1 },
		itemLevel: { offset: 0, variance: 1, min: 1, max: 100 },
		rarityWeights: { common: 70, uncommon: 22, rare: 6 },
		generalPoolId: 'equipment_craft',
		bonusTables: [],
		enabled: true,
	},
	// The merchant's shelf: plain pieces of gear (common and uncommon only; the rest stays a reward for fights and chests) at the world
	// level, held to what the player wears (lib/merchant.ts, MERCHANT_GOODS)
	merchant_stock: {
		id: 'merchant_stock',
		rolls: { min: 12, max: 12, guaranteed: 12, chancePerRoll: 1 }, // the most a shelf may ever hold (HARD_LIMITS); lib/merchant keeps the first `merchantOffers`
		itemLevel: { offset: 0, variance: 2, min: 1, max: 100 },
		rarityWeights: { common: 60, uncommon: 40 },
		generalPoolId: 'general_equipment',
		bonusTables: [],
		enabled: true,
	},
};

/**
 * Keyed by the `DropSource` (a monster type, `chest` or the merchant's `merchant` shelf). A monster's drops are at its own level (monsters 1-30, bosses 15-45).
 *
 * Sources, keyed by the `DropSource` (a monster's biome source `monster_<biome>`, `boss`, `chest`, the merchant's `merchant` shelf). A monster's drops are at its own level (monsters 1-30, bosses 15-45); a chest and the shelf
 * start at item level 4 plus 3 per castle level above 1.
 *
 * @category Loot/Config
 * @order 1
 * @table loot-sources
 */
export const LOOT_SOURCES: Record<string, LootSource> = {
	// A biome-less normal monster (the debug panel, tests): the whole general pool. The game's monsters use their biome's source below.
	monster: { id: 'monster', lootProfileId: 'normal_monster', levels: { min: 1, max: 30 } },
	...Object.fromEntries(
		Object.entries(BIOME_LOOT).map(([biome, { levels }]) => [
			monsterSourceId(biome),
			{ id: monsterSourceId(biome), lootProfileId: `normal_monster_${biome}`, levels } satisfies LootSource,
		]),
	),
	boss: { id: 'boss', lootProfileId: 'boss', levels: { min: 15, max: 45 } },
	...BOSSES.sources,
	chest: { id: 'chest', lootProfileId: 'basic_chest', level: { base: 4, perCastleLevel: 3 } },
	merchant: { id: 'merchant', lootProfileId: 'merchant_stock', level: { base: 4, perCastleLevel: 3 } },
	// Crafted gear: the caller passes the item level (a recipe's grade window), see CRAFT_GEAR. Levels 1-42 (41 and the variance of 1) are G1-G4.
	craft: { id: 'craft', lootProfileId: 'craft', levels: { min: 1, max: 41 } },
};
