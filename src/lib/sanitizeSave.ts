import { PLAYER_CLASSES, DEFAULT_PLAYER_CLASS, type PlayerClassId } from '@/config/playerClasses';
import {
	ANIMALS,
	BIOMES,
	BUILDINGS,
	BUILDING_COST,
	CASTLE_UPGRADE,
	GEMS_CAP,
	STARTING_GEMS,
	CLICK_LADDER,
	DEFAULT_PLAYER_NAME,
	FARM_UPGRADES,
	MERCHANT_GOODS,
	MERCHANT_UPGRADES,
	CASTLE_X,
	CASTLE_Y,
	LEGACY_GRID_SIZE,
	INITIAL_CHARACTER_STATS,
	INITIAL_RESOURCES,
	EMBER_UPGRADES,
	RESOURCE_CAP,
	XP_CAP,
	type FarmUpgradeId,
	type EmberUpgradeId,
	type MerchantUpgradeId,
} from '@/config/gameConfig';
import { COMBAT } from '@/config/combatConfig';
import { EQUIPMENT_LAYOUT, ITEM_CATALOG, LOOT_PROFILES, RARITIES, STARTER_EQUIPMENT } from '@/config/itemCatalog';
import { instanceProblem } from '@/lib/itemInstance';
import { maxHp, maxMana } from '@/lib/combat';
import { starterBag } from '@/lib/inventory';
import { limitOf } from '@/lib/limits';
import {
	calculateCombatStats,
	calculateLevel,
	totalStatPoints,
	calculateXpGain,
	castleUpgradeDuration,
	EMPTY_PRESTIGE,
	emberSpent,
	STARTER_FREE_TILES,
} from '@/utils/gameUtils';
import { RING } from '@/utils/biomeRules';
import {
	EMPTY_WORLD,
	MAX_OWNED_TILES,
	inRange,
	keyX,
	keyY,
	setTiles,
	tileKey,
	type Placed,
} from '@/utils/world';
import type {
	BagSlot,
	CastleUpgradeState,
	CharacterStats,
	Equipment,
	EquipmentSlot,
	GameState,
	ItemInstance,
	MerchantStock,
	PrestigeState,
	Resources,
	Tile,
} from '@/types/game';

/** The part of the game state that is saved. Rates, window flags and the like are recomputed on load. */
export const PERSISTED_KEYS = [
	'tiles',
	'resources',
	'level',
	'previousLevel',
	'playerName',
	'playerClass',
	'characterStats',
	'farmLevels',
	'farmUpgrades',
	'merchantUpgrades',
	'clickLevel',
	'castleUpgrade',
	'prestige',
	'freeTiles',
	'playSeconds',
	'activeChests',
	'gems',
	'equipment',
	'bag',
	'playerHp',
	'playerMp',
	'lootPity',
	'autoSellUpTo',
	'merchantStock',
	'merchantRefreshes',
] as const;

export type PersistedGame = Pick<GameState, (typeof PERSISTED_KEYS)[number]>;

export const pickPersisted = (state: GameState): PersistedGame => {
	const out: Record<string, unknown> = {};
	PERSISTED_KEYS.forEach((key) => {
		out[key] = state[key];
	});
	return out as unknown as PersistedGame;
};

export type SanitizeResult =
	| { ok: true; state: PersistedGame }
	| { ok: false; reason: string };

const fail = (reason: string): SanitizeResult => ({ ok: false, reason });

const isObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

/** A saved piece of gear, rebuilt field by field (nothing else survives), or the reason it is not valid. */
const readInstance = (value: unknown): ItemInstance | string => {
	if (!isObject(value)) return 'not an item';
	for (const key of Object.keys(value)) if (!INSTANCE_KEYS.has(key)) return 'unknown field';
	if (typeof value.base !== 'string' || typeof value.rarity !== 'string' || !Array.isArray(value.affixes)) return 'malformed';
	const affixes: ItemInstance['affixes'] = [];
	for (const a of value.affixes) {
		if (!isObject(a)) return 'malformed affix';
		for (const key of Object.keys(a)) if (!AFFIX_KEYS.has(key)) return 'unknown affix field';
		if (typeof a.id !== 'string' || typeof a.roll !== 'number') return 'malformed affix';
		affixes.push({ id: a.id, roll: a.roll });
	}
	const item: ItemInstance = { base: value.base, level: value.level as number, rarity: value.rarity, quality: value.quality as number, affixes };
	return instanceProblem(item) ?? item;
};

const num = (v: unknown, min = 0, max = RESOURCE_CAP): number | null =>
	typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;

const int = (v: unknown, min: number, max: number): number | null => {
	const n = num(v, min, max);
	return n !== null && Number.isInteger(n) ? n : null;
};

export const BASE_STAT_KEYS = ['strength', 'dexterity', 'intelligence', 'vitality', 'charisma'] as const;
const RESOURCE_KEYS = Object.keys(INITIAL_RESOURCES) as (keyof Resources)[];
const OPTIONAL_RESOURCES = new Set<keyof Resources>(['eggs', 'milk', 'hide']);
const TILE_KEYS = new Set(['biome', 'isOwned', 'level', 'upgradeCost', 'building', 'hasChest']);
const MAX_ANIMALS = 5000;
const GEAR_SLOTS = new Set<string>([...EQUIPMENT_LAYOUT.left, ...EQUIPMENT_LAYOUT.right, ...EQUIPMENT_LAYOUT.bottom]);
const STACK_KEYS = new Set(['id', 'qty']);
const GEAR_ENTRY_KEYS = new Set(['item']);
const INSTANCE_KEYS = new Set(['base', 'level', 'rarity', 'quality', 'affixes']);
const AFFIX_KEYS = new Set(['id', 'roll']);
/** Longest pity counter a save may hold: far past any cap, so only a forged value exceeds it */
const MAX_PITY = 100000;
/** Level-ups are awarded by the tick, so a save written a moment after a purchase can be a few points behind. */
const POINT_TOLERANCE = 5;

const LAND_KEYS = new Set(['x', 'y', 'biome', 'level', 'building', 'chest']);
const hasBiome = (name: unknown): name is string => typeof name === 'string' && Object.prototype.hasOwnProperty.call(BIOMES, name);

interface RawLand {
	x: number;
	y: number;
	t: Record<string, unknown>;
}

/**
 * The owned tiles of a raw save, as `{ x, y, t }` with `t` in the tile shape (`biome`, `isOwned`, `level`, `building`,
 * `hasChest`). Two layouts are read: the 50 x 50 grid of the first saves (`tiles`, also what the legacy vault holds) and the
 * list of owned tiles (`land`) that the save format writes. Returns an error text instead when the layout is wrong.
 */
const readLand = (raw: Record<string, unknown>): RawLand[] | string => {
	const out: RawLand[] = [];
	if (Array.isArray(raw.tiles)) {
		const rows = raw.tiles;
		if (rows.length !== LEGACY_GRID_SIZE) return 'grid height';
		for (let y = 0; y < LEGACY_GRID_SIZE; y++) {
			const row = rows[y];
			if (!Array.isArray(row) || row.length !== LEGACY_GRID_SIZE) return 'grid width';
			for (let x = 0; x < LEGACY_GRID_SIZE; x++) {
				const t = row[x];
				if (!isObject(t)) return 'tile shape';
				for (const key of Object.keys(t)) if (!TILE_KEYS.has(key)) return 'tile key';
				if (!hasBiome(t.biome)) return 'tile biome';
				if (typeof t.isOwned !== 'boolean') return 'tile owned';
				if (!t.isOwned) {
					if (t.biome !== 'empty' || t.level !== undefined || t.building !== undefined || t.hasChest) {
						return 'unowned tile content';
					}
					continue;
				}
				out.push({ x, y, t });
			}
		}
		return out;
	}
	if (!Array.isArray(raw.land)) return 'map';
	if (raw.land.length > MAX_OWNED_TILES) return 'too many tiles';
	for (const entry of raw.land) {
		if (!isObject(entry)) return 'land entry shape';
		for (const key of Object.keys(entry)) if (!LAND_KEYS.has(key)) return 'land entry key';
		const { x, y, biome, level, building, chest } = entry;
		if (typeof x !== 'number' || typeof y !== 'number' || !inRange(x, y)) return 'land entry position';
		if (!hasBiome(biome)) return 'tile biome';
		const t: Record<string, unknown> = { biome, isOwned: true };
		if (level !== undefined) t.level = level;
		if (building !== undefined) t.building = building;
		if (chest !== undefined) t.hasChest = chest;
		out.push({ x, y, t });
	}
	return out;
};

/**
 * Validates and normalises a loaded/imported save. Anything that cannot be produced by playing the game
 * (impossible grid, negative/huge/non-numeric values, more stat points than the level allows, XP that does not
 * pay for the owned tiles ...) is rejected; derived values (rates, level, reputation, combat stats, castle
 * cost) are recomputed instead of trusted. Returns the cleaned persisted slice.
 */
export const sanitizeSave = (raw: unknown): SanitizeResult => {
	if (!isObject(raw)) return fail('not an object');

	// ---- map ----------------------------------------------------------------------------------
	const land = readLand(raw);
	if (typeof land === 'string') return fail(land);

	const placed: Placed[] = [];
	const at = new Set<number>();
	let castleTile: Tile | null = null;
	let owned = 0;
	let chests = 0;
	for (const { x, y, t } of land) {
		const key = tileKey(x, y);
		if (at.has(key)) return fail('two tiles share a position');
		at.add(key);

		const isCenter = x === CASTLE_X && y === CASTLE_Y;
		if ((t.biome === 'castle') !== isCenter) return fail('castle position');
		if (t.biome === 'empty') return fail('owned empty tile');
		owned++;

		const tile: Tile = { biome: t.biome as Tile['biome'], isOwned: true };
		if (t.biome === 'castle') {
			if (t.building !== undefined) return fail('building on the castle');
			const level = int(t.level, 1, CASTLE_UPGRADE.maxLevel);
			if (level === null) return fail('castle level');
			tile.level = level;
			if (level < CASTLE_UPGRADE.maxLevel) {
				tile.upgradeCost = { ...CASTLE_UPGRADE.upgradeCosts[level - 1] };
			}
			castleTile = tile;
		} else if (t.building !== undefined) {
			// a building stands on any biome except water (BUILDING_COST.blockedBiomes) and never has a level
			if (typeof t.building !== 'string' || !(t.building in BUILDINGS)) return fail('building');
			if (BUILDING_COST.blockedBiomes.includes(t.biome as Tile['biome'])) return fail('building on a tile that cannot take one');
			if (t.level !== undefined) return fail('building level');
			tile.building = t.building;
		} else if (t.level !== undefined) {
			return fail('level without a building');
		}
		if (t.hasChest !== undefined) {
			if (t.hasChest !== true || t.biome === 'castle') return fail('chest');
			tile.hasChest = true;
			chests++;
		}
		placed.push({ x, y, tile });
	}
	if (!castleTile) return fail('castle not owned');
	// No fixed chest cap: the spawn limit (src/lib/spawnLimits.ts) is a share of the map, and every chest already
	// stands on its own owned tile, so a save can never hold more chests than land.

	// Every owned tile must be reachable from the castle through owned neighbours
	const castleKey = tileKey(CASTLE_X, CASTLE_Y);
	const reached = new Set<number>([castleKey]);
	const stack = [castleKey];
	while (stack.length) {
		const k = stack.pop() as number;
		const cx = keyX(k);
		const cy = keyY(k);
		for (const [nx, ny] of [
			[cx - 1, cy],
			[cx + 1, cy],
			[cx, cy - 1],
			[cx, cy + 1],
		]) {
			if (!inRange(nx, ny)) continue;
			const nk = tileKey(nx, ny);
			if (at.has(nk) && !reached.has(nk)) {
				reached.add(nk);
				stack.push(nk);
			}
		}
	}
	if (reached.size !== owned) return fail('disconnected territory');
	const tiles = setTiles(EMPTY_WORLD, placed);

	// Tiles that cost nothing: just the castle in a save from before the starting ring, the castle + its 8 neighbours otherwise
	const freeTiles = raw.freeTiles === undefined ? 1 : int(raw.freeTiles, 1, STARTER_FREE_TILES);
	if (freeTiles === null || (freeTiles !== 1 && freeTiles !== STARTER_FREE_TILES)) return fail('free tiles');
	if (freeTiles === STARTER_FREE_TILES && !RING.every(([dx, dy]) => at.has(tileKey(CASTLE_X + dx, CASTLE_Y + dy)))) {
		return fail('starting ring not owned');
	}
	const purchasedOwned = owned - freeTiles + 1; // as the economy counts (castle + purchases)

	const castleLevel = castleTile.level ?? 1;

	// ---- resources, XP and level ----------------------------------------------------------------
	if (!isObject(raw.resources)) return fail('resources');
	const resources = { ...INITIAL_RESOURCES };
	for (const key of RESOURCE_KEYS) {
		// resources added after launch (farm products) are missing from older saves and start at 0
		const v = raw.resources[key] === undefined && OPTIONAL_RESOURCES.has(key) ? 0 : num(raw.resources[key]);
		if (v === null) return fail(`resource ${key}`);
		resources[key] = v;
	}
	let minXp = 0;
	for (let k = 2; k <= purchasedOwned; k++) minXp += calculateXpGain(k);
	if (resources.xp < Math.min(minXp, XP_CAP) * 0.999) return fail('xp does not cover owned tiles');
	const level = calculateLevel(resources.xp);

	// ---- character ---------------------------------------------------------------------------
	if (!isObject(raw.characterStats)) return fail('character stats');
	const base: Record<(typeof BASE_STAT_KEYS)[number], number> = {
		strength: 0,
		dexterity: 0,
		intelligence: 0,
		vitality: 0,
		charisma: 0,
	};
	let allocated = 0;
	for (const key of BASE_STAT_KEYS) {
		const v = int(raw.characterStats[key], INITIAL_CHARACTER_STATS[key], 100000);
		if (v === null) return fail(`stat ${key}`);
		base[key] = v;
		allocated += v;
	}
	const available = int(raw.characterStats.availablePoints, 0, 100000);
	if (available === null) return fail('available points');
	const expectedTotal = BASE_STAT_KEYS.length * INITIAL_CHARACTER_STATS.strength + totalStatPoints(level.level);
	const total = allocated + available;
	if (total > expectedTotal) return fail('too many stat points');
	if (total < expectedTotal - POINT_TOLERANCE) return fail('too few stat points');
	const characterStats: CharacterStats = {
		...INITIAL_CHARACTER_STATS,
		...base,
		availablePoints: available + (expectedTotal - total),
		reputation: INITIAL_CHARACTER_STATS.reputation + 100 * (purchasedOwned - 1),
	};
	Object.assign(characterStats, calculateCombatStats(characterStats));


	// ---- merchant bonuses (optional: an older save has none). Parsed first because Pack Rat sets the bag size ----------
	const merchantUpgrades: Record<string, number> = {};
	if (raw.merchantUpgrades !== undefined) {
		if (!isObject(raw.merchantUpgrades)) return fail('merchant upgrades');
		for (const [id, lvl] of Object.entries(raw.merchantUpgrades)) {
			if (!(id in MERCHANT_UPGRADES)) return fail('unknown merchant upgrade');
			const v = int(lvl, 0, MERCHANT_UPGRADES[id as MerchantUpgradeId].maxLevel);
			if (v === null) return fail('merchant upgrade level');
			if (v > 0) merchantUpgrades[id] = v;
		}
	}
	const bagSize = limitOf('bagSize', { merchantUpgrades });

	// ---- gear, bag, HP, monsters (all optional: a save from before combat gets the starter kit) ------------------
	let equipment: Equipment;
	let bag: BagSlot[];
	if (raw.equipment === undefined && raw.bag === undefined) {
		equipment = { ...STARTER_EQUIPMENT };
		bag = [...starterBag(), ...Array.from({ length: bagSize - COMBAT.bagSize }, () => null)];
	} else {
		if (raw.equipment === undefined || raw.bag === undefined) return fail('equipment and bag belong together');
		if (!isObject(raw.equipment)) return fail('equipment');
		equipment = {};
		for (const [slot, value] of Object.entries(raw.equipment)) {
			if (!GEAR_SLOTS.has(slot)) return fail('equipment slot');
			const item = readInstance(value);
			if (typeof item === 'string') return fail(`equipped item (${item})`);
			const def = ITEM_CATALOG[item.base];
			const fits = def.slot === slot || (def.slot === 'ring' && (slot === 'ring1' || slot === 'ring2'));
			if (!fits) return fail('equipped item in the wrong slot');
			equipment[slot as EquipmentSlot] = item;
		}
		if (!Array.isArray(raw.bag) || raw.bag.length !== bagSize) return fail('bag size');
		bag = [];
		for (const entry of raw.bag) {
			if (entry === null) {
				bag.push(null);
				continue;
			}
			if (!isObject(entry)) return fail('bag entry');
			if ('item' in entry) {
				for (const key of Object.keys(entry)) if (!GEAR_ENTRY_KEYS.has(key)) return fail('bag entry key');
				const item = readInstance(entry.item);
				if (typeof item === 'string') return fail(`bag item (${item})`);
				bag.push({ item });
				continue;
			}
			for (const key of Object.keys(entry)) if (!STACK_KEYS.has(key)) return fail('bag entry key');
			const def = typeof entry.id === 'string' ? ITEM_CATALOG[entry.id] : undefined;
			if (!def || def.kind !== 'consumable') return fail('bag item');
			const qty = int(entry.qty, 1, def.stackMax ?? 1);
			if (qty === null) return fail('bag quantity');
			bag.push({ id: def.id, qty });
		}
	}

	// Loot bookkeeping (optional: a save from before it has no pity and keeps everything)
	const lootPity: Record<string, number> = {};
	if (raw.lootPity !== undefined) {
		if (!isObject(raw.lootPity)) return fail('loot pity');
		const known = new Set(Object.values(LOOT_PROFILES).flatMap((p) => p.bonusTables.filter((t) => t.pity).map((t) => `${p.id}:${t.id}`)));
		for (const [key, count] of Object.entries(raw.lootPity)) {
			if (!known.has(key)) return fail('unknown loot table');
			const v = int(count, 0, MAX_PITY);
			if (v === null) return fail('loot pity count');
			if (v > 0) lootPity[key] = v;
		}
	}
	let autoSellUpTo: string | null = null;
	if (raw.autoSellUpTo !== undefined && raw.autoSellUpTo !== null) {
		if (typeof raw.autoSellUpTo !== 'string' || !Object.prototype.hasOwnProperty.call(RARITIES, raw.autoSellUpTo)) return fail('auto-sell rarity');
		autoSellUpTo = raw.autoSellUpTo;
	}

	const maxPlayerHp = maxHp(characterStats, equipment);
	let playerHp = maxPlayerHp;
	if (raw.playerHp !== undefined) {
		const v = num(raw.playerHp, 0, maxPlayerHp);
		if (v === null) return fail('player hp');
		playerHp = v;
	}
	// Mana (optional: a save from before it was added starts full)
	const maxPlayerMp = maxMana(characterStats, equipment);
	let playerMp = maxPlayerMp;
	if (raw.playerMp !== undefined) {
		const v = num(raw.playerMp, 0, maxPlayerMp);
		if (v === null) return fail('player mana');
		playerMp = v;
	}

	// ---- farm, click power, castle timer, misc -------------------------------------------------------
	if (!isObject(raw.farmLevels)) return fail('farm');
	const farmLevels: Record<string, number> = {};
	for (const [id, lvl] of Object.entries(raw.farmLevels)) {
		if (!ANIMALS.some((a) => a.id === id)) return fail('unknown animal');
		const v = int(lvl, 0, MAX_ANIMALS);
		if (v === null) return fail('animal count');
		if (v > 0) farmLevels[id] = v;
	}

	// farm upgrades arrived later than the farm: an older save simply has none
	const farmUpgrades: Record<string, number> = {};
	if (raw.farmUpgrades !== undefined) {
		if (!isObject(raw.farmUpgrades)) return fail('farm upgrades');
		for (const [id, lvl] of Object.entries(raw.farmUpgrades)) {
			if (!(id in FARM_UPGRADES)) return fail('unknown farm upgrade');
			const v = int(lvl, 0, FARM_UPGRADES[id as FarmUpgradeId].maxLevel);
			if (v === null) return fail('farm upgrade level');
			if (v > 0) farmUpgrades[id] = v;
		}
	}

	const clickLevel = int(raw.clickLevel, 0, CLICK_LADDER.length - 1);
	if (clickLevel === null) return fail('click level');

	let castleUpgrade: CastleUpgradeState | null = null;
	if (raw.castleUpgrade !== null && raw.castleUpgrade !== undefined) {
		if (!isObject(raw.castleUpgrade)) return fail('castle upgrade');
		const toLevel = int(raw.castleUpgrade.toLevel, 2, CASTLE_UPGRADE.maxLevel);
		if (toLevel === null || toLevel !== castleLevel + 1) return fail('castle upgrade level');
		const remaining = num(raw.castleUpgrade.remainingSec, 0, castleUpgradeDuration(castleLevel));
		if (remaining === null) return fail('castle upgrade time');
		castleUpgrade = { toLevel, remainingSec: remaining };
	}

	// ---- Rebirth / Embers (optional so saves from before it existed stay valid) -----------------------------
	let prestige: PrestigeState = { ...EMPTY_PRESTIGE, upgrades: {} };
	if (raw.prestige !== undefined) {
		if (!isObject(raw.prestige)) return fail('prestige');
		const rebirths = int(raw.prestige.rebirths, 0, 10000);
		const legacyPoints = int(raw.prestige.legacyPoints, 0, 1_000_000);
		const legacyEarned = int(raw.prestige.legacyEarned, 0, 1_000_000);
		if (rebirths === null || legacyPoints === null || legacyEarned === null) return fail('prestige numbers');
		const upgrades: PrestigeState['upgrades'] = {};
		if (!isObject(raw.prestige.upgrades)) return fail('prestige upgrades');
		for (const [id, lvl] of Object.entries(raw.prestige.upgrades)) {
			if (!(id in EMBER_UPGRADES)) return fail('unknown ember upgrade');
			const level = int(lvl, 0, EMBER_UPGRADES[id as EmberUpgradeId].maxLevel);
			if (level === null) return fail('ember upgrade level');
			if (level > 0) upgrades[id as EmberUpgradeId] = level;
		}
		// Points are conserved: everything earned is either still unspent or paid for shop levels
		if (legacyPoints + emberSpent(upgrades) !== legacyEarned) return fail('embers do not add up');
		if ((rebirths === 0) !== (legacyEarned === 0)) return fail('rebirths and embers disagree');
		if (legacyEarned < rebirths) return fail('too few embers for the rebirths');
		prestige = { rebirths, legacyPoints, legacyEarned, upgrades };
	}

	// Gems (optional so saves from before they existed stay valid: those players get the starting gems too)
	const gems = raw.gems === undefined ? STARTING_GEMS : int(raw.gems, 0, GEMS_CAP);
	if (gems === null) return fail('gems');

	const playSeconds = num(raw.playSeconds, 0, 1e9);
	if (playSeconds === null) return fail('timers');

	// The merchant's goods (optional: older saves get a fresh shelf on the next tick). Every offer is a full item check.
	let merchantStock: MerchantStock | null = null;
	if (raw.merchantStock !== undefined && raw.merchantStock !== null) {
		const rawStock = raw.merchantStock;
		if (!isObject(rawStock)) return fail('merchant stock');
		for (const key of Object.keys(rawStock)) if (key !== 'at' && key !== 'offers') return fail('merchant stock key');
		const at = num(rawStock.at, 0, 1e12);
		if (at === null || !Array.isArray(rawStock.offers) || rawStock.offers.length > MERCHANT_GOODS.maxOffers) return fail('merchant stock');
		const offers: ItemInstance[] = [];
		for (const entry of rawStock.offers) {
			const item = readInstance(entry);
			if (typeof item === 'string') return fail(`merchant offer (${item})`);
			offers.push(item);
		}
		merchantStock = { at: Math.min(at, playSeconds), offers };
	}

	const merchantRefreshes = raw.merchantRefreshes === undefined ? 0 : int(raw.merchantRefreshes, 0, 100_000);
	if (merchantRefreshes === null) return fail('merchant refreshes');

	const rawName = typeof raw.playerName === 'string' ? raw.playerName.trim().slice(0, 9) : '';
	const playerClass: PlayerClassId =
		typeof raw.playerClass === 'string' && raw.playerClass in PLAYER_CLASSES
			? (raw.playerClass as PlayerClassId)
			: DEFAULT_PLAYER_CLASS;

	return {
		ok: true,
		state: {
			tiles,
			resources,
			level,
			previousLevel: level.level,
			playerName: rawName || DEFAULT_PLAYER_NAME,
			playerClass,
			characterStats,
			farmLevels,
			farmUpgrades,
			merchantUpgrades,
			clickLevel,
			castleUpgrade,
			prestige,
			freeTiles,
			playSeconds,
			activeChests: chests,
			gems,
			equipment,
			bag,
			playerHp,
			playerMp,
			lootPity,
			autoSellUpTo,
			merchantStock,
			merchantRefreshes,
		},
	};
};
