// Monster drop chests (IDL-163, owner decision 2026-11-07): the config. A chest is a bag item (`catalog/items/chests.ts`) that a kill sometimes drops and the player opens later (`open` on /api/inventory, `lib/offline/openChest.ts`).

/** The kinds of monster chest: six biome tiers, the Royal chest of a boss and the Arcane chest of a golden monster. */
export const MONSTER_CHEST_TIERS = ['wooden', 'iron', 'mossy', 'coral', 'frost', 'magma', 'royal', 'arcane'] as const;
export type MonsterChestTier = (typeof MONSTER_CHEST_TIERS)[number];

/** The id of the bag item of a tier: `chest_wooden`, `chest_royal` ... Append-only like every item id. */
export const monsterChestItemId = (tier: MonsterChestTier): string => `chest_${tier}`;

/**
 * Monster drop chests: what drops them and what an opened one pays.
 *
 * - **Drops** (`dropChance`, `tierOfBiome`): a normal kill drops the chest of its biome's tier with a 2 % chance (`placement: extra`, rolled last so the rest of a kill is exactly what it was); a boss **always** drops a Royal chest; a golden (lucky) monster always drops an Arcane chest on top.
 * - **Tiers by biome**: Wooden (plains, fields, orchard), Iron Strongbox (hills, battlefield), Mossy (forest, swamp, jungle), Coral (coast, lake), Frost (tundra), Magma (blight). No keys: a chest opens free.
 * - **Contents** (`kinds`, `minutes`): an opened chest pays **minutes of the player's own income** of one kind, picked by weight (gold, one of wood / stone / coal / food, or XP; the XP carries the XP bonus), and half the time (`potionChance`) a potion of the tier's kind on top. No gems and no stat gifts. The size is `minutes` per tier, rolled between its two numbers.
 * - **Cap**: the average chest of every tier is worth at most `maxHourlyShare` (10 %) of an hour of income, i.e. 6 minutes (`tests/economy/monsterChestBudget.test.ts` holds it, and `npm run loot-sim` prints the table). The potion is outside the share like every drop; it is a minor or greater potion.
 * - The chest's own level is the castle level at the moment it is opened (like the map chests, `LOOT_SOURCES.chest.level`), so income-based contents grow with the kingdom and no level has to be stored on the bag stack.
 *
 * @category Loot/Monster chests
 * @order 1
 * @formula
 * drop chance = 2 % per normal kill (the biome's tier)            boss: 100 % Royal          golden: 100 % Arcane
 * opened = floor(income per second x U(min..max) minutes x 60)     of gold, one resource, or XP; + a potion at 50 %
 */
export const MONSTER_CHEST = {
	dropChance: 0.02,
	/** Biome -> the tier a normal monster of that biome drops */
	tierOfBiome: {
		plains: 'wooden',
		fields: 'wooden',
		orchard: 'wooden',
		hills: 'iron',
		battlefield: 'iron',
		forest: 'mossy',
		swamp: 'mossy',
		jungle: 'mossy',
		coast: 'coral',
		lake: 'coral',
		tundra: 'frost',
		blight: 'magma',
	} as Record<string, MonsterChestTier>,
	/** What a tier of chest is called, how many minutes of income it pays (the two ends of the roll), and the potion that may come with it */
	tiers: {
		wooden: { label: 'Wooden chest', minutes: [1, 3], potion: 'potion_minor', sellValue: 25 },
		iron: { label: 'Iron Strongbox', minutes: [1.5, 4], potion: 'potion_minor', sellValue: 40 },
		mossy: { label: 'Mossy chest', minutes: [2, 5], potion: 'potion_minor', sellValue: 60 },
		coral: { label: 'Coral chest', minutes: [2.5, 6], potion: 'potion_greater', sellValue: 90 },
		frost: { label: 'Frost chest', minutes: [3, 7], potion: 'potion_greater', sellValue: 130 },
		magma: { label: 'Magma chest', minutes: [3.5, 8], potion: 'potion_greater', sellValue: 180 },
		royal: { label: 'Royal chest', minutes: [4, 8], potion: 'potion_greater', sellValue: 300 },
		arcane: { label: 'Arcane chest', minutes: [4, 8], potion: 'potion_greater', sellValue: 300 },
	} as Record<MonsterChestTier, { label: string; minutes: [number, number]; potion: string; sellValue: number }>,
	/** Relative weights of what a chest pays minutes of: gold, one resource of `resources`, or XP */
	kinds: { gold: 45, resource: 30, xp: 25 },
	resources: ['wood', 'stone', 'coal', 'food'] as ('wood' | 'stone' | 'coal' | 'food')[],
	/** At least this much of a resource or XP, so a slow income still pays something */
	floor: { resource: 25, xp: 60 },
	potionChance: 0.5,
	/** The most an average chest of any tier may be worth, as a share of an hour of income */
	maxHourlyShare: 0.1,
};
