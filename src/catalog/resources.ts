/**
 * Every resource and currency the player can hold: what it is called, how it looks, what it is for and where it comes
 * from, what the merchant pays. The header tooltips, the merchant windows, the floating "+N" popups and the icon
 * fallbacks all read this one table (gameConfig.ts derives its old RESOURCE_ICONS / HEADER_* / MERCHANT_* views from it).
 * Rates, costs and prices-per-level stay in gameConfig.ts: those are balance numbers, not catalog data.
 */
export interface ResourceDef {
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
		emoji: '💰',
		label: 'Gold',
		description: 'The coin of the realm.',
		usedFor: 'Buying map tiles, buildings, castle upgrades, click power and everything at the merchant.',
		source: 'The castle and most land, every click on the map, and selling goods to the merchant.',
		color: '#ffe27a',
	},
	wood: {
		emoji: '🪓',
		label: 'Wood',
		description: 'Basic construction material.',
		usedFor: 'Part of the price of tiles (from the 15th), buildings, castle upgrades, Hen House and Pen Expansion.',
		source: 'Forest and swamp tiles. Sells to the merchant.',
		color: '#e0b078',
		merchant: { price: 0.5, description: 'A basic construction material, available in forests.', pitch: 'Common but always in demand.' },
	},
	stone: {
		emoji: '🧱',
		label: 'Stone',
		description: 'Durable building material.',
		usedFor: 'Part of the price of tiles (from the 15th), buildings, castle upgrades, Dairy and Pen Expansion.',
		source: 'Hills tiles. Sells to the merchant.',
		color: '#d4cdb8',
		merchant: { price: 0.5, description: 'Durable and versatile building material from quarries.', pitch: 'Premium quality building material.' },
	},
	coal: {
		emoji: '⚫',
		label: 'Coal',
		description: 'Fuel for heavy industry.',
		usedFor: 'Part of the price of tiles (from the 30th), castle upgrades from level 3 and the Tannery.',
		source: 'Tundra and hills tiles. Sells to the merchant.',
		color: '#9fb4e8',
		merchant: { price: 1, description: 'Valuable fuel source used for advanced applications.', pitch: 'Highly sought after for its energy properties.' },
	},
	food: {
		emoji: '🌾',
		label: 'Food',
		description: 'Sustains your people and your animals.',
		usedFor: 'Buying farm animals, Feed Trough, Pen Expansion, tiles (from the 40th) and castle upgrades from level 4.',
		source: 'Plains, lake and coast tiles. Sells to the merchant.',
		color: '#f4d25a',
		merchant: { price: 0.75, description: 'Sustains population and enables growth.', pitch: 'Plentiful but essential for survival.' },
	},
	meat: {
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
		emoji: '🥚',
		label: 'Eggs',
		description: 'A farm product laid by chickens.',
		usedFor: 'Hen House upgrades; sell the rest to the merchant.',
		source: 'Chickens on the farm. Cannot be bought.',
		color: '#f4e6c4',
		merchant: { price: 2, description: 'Fresh from the coop.', pitch: 'Bakers pay well for fresh eggs.' },
	},
	milk: {
		emoji: '🥛',
		label: 'Milk',
		description: 'A farm product from cows.',
		usedFor: 'Dairy upgrades; sell the rest to the merchant.',
		source: 'Cows on the farm. Cannot be bought.',
		color: '#e8f0fa',
		merchant: { price: 3, description: 'Creamy and cold from the dairy.', pitch: 'A town favourite at breakfast.' },
	},
	hide: {
		emoji: '🟫',
		label: 'Hide',
		description: 'A farm product from deer and pigs.',
		usedFor: 'Tannery upgrades; sell the rest to the merchant.',
		source: 'Deer and pigs on the farm. Cannot be bought.',
		color: '#c89868',
		merchant: { price: 4, description: 'Tanned leather from the farm.', pitch: 'Craftsmen always need good leather.' },
	},
	xp: {
		emoji: '✨',
		label: 'XP',
		description: 'Experience: fills the level bar next to your name.',
		usedFor: 'Every level gives stat points to spend on the Stats tab.',
		source: 'The castle, buying tiles and your stats.',
		color: '#c4a0ff',
	},
	// The rebirth currency (not in Resources: it lives in the prestige state)
	legacy: {
		emoji: '🔮',
		label: 'Legacy',
		description: 'The rebirth currency.',
		usedFor: 'Permanent upgrades in the Legacy window; they survive every rebirth.',
		source: 'Rebirthing from castle level 6: the higher your castle and income, the more you get.',
		color: '#6ae88a',
	},
	// The premium currency (not in Resources: it is its own gems balance in the game state)
	gems: {
		emoji: '💎',
		label: 'Gems',
		description: 'Rare gems. Everyone starts with a purse of them.',
		usedFor: 'Upgrades (coming soon). They are never lost by a rebirth.',
		source: 'Your starting purse; more ways to earn them are coming.',
		color: '#7fd8ff',
	},
} as const satisfies Record<string, ResourceDef>;

export type ResourceKey = keyof typeof RESOURCES;

/** The resources the merchant buys */
export type MerchantResourceKey = {
	[K in ResourceKey]: (typeof RESOURCES)[K] extends { merchant: object } ? K : never;
}[ResourceKey];
