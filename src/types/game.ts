import { BIOMES } from '@/config/gameConfig';
import type { PlayerClassId } from '@/config/playerClasses';
import type { LegacyUpgradeId } from '@/config/gameConfig';
import type { PixelIconName } from '@/config/pixelIcons';

export type BiomeType = keyof typeof BIOMES;

export interface Resources {
	gold: number;
	wood: number;
	stone: number;
	coal: number;
	food: number;
	meat: number;
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
	description?: string;
}

export interface Tile {
	biome: BiomeType;
	isOwned: boolean;
	level?: number;
	upgradeCost?: Partial<Resources>;
	building?: string;
	hasChest?: boolean;
}

export type EquipmentSlot =
	| 'head'
	| 'shoulder'
	| 'chest'
	| 'hands'
	| 'legs'
	| 'feet'
	| 'neck'
	| 'cape'
	| 'ring1'
	| 'ring2'
	| 'charm'
	| 'mainHand'
	| 'offHand';

export type EquipmentRarity =
	| 'common'
	| 'uncommon'
	| 'rare'
	| 'epic'
	| 'legendary';

export interface ItemStats {
	damage?: number;
	armor?: number;
	maxHp?: number;
}

/** Static definition of an item; saves only ever store the `id`. */
export interface ItemDef {
	id: string;
	name: string;
	/** Gear slot; 'ring' fits ring1 or ring2. Consumables have none. */
	slot?: EquipmentSlot | 'ring';
	rarity: EquipmentRarity;
	stats?: ItemStats;
	set?: string;
	description?: string;
	consumable?: { healHp: number };
	stackMax?: number;
	sellValue: number;
	icon?: PixelIconName;
}

/** Equipped item ids by slot */
export type Equipment = Partial<Record<EquipmentSlot, string>>;

export type BagSlot = { id: string; qty: number } | null;

export type MonsterType = 'rat' | 'ratKing';

export interface Monster {
	id: number;
	type: MonsterType;
	tier: number;
	x: number;
	y: number;
	ageSec: number;
}

export interface KillSummary {
	gold: number;
	xp: number;
	items: { id: string; qty: number }[];
	/** Gold paid for drops that did not fit into the bag */
	convertedGold: number;
}

export type FightPhase = 'active' | 'won' | 'knockedOut' | 'timeout';

export interface FightState {
	monsterId: number;
	type: MonsterType;
	tier: number;
	monsterHp: number;
	monsterMaxHp: number;
	attackTimer: number;
	timeLeftSec: number | null;
	potionCd: number;
	phase: FightPhase;
	summary: KillSummary | null;
	taunt: string | null;
}

export interface TileProps {
	biome: BiomeType;
	isOwned: boolean;
	x: number;
	y: number;
	style: React.CSSProperties;
	level?: number;
	building?: string;
}

export type MerchantTab =
	| 'exchange'
	| 'buy'
	| 'upgrade'
	| 'quests'
	| 'gambling';

export interface MerchantTabInfo {
	id: MerchantTab;
	label: string;
	emoji: string;
	description: string;
}

// Farm
export interface Animal {
	id: string;
	name: string;
	description: string;
	baseCost: number;
	costScaling: number;
	baseProduction: number; // meat/s per animal; every purchase adds one more animal
}

// One physical click, as seen by the click limiter. `eventId` is shared by every handler of the same DOM event.
export interface ClickInput {
	eventId: number;
	now: number; // ms, monotonic
	trusted: boolean;
}

// Castle upgrades are timed builds; the clock is advanced by the tick loop (not by Date.now)
export interface CastleUpgradeState {
	toLevel: number;
	remainingSec: number;
}

// What buying the next tile costs
export interface TileCost {
	gold: number;
	resources: Partial<Resources>;
}

// Rebirth / Legacy (kept across rebirths)
export interface PrestigeState {
	rebirths: number;
	legacyPoints: number; // unspent
	legacyEarned: number; // ever earned; drives the income bonus. earned = unspent + cost of all shop levels
	upgrades: Partial<Record<LegacyUpgradeId, number>>;
}

// A bonus critter that was clicked (farm meadow or map)
export interface CritterGift {
	source: 'farm' | 'map';
	type: 'butterfly' | 'bee' | 'ladybug' | 'rabbit';
	golden: boolean;
}

export interface GiftResult {
	resource: keyof Resources;
	amount: number;
}

export interface TapResult {
	items: { resource: keyof Resources; amount: number }[];
	lucky: boolean;
}

export interface GameState {
	previousLevel: number;
	tiles: Tile[][];
	resources: Resources;
	resourceRates: ResourceRates;
	level: {
		level: number;
		progress: number;
	};
	playerName: string;
	playerClass: PlayerClassId;
	characterStats: CharacterStats;
	equipment: Equipment;
	bag: BagSlot[];
	playerHp: number;
	monsters: Monster[];
	monsterSpawnTimer: number;
	nextMonsterId: number;
	fight: FightState | null; // transient: never saved
	farmLevels: Record<string, number>;
	showCharacterWindow: boolean;
	showStatisticsWindow: boolean;
	showMerchantWindow: boolean;
	showFarmWindow: boolean;
	isHydrated: boolean;
	biomeSelectionActive: boolean;
	pendingTileCoords: { x: number; y: number } | null;
	selectableBiomes: BiomeType[] | null;
	prestige: PrestigeState;
	clickLevel: number; // Index into CLICK_LADDER (gold per click = gold/s x power)
	castleUpgrade: CastleUpgradeState | null;
	playSeconds: number; // accumulated game time (tick deltas); kept for save plausibility checks
	chestSpawnTimer: number;
	activeChests: number;
	lastChestReward: number;
	lastChestGoldRate: number;
	lastChestMinutesAwarded: number;

	// Methods
	buyTile: (x: number, y: number) => boolean;
	buyClickUpgrade: () => boolean;
	buyResource: (resource: keyof Resources, amount: number) => boolean;
	clickForGold: (input: ClickInput) => number;
	resetGame: () => void;
	rebirth: () => boolean;
	buyLegacyUpgrade: (id: LegacyUpgradeId) => boolean;
	claimCritterGift: (gift: CritterGift, input: ClickInput) => GiftResult | null;
	selectBiome: (biome: BiomeType) => boolean;
	cancelBiomeSelection: () => void;
	upgradeCastle: () => boolean;
	purchaseAnimal: (animalId: string) => boolean;
	upgradeGroundsTile: (x: number, y: number, buildingType: string) => boolean;
	tick: (deltaTime: number) => void;
	toggleCharacterWindow: () => void;
	toggleStatisticsWindow: () => void;
	toggleMerchantWindow: () => void;
	toggleFarmWindow: () => void;
	setShowFarmWindow: (show: boolean) => void;
	sellResources: (resource: keyof Resources, amount: number) => boolean;
	addStatPoint: (stat: keyof CharacterStats) => void;
	setPlayerName: (name: string) => void;
	setPlayerClass: (playerClass: PlayerClassId) => void;
	addResources: (resourceToAdd: Partial<Resources>) => void;
	collectChest: (x: number, y: number) => boolean;
	equipItem: (bagIndex: number) => boolean;
	unequipItem: (slot: EquipmentSlot) => boolean;
	moveBagItem: (from: number, to: number) => boolean;
	// Tap an owned tile: grants a slice of its output. Returns null while on cooldown / nothing to give.
	tapTile: (x: number, y: number, input?: ClickInput) => TapResult | null;
}
