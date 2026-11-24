/**
 * Every resource and currency the player can hold: what it is called, how it looks, what it is for and where it comes
 * from, what the merchant pays. The header tooltips, the merchant windows, the floating "+N" popups and the icon
 * fallbacks all read this one table (config/resources.ts derives its old RESOURCE_ICONS / HEADER_* / MERCHANT_* views from it).
 * Rates, costs and prices-per-level stay in src/config: those are balance numbers, not catalog data.
 */
/**
 * The header shows one boxed group per tier, left to right. A new tier is one entry here plus its resources' `tier`.
 * currency: gold, gems and Embers. t0: the base materials the land produces. t1: the farm products.
 */
export type ResourceTier = 'currency' | 't0' | 't1' | 't2' | 't3' | 't4';

export const RESOURCE_TIERS: readonly { id: ResourceTier; label: string }[] = [
	{ id: 'currency', label: 'Currency' },
	{ id: 't0', label: 'Base materials' },
	{ id: 't1', label: 'Farm products' },
	// planned (docs/plan/18-biome-buildings-and-material-tiers.md): nothing sits in these yet, and the header skips a tier without resources
	{ id: 't2', label: 'Biome goods' },
	{ id: 't3', label: 'Extracts' },
	{ id: 't4', label: 'Relics' },
];

export interface ResourceDef {
	/** Lives in the save's `resources` object and in the ledger totals (gold ... xp). Gems and Embers have their own balance and are not stored here. */
	stored?: true;
	/** Added after the first saves: a save without it is still valid and reads 0 (every new resource starts this way) */
	optionalInSave?: true;
	/** Comes from the farm (meat, eggs, milk, hide, wool) */
	farm?: true;
	/** Header group; left out for things the header never lists (xp) */
	tier?: ResourceTier;
	/** Fallback glyph while a pixel icon is missing (the pixel art itself is registered in config/pixelIcons.ts) */
	emoji: string;
	label: string;
	description: string;
	usedFor: string;
	source: string;
	/** Colour of the floating "+N" popup */
	color: string;
	/** Present when the merchant buys it: gold per unit, plus his pitch */
	merchant?: { price: number; description: string; pitch: string };
	/** What a unit counts for in the cost of a recipe (`recipeCostGold`, the no-gold-printer gates) when that is more than the merchant pays: the T3 extracts sell for 5 gold but are worth 50 as crafting inputs, because their real sink is crafting and the buildings, not the shop (docs/plan/18) */
	craftValue?: number;
}

export const RESOURCES = {
	gold: {
		stored: true,
		tier: 'currency',
		emoji: '💰',
		label: 'Gold',
		description: 'The coin of the realm.',
		usedFor: 'Buying map tiles, buildings, castle upgrades, click power and everything at the merchant.',
		source: 'The castle and most land, every click on the map, and selling goods to the merchant.',
		color: '#ffe27a',
	},
	// Merchant prices follow how fast each resource is produced early on (measured on random maps of 10-40 tiles): the slower
	// a resource comes in, the more it sells for, so selling an hour of any basic resource pays about the same gold. The overall
	// level keeps the early total sell value where it was (wood .75, stone .9, coal 1.1, food .4; they were .5 / .5 / 1 / .75).
	// Buying costs MERCHANT_BUY_MULTIPLIER x the price. Meat and the farm products are priced against what their animals cost.
	wood: {
		stored: true,
		tier: 't0',
		emoji: '🪓',
		label: 'Wood',
		description: 'Basic construction material.',
		usedFor: 'Part of the price of tiles (from the 15th), buildings, castle upgrades, Hen House and Pen Expansion.',
		source: 'Forest and swamp tiles. Sells to the merchant.',
		color: '#e0b078',
		merchant: { price: 0.75, description: 'A basic construction material, available in forests.', pitch: 'Common but always in demand.' },
	},
	stone: {
		stored: true,
		tier: 't0',
		emoji: '🧱',
		label: 'Stone',
		description: 'Durable building material.',
		usedFor: 'Part of the price of tiles (from the 15th), buildings, castle upgrades, Dairy and Pen Expansion.',
		source: 'Hills tiles. Sells to the merchant.',
		color: '#d4cdb8',
		merchant: { price: 0.9, description: 'Durable and versatile building material from quarries.', pitch: 'Premium quality building material.' },
	},
	coal: {
		stored: true,
		tier: 't0',
		emoji: '⚫',
		label: 'Coal',
		description: 'Fuel for heavy industry.',
		usedFor: 'Part of the price of tiles (from the 30th), castle upgrades from level 3 and the Tannery.',
		source: 'Tundra and hills tiles. Sells to the merchant.',
		color: '#9fb4e8',
		merchant: { price: 1.1, description: 'Valuable fuel source used for advanced applications.', pitch: 'Highly sought after for its energy properties.' },
	},
	food: {
		stored: true,
		tier: 't0',
		emoji: '🌾',
		label: 'Food',
		description: 'Sustains your people and your animals.',
		usedFor: 'Buying farm animals, Feed Trough, Pen Expansion, tiles (from the 40th) and castle upgrades from level 4.',
		source: 'Plains, lake and coast tiles. Sells to the merchant.',
		color: '#f4d25a',
		merchant: { price: 0.4, description: 'Sustains population and enables growth.', pitch: 'Plentiful but essential for survival.' },
	},
	meat: {
		stored: true,
		farm: true,
		tier: 't0',
		emoji: '🥩',
		label: 'Meat',
		description: 'Produced by farm animals.',
		usedFor: 'Castle upgrades from level 4; sell the rest to the merchant.',
		source: 'Every animal on the farm (boosted by Feed Trough and the plains bonus).',
		color: '#ff9a86',
		merchant: { price: 1, description: 'A source of protein for a healthy diet.', pitch: 'High demand for a nutritious meal.' },
	},
	// farm products sell for more than the meat they come with
	eggs: {
		stored: true,
		optionalInSave: true,
		farm: true,
		tier: 't1',
		emoji: '🥚',
		label: 'Eggs',
		description: 'A farm product laid by chickens.',
		usedFor: 'Hen House upgrades; sell the rest to the merchant.',
		source: 'Chickens on the farm. Cannot be bought.',
		color: '#f4e6c4',
		merchant: { price: 2, description: 'Fresh from the coop.', pitch: 'Bakers pay well for fresh eggs.' },
	},
	milk: {
		stored: true,
		optionalInSave: true,
		farm: true,
		tier: 't1',
		emoji: '🥛',
		label: 'Milk',
		description: 'A farm product from cows.',
		usedFor: 'Dairy upgrades; sell the rest to the merchant.',
		source: 'Cows on the farm. Cannot be bought.',
		color: '#e8f0fa',
		merchant: { price: 3, description: 'Creamy and cold from the dairy.', pitch: 'A town favourite at breakfast.' },
	},
	hide: {
		stored: true,
		optionalInSave: true,
		farm: true,
		tier: 't1',
		emoji: '🟫',
		label: 'Hide',
		description: 'A farm product from pigs.',
		usedFor: 'Tannery upgrades and the price of big territories; sell the rest to the merchant.',
		source: 'Pigs on the farm, and the monsters you beat. Cannot be bought.',
		color: '#c89868',
		merchant: { price: 2, description: 'Tanned leather from the farm.', pitch: 'Craftsmen always need good leather.' },
	},
	xp: {
		stored: true,
		emoji: '✨',
		label: 'XP',
		description: 'Experience: fills the level bar next to your name.',
		usedFor: 'Every level gives stat points to spend on the Stats tab.',
		source: 'The castle, buying tiles and your stats.',
		color: '#c4a0ff',
	},
	// The premium currency (not in Resources: it is its own gems balance in the game state)
	gems: {
		tier: 'currency',
		emoji: '💎',
		label: 'Gems',
		description: 'Rare gems. Everyone starts with a purse of them.',
		usedFor: 'Upgrades (coming soon). They are never lost by a rebirth.',
		source: 'Your starting purse; more ways to earn them are coming.',
		color: '#7fd8ff',
	},
	// The rebirth currency (not in Resources: it lives in the prestige state, saved as prestige.legacyPoints / legacyEarned)
	embers: {
		tier: 'currency',
		emoji: '🔮',
		label: 'Embers',
		description: 'The rebirth currency: what a rebirth leaves behind.',
		usedFor: 'Permanent upgrades in the Ember shop; they survive every rebirth, and every Ember adds to your income.',
		source: 'Rebirthing from castle level 6: the higher your castle and land, the more you get.',
		color: '#ffb04a',
	},
	// T3 extracts (docs/plan/18-biome-buildings-and-material-tiers.md): one per home biome, made only by that biome's Extractor building. The merchant buys them (sell only: he never sells them back, see `MERCHANT_BUYABLE`). Appended after the old entries so the saved order of the others is unchanged.
	herbs: {
		stored: true,
		optionalInSave: true,
		tier: 't3',
		emoji: '🌿',
		label: 'Herbs',
		description: 'A crafting extract of the plains.',
		usedFor:
			'Crafting (potions and enchants), Producer, Extractor and Idol upgrades from level 3, and the castle from level 7 (sells to the merchant for just 5 gold).',
		source: 'The Herb Garden on a plains tile. Sells to the merchant (he does not sell it back).',
		color: '#8fd16a',
		craftValue: 50,
		merchant: { price: 5, description: 'Fresh-cut herbs from the plains.', pitch: 'Apothecaries pay for good herbs.' },
	},
	sap: {
		stored: true,
		optionalInSave: true,
		tier: 't3',
		emoji: '🍯',
		label: 'Sap',
		description: 'A crafting extract of the forest.',
		usedFor:
			'Crafting (arrow and blade coatings), Producer, Extractor and Idol upgrades from level 3, and the castle from level 7 (sells to the merchant for just 5 gold).',
		source: 'The Sap Tapper on a forest tile. Sells to the merchant (he does not sell it back).',
		color: '#e0a64a',
		craftValue: 50,
		merchant: { price: 5, description: 'Thick sap from the forest.', pitch: 'Used for coatings and glues.' },
	},
	ironOre: {
		stored: true,
		optionalInSave: true,
		tier: 't3',
		emoji: '⛏️',
		label: 'Iron Ore',
		description: 'A crafting extract of the hills.',
		usedFor:
			'Crafting (steel weapons and armor), Producer, Extractor and Idol upgrades from level 3, and the castle from level 7 (sells to the merchant for just 5 gold).',
		source: 'The Deep Mine on a hills tile. Sells to the merchant (he does not sell it back).',
		color: '#b8c0d0',
		craftValue: 50,
		merchant: { price: 5, description: 'Raw ore from the deep mines.', pitch: 'Smiths always need more ore.' },
	},
	spores: {
		stored: true,
		optionalInSave: true,
		tier: 't3',
		emoji: '🍄',
		label: 'Spores',
		description: 'A crafting extract of the swamp.',
		usedFor:
			'Crafting (potions and enchants), Producer, Extractor and Idol upgrades from level 3, and the castle from level 7 (sells to the merchant for just 5 gold).',
		source: 'The Spore Cellar on a swamp tile. Sells to the merchant (he does not sell it back).',
		color: '#b88ad8',
		craftValue: 50,
		merchant: { price: 5, description: 'Cellar-grown spores from the swamp.', pitch: 'Alchemists buy them by the sack.' },
	},
	frostshard: {
		stored: true,
		optionalInSave: true,
		tier: 't3',
		emoji: '❄️',
		label: 'Frostshard',
		description: 'A crafting extract of the tundra.',
		usedFor:
			'Crafting (rings and trinkets), Producer, Extractor and Idol upgrades from level 3, and the castle from level 7 (sells to the merchant for just 5 gold).',
		source: 'The Ice Cutter on a tundra tile. Sells to the merchant (he does not sell it back).',
		color: '#8fdcff',
		craftValue: 50,
		merchant: { price: 5, description: 'Glittering shards cut from the ice.', pitch: 'Enchanters like the cold glow.' },
	},
	pearls: {
		stored: true,
		optionalInSave: true,
		tier: 't3',
		emoji: '🦪',
		label: 'Pearls',
		description: 'A crafting extract of the lakes.',
		usedFor:
			'Crafting (rings and trinkets), Producer, Extractor and Idol upgrades from level 3, and the castle from level 7 (sells to the merchant for just 5 gold).',
		source: 'The Pearl Diver on a lake tile. Sells to the merchant (he does not sell it back).',
		color: '#f0e8f8',
		craftValue: 50,
		merchant: { price: 5, description: 'Pearls from the lake bed.', pitch: 'Jewellers pay a fair price.' },
	},
	salt: {
		stored: true,
		optionalInSave: true,
		tier: 't3',
		emoji: '🧂',
		label: 'Salt',
		description: 'A crafting extract of the coast.',
		usedFor:
			'Crafting (leather armor), Producer, Extractor and Idol upgrades from level 3, and the castle from level 7 (sells to the merchant for just 5 gold).',
		source: 'The Salt Works on a coast tile. Sells to the merchant (he does not sell it back).',
		color: '#f4f0e4',
		craftValue: 50,
		merchant: { price: 5, description: 'Coarse salt from the coast.', pitch: 'Every kitchen and tannery needs it.' },
	},
	wool: {
		stored: true,
		optionalInSave: true,
		farm: true,
		tier: 't1',
		emoji: '🧶',
		label: 'Wool',
		description: 'A farm product sheared from sheep: the cloth material of the future cloth armour.',
		usedFor: 'Shearing Shed upgrades; sell the rest to the merchant.',
		source: 'Sheep on the farm. Cannot be bought.',
		color: '#e8dcc0',
		merchant: { price: 2, description: 'Soft, clean fleece from the pasture.', pitch: 'Weavers pay well for good wool.' },
	},
	venom: {
		stored: true,
		optionalInSave: true,
		tier: 't3',
		emoji: '🐍',
		label: 'Venom',
		description: 'A crafting extract of the jungle.',
		usedFor: 'Crafting (coatings, poisons and elixirs), Producer, Extractor and Idol upgrades from level 3 (sells to the merchant for just 5 gold).',
		source: 'The Venom Press on a jungle tile. Sells to the merchant (he does not sell it back).',
		color: '#7ad84a',
		craftValue: 50,
		merchant: { price: 5, description: 'Poison milked from jungle vipers.', pitch: 'Alchemists and assassins pay for it.' },
	},
	dye: {
		stored: true,
		optionalInSave: true,
		tier: 't3',
		emoji: '🎨',
		label: 'Dye',
		description: 'A crafting extract of the fields.',
		usedFor: 'Crafting (cloaks, cloth armor and elixirs), Producer, Extractor and Idol upgrades from level 3 (sells to the merchant for just 5 gold).',
		source: 'The Dye Works on a fields tile. Sells to the merchant (he does not sell it back).',
		color: '#e0609a',
		craftValue: 50,
		merchant: { price: 5, description: 'Bright dye pressed from field flowers and roots.', pitch: 'Tailors always want more colour.' },
	},
	royalJelly: {
		stored: true,
		optionalInSave: true,
		tier: 't3',
		emoji: '🍯',
		label: 'Royal Jelly',
		description: 'A crafting extract of the orchard.',
		usedFor: 'Crafting (potions, tonics and rings), Producer, Extractor and Idol upgrades from level 3 (sells to the merchant for just 5 gold).',
		source: 'The Royal Apiary on a orchard tile. Sells to the merchant (he does not sell it back).',
		color: '#ffd86a',
		craftValue: 50,
		merchant: { price: 5, description: 'A rich jelly from the orchard hives.', pitch: 'Physicians swear by it.' },
	},
	corruptedCore: {
		stored: true,
		optionalInSave: true,
		tier: 't3',
		emoji: '🕳️',
		label: 'Corrupted Core',
		description: 'A crafting extract of the Blight.',
		usedFor: 'Crafting (distilling Ichor for the enchant craft), Producer, Extractor and Idol upgrades from level 3 (sells to the merchant for just 5 gold).',
		source: 'The Core Siphon on a blight tile. Sells to the merchant (he does not sell it back).',
		color: '#8a4ac8',
		craftValue: 50,
		merchant: { price: 5, description: 'A pulsing knot of the Blight.', pitch: 'Curious, and a little frightening, to buy.' },
	},
	scrapSteel: {
		stored: true,
		optionalInSave: true,
		tier: 't3',
		emoji: '🔩',
		label: 'Scrap Steel',
		description: 'A crafting extract of the Battlefield.',
		usedFor:
			'Crafting (forging War Medals for the legendary recipes), Producer, Extractor and Idol upgrades from level 3 (sells to the merchant for just 5 gold).',
		source: 'The Scrap Forge on a battlefield tile. Sells to the merchant (he does not sell it back).',
		color: '#9aa8b8',
		craftValue: 50,
		merchant: { price: 5, description: 'Twisted steel salvaged from old battlefields.', pitch: 'Smiths melt it down gladly.' },
	},
} as const satisfies Record<string, ResourceDef>;

export type ResourceKey = keyof typeof RESOURCES;

/** The resources the merchant buys */
export type MerchantResourceKey = {
	[K in ResourceKey]: (typeof RESOURCES)[K] extends { merchant: object } ? K : never;
}[ResourceKey];

/** Every resource in catalog order: the one order any list of resources (costs, rewards) is shown in */
export const RESOURCE_ORDER = Object.keys(RESOURCES) as ResourceKey[];

const RESOURCE_RANK = new Map<string, number>(RESOURCE_ORDER.map((key, index) => [key, index]));

/** The entries of a cost bundle that are worth showing (> 0), in catalog order, whatever order the bundle was built in */
export const sortedCostEntries = <K extends string>(cost: Partial<Record<K, number>>): [K, number][] =>
	(Object.entries(cost) as [K, number | undefined][])
		.filter((entry): entry is [K, number] => (entry[1] ?? 0) > 0)
		.sort(([a], [b]) => (RESOURCE_RANK.get(a) ?? RESOURCE_ORDER.length) - (RESOURCE_RANK.get(b) ?? RESOURCE_ORDER.length));

/** The resources of one tier, in catalog order (the header lists them left to right) */
export const resourcesInTier = (tier: ResourceTier): ResourceKey[] =>
	(Object.keys(RESOURCES) as ResourceKey[]).filter((key) => (RESOURCES[key] as ResourceDef).tier === tier);

/** What a unit of a resource counts for in a recipe's cost: its `craftValue`, else what the merchant pays. */
export const craftValueOf = (key: MerchantResourceKey): number => {
	const def: { craftValue?: number; merchant: { price: number } } = RESOURCES[key];
	return def.craftValue ?? def.merchant.price;
};
