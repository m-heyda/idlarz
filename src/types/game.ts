import { BIOMES } from '@/config/gameConfig';

export type BiomeType = keyof typeof BIOMES;

export interface Resources {
	gold: number;
	wood: number;
	stone: number;
	coal: number;
	food: number;
	xp: number;
}

export interface CharacterStats {
	strength: number;
	dexterity: number;
	intelligence: number;
	vitality: number;
	charisma: number;
	availablePoints: number;
	// Combat stats
	physicalAtk: number;
	magicAtk: number;
	hp: number;
	mp: number;
	def: number;
	magicDef: number;
	luck: number;
	critChance: number;
	critDmgMultiplier: number;
	atkSpeedIncrease: number;
	xpGainMultiplier: number;
	tileCostDiscount: number;
	reputation: number;
}

export interface ResourceRates {
	base: Resources;
	modifiers: Resources;
	total: Resources;
}

export interface BiomeInfo {
	name: BiomeType;
	label: string;
	baseColor: string;
	resourceGeneration: Partial<Resources>;
	resourceIcons: string[];
	unique?: boolean;
	upgradeable?: boolean;
	maxLevel?: number;
	description?: string;
}

export interface Tile {
	biome: BiomeType;
	isOwned: boolean;
	level?: number;
	upgradeCost?: Resources;
}

export type EquipmentSlot =
	| 'head'
	| 'neck'
	| 'chest'
	| 'mainHand'
	| 'offHand'
	| 'legs'
	| 'feet'
	| 'ring1'
	| 'ring2';

export type EquipmentRarity =
	| 'common'
	| 'uncommon'
	| 'rare'
	| 'epic'
	| 'legendary';

export type Equipment = {
	[key in EquipmentSlot]?: Item;
};

export interface Item {
	id: string;
	name: string;
	icon: string;
	slot: EquipmentSlot;
	stats: Partial<Resources>;
	description?: string;
	rarity?: EquipmentRarity;
}

export interface GameState {
	previousLevel: number;
	tiles: Tile[][];
	resources: Resources;
	resourceRates: ResourceRates;
	resourceModifiers: Resources;
	level: {
		level: number;
		progress: number;
	};
	playerName: string;
	characterStats: CharacterStats;
	equipment: Equipment;
	inventory: Item[];
	showCharacterWindow: boolean;
	showStatisticsWindow: boolean;
	showMerchantWindow: boolean;
	isHydrated: boolean; // Flag to track if store is rehydrated from localStorage
	buyTile: (x: number, y: number) => boolean;
	upgradeCastle: () => boolean;
	tick: (deltaTime: number) => void;
	toggleCharacterWindow: () => void;
	toggleStatisticsWindow: () => void;
	toggleMerchantWindow: () => void;
	sellResources: (resource: keyof Resources, amount: number) => number | undefined;
	addStatPoint: (stat: keyof CharacterStats) => void;
	setPlayerName: (name: string) => void;
	addResources: (resourceToAdd: Partial<Resources>) => void;
}
