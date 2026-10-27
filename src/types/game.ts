import { BIOMES } from '@/config/gameConfig';
import type { PlayerClassId } from '@/config/playerClasses';
import type { FarmUpgradeId, LegacyUpgradeId, MerchantUpgradeId } from '@/config/gameConfig';
import type { PixelIconName } from '@/config/pixelIcons';
import type { ItemStats } from '@/catalog/stats';
import type { SkillId } from '@/catalog/skills';
import type { CritKind } from '@/lib/combat';
import type { World } from '@/utils/world';

export type { ItemStats };

export type BiomeType = keyof typeof BIOMES;

export interface Resources {
	gold: number;
	wood: number;
	stone: number;
	coal: number;
	food: number;
	meat: number;
	eggs: number; // farm products: produced by animals, sold to the merchant, spent on farm upgrades
	milk: number;
	hide: number;
	xp: number;
}

export interface CharacterStats {
	strength: number;
	dexterity: number;
	intelligence: number;
	vitality: number;
	charisma: number;
	availablePoints: number;
	// Derived stats (never saved: rebuilt by calculateCombatStats from the five attributes)
	physicalAtk: number; // % more damage with physical weapons (0 at the start: bonuses count points above 5)
	magicAtk: number; // % more damage with magic weapons
	hp: number;
	mp: number; // mana before gear
	def: number; // armor the attributes add to the gear's
	luck: number;
	critChance: number;
	critDmgMultiplier: number; // % for lucky tile taps (fights use statBonuses.critDamagePercent)
	atkSpeedIncrease: number; // % attack speed
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

export type ItemKind = 'weapon' | 'offhand' | 'armor' | 'accessory' | 'consumable';

export type WeaponType = 'sword' | 'dagger' | 'mace' | 'maul' | 'axe' | 'spear' | 'bow' | 'crossbow' | 'staff' | 'wand' | 'shield' | 'tome';

/** Static definition of an item; saves only ever store the `id`. Everything about an item lives here (see src/catalog). */
export interface ItemDef {
	id: string;
	name: string;
	kind: ItemKind;
	/** Gear slot; 'ring' fits ring1 or ring2. Consumables have none. */
	slot?: EquipmentSlot | 'ring';
	rarity: EquipmentRarity;
	/** Grade of the material family: 1 wooden / cloth, 2 steel, 3 obsidian, 4 Rattatui, 5 legendary (consumables: 0) */
	tier: number;
	weaponType?: WeaponType;
	/** Weapons only: attacks per second. Not a summed stat; the base for attack-speed combat (catalog `weaponDps`) */
	attackSpeed?: number;
	stats?: ItemStats;
	set?: string;
	description?: string;
	consumable?: { healHp: number };
	stackMax?: number;
	sellValue: number;
	icon?: PixelIconName;
	/** Merchant price in gold; absent = not sold */
	shop?: number;

	// ---- loot generation (see src/lib/loot and docs/10-loot-system.md); gear only ----
	/** false takes the item out of every loot pool (and stops saves from holding it); default true */
	enabled?: boolean;
	/** `base`: a generic item that drops at any level inside its window with a rolled rarity. `named`: a fixed-identity item. */
	generation?: 'base' | 'named';
	/** Pool selectors: `weapon`, `sword`, `knight`... pools match items by these (or by explicit id) */
	tags?: string[];
	/** Item level window the item can be generated in; `stats` are authored at `minItemLevel` */
	minItemLevel?: number;
	maxItemLevel?: number;
	/** Bases: rarities this base may roll as */
	allowedRarities?: string[];
	/** Named items: the rarity every instance has */
	fixedRarity?: string;
	/** Relative chance inside a pool, after the rarity is known */
	poolWeight?: number;
	/** Loot pool ids a named item or a consumable belongs to (bases are matched by tags instead) */
	pools?: string[];
}

/** One rolled affix on an item: which affix and how well it rolled (0-100 inside its value range). Values are derived. */
export interface AffixRoll {
	id: string;
	roll: number;
}

/**
 * A dropped or owned piece of gear. Only the choices are stored; stats are derived from the catalog and the level curve
 * (`resolveItem`), so retuning the curve retunes existing items and a save can only describe items the generator could make.
 */
export interface ItemInstance {
	/** Id of the item definition (base or named) */
	base: string;
	/** Item level 1..100: its power, from the source that dropped it */
	level: number;
	/** Rarity id (a key of RARITIES) */
	rarity: string;
	/** Base-stat quality roll 0-100; 50 is the authored value */
	quality: number;
	affixes: AffixRoll[];
}

/** Equipped gear by slot: instances (rolled rarity, level, quality, affixes) */
export type Equipment = Partial<Record<EquipmentSlot, ItemInstance>>;

/** A bag slot holds one piece of gear (an instance) or a stack of a consumable */
export type BagSlot = { item: ItemInstance } | { id: string; qty: number } | null;

/** One thing a kill, chest or shop hands over: a piece of gear, or some of a consumable */
export type Drop = { kind: 'gear'; item: ItemInstance } | { kind: 'consumable'; id: string; qty: number };

export type MonsterType = 'rat' | 'ratKing';

export interface Monster {
	id: number;
	type: MonsterType;
	/** Its level now: `spawnLevel` plus the growth its age has earned (capped by the growth limit) */
	level: number;
	/** The level it appeared at */
	spawnLevel: number;
	x: number;
	y: number;
	ageSec: number;
}

export interface KillSummary {
	gold: number;
	xp: number;
	items: Drop[];
	/** Gold paid for drops that did not fit into the bag */
	convertedGold: number;
	/** Gear the auto-sell filter sold on the spot: how many pieces and for how much gold */
	autoSold: { count: number; gold: number };
}

export type FightPhase = 'active' | 'won' | 'knockedOut' | 'timeout';

export interface FightState {
	monsterId: number;
	type: MonsterType;
	/** The monster's level when the fight started: its HP, attack and armor stay what that level gave for the whole fight */
	level: number;
	monsterHp: number;
	monsterMaxHp: number;
	attackTimer: number;
	timeLeftSec: number | null;
	potionCd: number;
	/** Seconds the monster stays stunned: its attack timer does not run (the King's time limit does) */
	stunLeftSec: number;
	phase: FightPhase;
	summary: KillSummary | null;
	taunt: string | null;
}

export interface TileProps {
	biome: BiomeType;
	isOwned: boolean;
	x: number;
	y: number;
	level?: number;
	building?: string;
	/** For a tile that is not explored yet: whether the next tile is affordable (the map works that out once for all of them) */
	canAfford?: boolean;
}

export type MerchantTab =
	| 'resources'
	| 'goods'
	| 'upgrades'
	| 'quests'
	| 'gambling';

/** The merchant's shuffling shelf: gear offers rolled at `at` (play seconds); the price is derived from the item, never saved */
export interface MerchantStock {
	at: number;
	offers: ItemInstance[];
}

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
	product: { resource: FarmProduct; perSec: number }; // a farm product trickling out of every animal
}

export type FarmProduct = 'eggs' | 'milk' | 'hide';

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

import type { ChestLoot } from '@/lib/chests';

export interface GameState {
	previousLevel: number;
	tiles: World; // the explored map: sparse, unbounded (see src/utils/world.ts)
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
	/** Mana: spent by skills, refills over time (persisted; clamped to the max on load) */
	playerMp: number;
	/** Seconds left on each skill's cooldown (transient: a cooldown never outlives the tab) */
	skillCd: Partial<Record<SkillId, number>>;
	monsters: Monster[];
	monsterSpawnTimer: number;
	/** Seconds towards the next boss (counts only while no boss is on the map and there is room) */
	bossSpawnTimer: number;
	nextMonsterId: number;
	fight: FightState | null; // transient: never saved
	farmLevels: Record<string, number>; // animals owned per kind
	farmUpgrades: Record<string, number>; // level per FARM_UPGRADES id
	merchantUpgrades: Record<string, number>; // level per MERCHANT_UPGRADES id
	merchantStock: MerchantStock | null; // the goods on offer (null until the first shelf is rolled)
	merchantRefreshes: number; // paid shelf refreshes bought this run: each one costs more (see MERCHANT_GOODS.refresh)
	isHydrated: boolean;
	freeTiles: number; // owned tiles that cost nothing (castle + starting ring); see economyTiles()
	prestige: PrestigeState;
	clickLevel: number; // Index into CLICK_LADDER (gold per click = gold/s x power)
	castleUpgrade: CastleUpgradeState | null;
	playSeconds: number; // accumulated game time (tick deltas); kept for save plausibility checks
	chestSpawnTimer: number;
	activeChests: number;
	/** Gems: the premium currency (starts at STARTING_GEMS, survives a rebirth). Separate from the Legacy points of `prestige`. */
	gems: number;
	/** Bad-luck protection counters of the loot tables, by `profile:table` (see catalog/lootConfig `pity`) */
	lootPity: Record<string, number>;
	/** Gear of this rarity or lower is sold the moment it drops (a rarity id); null = keep everything */
	autoSellUpTo: string | null;
	lastChestLoot: ChestLoot | null; // transient: the last chest's contents, shown by the toast (never saved)

	// Methods
	setAutoSell: (rarity: string | null) => void;
	buyTile: (x: number, y: number) => boolean;
	buyClickUpgrade: () => boolean;
	buyResource: (resource: keyof Resources, amount: number) => boolean;
	clickForGold: (input: ClickInput) => number;
	resetGame: () => void;
	rebirth: () => boolean;
	buyLegacyUpgrade: (id: LegacyUpgradeId) => boolean;
	claimCritterGift: (gift: CritterGift, input: ClickInput) => GiftResult | null;
	upgradeCastle: () => boolean;
	purchaseAnimal: (animalId: string, count?: number | 'max') => number; // animals bought
	buyFarmUpgrade: (id: FarmUpgradeId) => boolean;
	buyMerchantUpgrade: (id: MerchantUpgradeId) => boolean;
	sellItem: (bagIndex: number, qty?: number) => number; // sells `qty` (default 1) of the stack; returns the gold paid (0 = nothing sold)
	discardItem: (bagIndex: number, qty?: number) => boolean; // throws away `qty` (default 1) of the stack for nothing; refused during a fight
	sellJunk: (maxRarity: string) => { gold: number; count: number };
	buyItem: (id: string, qty?: number) => boolean;
	buyOffer: (index: number) => boolean;
	refreshMerchantStock: () => boolean;
	buildOnTile: (x: number, y: number, buildingType: string) => boolean;
	tick: (deltaTime: number) => void;
	sellResources: (resource: keyof Resources, amount: number) => boolean;
	addStatPoint: (stat: keyof CharacterStats) => boolean;
	setPlayerName: (name: string) => void;
	setPlayerClass: (playerClass: PlayerClassId) => void;
	/** Gives a brand-new game (no play time, default name) the account's name and hero; any played game is left alone. */
	applyProfileToFreshGame: (name: string, playerClass: PlayerClassId) => boolean;
	addResources: (resourceToAdd: Partial<Resources>) => void;
	collectChest: (x: number, y: number) => boolean;
	startFight: (monsterId: number) => boolean;
	hitMonster: (input: ClickInput) => { damage: number; killed: boolean; crit: CritKind } | null;
	leaveFight: () => void;
	dismissMonster: (id: number) => boolean; // removes a monster from the map, no loot; false for the one being fought
	drinkPotion: (bagIndex: number) => boolean;
	castSkill: (id: SkillId) => boolean;
	equipItem: (bagIndex: number) => boolean;
	unequipItem: (slot: EquipmentSlot) => boolean;
	moveBagItem: (from: number, to: number) => boolean;
	organizeBag: () => boolean;
	// Tap an owned tile: grants a slice of its output. Returns null while on cooldown / nothing to give.
	tapTile: (x: number, y: number, input?: ClickInput) => TapResult | null;
}
