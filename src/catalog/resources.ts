/**
 * Every resource and currency the player can hold: what it is called, how it looks, what it is for and where it comes
 * from, what the merchant pays. The header tooltips, the merchant windows, the floating "+N" popups and the icon
 * fallbacks all read this one table (gameConfig.ts derives its old RESOURCE_ICONS / HEADER_* / MERCHANT_* views from it).
 * Rates, costs and prices-per-level stay in gameConfig.ts: those are balance numbers, not catalog data.
 */
/**
 * The header shows one boxed group per tier, left to right. A new tier is one entry here plus its resources' `tier`.
 * currency: gold, gems and Embers. t0: the base materials the land produces. t1: the farm products.
 */
export type ResourceTier = 'currency' | 't0' | 't1';

export const RESOURCE_TIERS: readonly { id: ResourceTier; label: string }[] = [
	{ id: 'currency', label: 'Currency' },
	{ id: 't0', label: 'Base materials' },
	{ id: 't1', label: 'T1 materials' },
];

export interface ResourceDef {
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
}

export const RESOURCES = {
	gold: {
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
		tier: 't1',
		emoji: '🟫',
		label: 'Hide',
		description: 'A farm product from deer and pigs.',
		usedFor: 'Tannery upgrades and the price of big territories; sell the rest to the merchant.',
		source: 'Deer and pigs on the farm, and the rats you beat. Cannot be bought.',
		color: '#c89868',
		merchant: { price: 2, description: 'Tanned leather from the farm.', pitch: 'Craftsmen always need good leather.' },
	},
	xp: {
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
		color: '#6ae88a',
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
