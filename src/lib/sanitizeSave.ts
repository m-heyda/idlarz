import { isRecord } from '@/lib/isRecord';
import { OPTIONAL_KEYS } from '@/catalog/resourceKeys';
import { PLAYER_CLASSES, DEFAULT_PLAYER_CLASS, type PlayerClassId } from '@/config/playerClasses';
import { isLiveBiome } from '@/config/biomeStage';
import { ANIMALS, FARM_UPGRADES, type FarmUpgradeId } from '@/config/farm';
import { BIOMES } from '@/config/biomes';
import { BUILDING_RULES, BUILDINGS_FLAG } from '@/config/buildings';
import { buildingDef } from '@/catalog/buildings';
import { IDOLS } from '@/catalog/idols';
import { HARD_LIMITS } from '@/config/limits';
import { buildingLevelCap, buildingUpgradeDuration, levelOfTile, upgradeCapOf } from '@/lib/buildings';
import { CASTLE_UPGRADE, CASTLE_X, CASTLE_Y } from '@/config/castle';
import { GEMS_CAP, STARTING_GEMS, CLICK_LADDER, INITIAL_RESOURCES, RESOURCE_CAP, XP_CAP } from '@/config/economy';
import { DEFAULT_PLAYER_NAME, INITIAL_CHARACTER_STATS } from '@/config/character';
import { MERCHANT_GOODS, MERCHANT_UPGRADES, type MerchantUpgradeId } from '@/config/merchant';
import { EMBER_UPGRADES, type EmberUpgradeId } from '@/config/rebirth';
import { EQUIPMENT_LAYOUT, ITEM_CATALOG, LOOT_PROFILES, RARITIES } from '@/catalog';
import { STARTER_EQUIPMENT } from '@/config/itemCatalog';
import { instanceProblem } from '@/lib/itemInstance';
import { maxHp, maxMana } from '@/lib/combat';
import { starterBag } from '@/lib/inventory';
import { limitOf } from '@/lib/limits';
import { calculateCombatStats, calculateLevel, totalStatPoints, calculateXpGain } from '@/utils/game/character';
import { castleUpgradeDuration } from '@/utils/game/castle';
import { EMPTY_PRESTIGE, emberSpent } from '@/utils/game/rebirth';
import { STARTER_FREE_TILES } from '@/utils/game/tiles';
import { RING } from '@/utils/biomeRules';
import { EMPTY_WORLD, MAX_OWNED_TILES, inRange, keyX, keyY, setTiles, tileKey, type Placed } from '@/utils/world';
import type {
	BagSlot,
	BuildingUpgradeState,
	CastleUpgradeState,
	CharacterStats,
	Equipment,
	EquipmentSlot,
	GameState,
	ItemInstance,
	MerchantRefresh,
	MerchantStock,
	PrestigeState,
	Resources,
	Tile,
} from '@/types/game';

/**
 * The part of the game state that is saved. Rates, window flags and the like are recomputed on load.
 *
 * **How to extend the save safely.**
 *
 * - **New persisted field**: add it to `PERSISTED_KEYS`, make `sanitizeSave` accept it as *optional with a default* (old saves simply lack it) and validate it. No version bump. Add the field to a test that round-trips it (`tests/saves/saveStorage.test.ts`).
 * - **Renamed, moved or reinterpreted field, or removed content** (an item, a building, a biome): bump `SAVE_SCHEMA` in `src/lib/saveFormat.ts`. Older saves are then refused. If they must survive, write the conversion for that bump
 *   (a `MIGRATIONS`-style step in `decodeSave`) and a frozen fixture save of the old version in `tests/fixtures/saves/`; the project does not carry any today. A save from a *newer* schema than the running game is refused with a clear message.
 * - **New action that moves resources**: validate inputs (type, range, finiteness, ownership), check affordability against the full cost bundle, and add a test in `tests/economy/economy.test.ts`.
 * - **Anything that decides a reward or a fight** belongs on the server side (`src/lib/offline/`), seeded by the sealed random source, not in the store.
 * - **Balance changes**: run `npm run docs:gen` and `npm test` (the click limiter, arbitrage and fight-balance tests guard the main exploits).
 *
 * The list below is the one list of persisted state: `tiles`, `resources`, `level`, `playerName`, `characterStats`, `farmLevels`, `merchantUpgrades`, `prestige`, `equipment`, `bag`, ... Everything not listed is rebuilt on load
 * (`resourceRates`, derived combat stats, every window flag) or belongs to the server (`monsters`, the open fight).
 *
 * @category Saves & Server/The save
 * @order 4
 * @table persisted-keys
 */
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
	'merchantRefresh',
] as const;

/** The saved slice of the game. `buildingUpgrade` is outside {@link PERSISTED_KEYS} on purpose: it exists only while BUILDINGS_FLAG is on, so a flag-off save is byte-identical to one from before the building system. */
export type PersistedGame = Pick<GameState, (typeof PERSISTED_KEYS)[number]> & {
	buildingUpgrade?: GameState['buildingUpgrade'];
	idolLevels?: GameState['idolLevels'];
};

export const pickPersisted = (state: GameState): PersistedGame => {
	const out: Record<string, unknown> = {};
	PERSISTED_KEYS.forEach((key) => {
		out[key] = state[key];
	});
	if (BUILDINGS_FLAG.enabled) {
		out.buildingUpgrade = state.buildingUpgrade;
		out.idolLevels = state.idolLevels;
	}
	return out as unknown as PersistedGame;
};

export type SanitizeResult = { ok: true; state: PersistedGame } | { ok: false; reason: string };

const fail = (reason: string): SanitizeResult => ({ ok: false, reason });

/** A saved piece of gear, rebuilt field by field (nothing else survives), or the reason it is not valid. */
export const readInstance = (value: unknown): ItemInstance | string => {
	if (!isRecord(value)) return 'not an item';
	for (const key of Object.keys(value)) if (!INSTANCE_KEYS.has(key)) return 'unknown field';
	if (typeof value.base !== 'string' || typeof value.rarity !== 'string' || !Array.isArray(value.affixes)) return 'malformed';
	const affixes: ItemInstance['affixes'] = [];
	for (const a of value.affixes) {
		if (!isRecord(a)) return 'malformed affix';
		for (const key of Object.keys(a)) if (!AFFIX_KEYS.has(key)) return 'unknown affix field';
		if (typeof a.id !== 'string' || typeof a.roll !== 'number') return 'malformed affix';
		affixes.push({ id: a.id, roll: a.roll });
	}
	if (value.crafted !== undefined && value.crafted !== true) return 'malformed crafted marker';
	const item: ItemInstance = {
		base: value.base,
		level: value.level as number,
		rarity: value.rarity,
		quality: value.quality as number,
		affixes,
		...(value.crafted ? { crafted: true } : {}),
	};
	return instanceProblem(item) ?? item;
};

const num = (v: unknown, min = 0, max = RESOURCE_CAP): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null);

const int = (v: unknown, min: number, max: number): number | null => {
	const n = num(v, min, max);
	return n !== null && Number.isInteger(n) ? n : null;
};

export const BASE_STAT_KEYS = ['strength', 'dexterity', 'intelligence', 'vitality', 'charisma'] as const;
const RESOURCE_KEYS = Object.keys(INITIAL_RESOURCES) as (keyof Resources)[];
const OPTIONAL_RESOURCES = new Set<keyof Resources>(OPTIONAL_KEYS);
export const MAX_ANIMALS = 5000;
const GEAR_SLOTS = new Set<string>([...EQUIPMENT_LAYOUT.left, ...EQUIPMENT_LAYOUT.right, ...EQUIPMENT_LAYOUT.bottom]);
const STACK_KEYS = new Set(['id', 'qty']);
const GEAR_ENTRY_KEYS = new Set(['item']);
const INSTANCE_KEYS = new Set(['base', 'level', 'rarity', 'quality', 'affixes', 'crafted']);
const AFFIX_KEYS = new Set(['id', 'roll']);
/** Longest pity counter a save may hold: far past any cap, so only a forged value exceeds it */
const MAX_PITY = 100000;
/** Level-ups are awarded by the tick, so a save written a moment after a purchase can be a few points behind. */
const POINT_TOLERANCE = 5;

const LAND_KEYS = new Set(['x', 'y', 'biome', 'level', 'building', 'bl', 'chest']);
/** A biome a real save may hold: in the catalog and live (the dev-only biomes of config/biomeStage.ts exist only in the map lab). */
const hasBiome = (name: unknown): name is string => typeof name === 'string' && Object.prototype.hasOwnProperty.call(BIOMES, name) && isLiveBiome(name);

interface RawLand {
	x: number;
	y: number;
	t: Record<string, unknown>;
}

/**
 * The owned tiles of a raw save, as `{ x, y, t }` with `t` in the tile shape (`biome`, `isOwned`, `level`, `building`,
 * `hasChest`) from the list of owned tiles (`land`) that the save format writes. Returns an error text instead when the layout is wrong.
 */
const readLand = (raw: Record<string, unknown>): RawLand[] | string => {
	const out: RawLand[] = [];
	if (!Array.isArray(raw.land)) return 'map';
	if (raw.land.length > MAX_OWNED_TILES) return 'too many tiles';
	for (const entry of raw.land) {
		if (!isRecord(entry)) return 'land entry shape';
		for (const key of Object.keys(entry)) if (!LAND_KEYS.has(key)) return 'land entry key';
		// `building` and `bl` are accepted and dropped unless the building system is on (BUILDINGS_FLAG): saves from before the old building system was removed (IDL-259), or written with the flag on, still load, minus their buildings
		const { x, y, biome, level, chest, building, bl } = entry;
		if (typeof x !== 'number' || typeof y !== 'number' || !inRange(x, y)) return 'land entry position';
		if (!hasBiome(biome)) return 'tile biome';
		const t: Record<string, unknown> = { biome, isOwned: true };
		if (level !== undefined) t.level = level;
		if (chest !== undefined) t.hasChest = chest;
		if (BUILDINGS_FLAG.enabled && building !== undefined) {
			t.building = building;
			if (bl !== undefined) t.buildingLevel = bl;
		}
		out.push({ x, y, t });
	}
	return out;
};

/**
 * Validates and normalises a loaded/imported save. Anything that cannot be produced by playing the game
 * (impossible grid, negative/huge/non-numeric values, more stat points than the level allows, XP that does not
 * pay for the owned tiles ...) is rejected; derived values (rates, level, combat stats, castle
 * cost) are recomputed instead of trusted. Returns the cleaned persisted slice.
 *
 * Validation of any loaded or imported save. It rejects what the game cannot produce: bad land, a second castle, unconnected tiles, unknown ids, values below 0 or above 1e21, wrong attribute sums, impossible castle upgrades,
 * a click level outside the ladder, a prestige block that does not add up, less XP than the owned tiles produced; gear must be valid item instances (`instanceProblem` in `src/lib/itemInstance.ts`). Gear stats are derived, never read from the save.
 *
 * @category Saves & Server/The save
 * @order 3
 */
export const sanitizeSave = (raw: unknown): SanitizeResult => {
	if (!isRecord(raw)) return fail('not an object');

	// ---- map ----------------------------------------------------------------------------------
	const land = readLand(raw);
	if (typeof land === 'string') return fail(land);

	const placed: Placed[] = [];
	const at = new Set<number>();
	let castleTile: Tile | null = null;
	let owned = 0;
	let chests = 0;
	const buildingIds = new Set<string>();
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
			const level = int(t.level, 1, CASTLE_UPGRADE.maxLevel);
			if (level === null) return fail('castle level');
			tile.level = level;
			if (level < CASTLE_UPGRADE.maxLevel) {
				tile.upgradeCost = { ...CASTLE_UPGRADE.upgradeCosts[level - 1] };
			}
			castleTile = tile;
		} else if (t.level !== undefined) {
			return fail('level on a tile that is not the castle');
		}
		if (t.hasChest !== undefined) {
			if (t.hasChest !== true || t.biome === 'castle') return fail('chest');
			tile.hasChest = true;
			chests++;
		}
		if (t.building !== undefined) {
			// only present while the building system is on (readLand). A building that cannot be valid here is DROPPED, never a reason to refuse the save, so an old save (the removed
			// building types, even ones that share a name with a new type) or one edited by hand always loads: unknown type, wrong biome, a second of its type, a chest on the tile, a bad level
			const def = typeof t.building === 'string' ? buildingDef(t.building) : undefined;
			const bl = t.buildingLevel === undefined ? 1 : int(t.buildingLevel, 1, def?.kind === 'idol' ? HARD_LIMITS.idolMaxLevel : BUILDING_RULES.maxLevel);
			if (def && def.biome === t.biome && !tile.hasChest && !buildingIds.has(def.id) && bl !== null) {
				buildingIds.add(def.id);
				tile.building = def.id;
				if (bl > 1) tile.buildingLevel = bl;
			}
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

	// Tiles that cost nothing: just the castle (1), or the castle + its four neighbours (a new game)
	const freeTiles = raw.freeTiles === undefined ? 1 : int(raw.freeTiles, 1, STARTER_FREE_TILES);
	if (freeTiles === null || (freeTiles !== 1 && freeTiles !== STARTER_FREE_TILES)) {
		return fail('free tiles');
	}
	const startTiles = freeTiles === STARTER_FREE_TILES ? RING : [];
	if (!startTiles.every(([dx, dy]) => at.has(tileKey(CASTLE_X + dx, CASTLE_Y + dy)))) {
		return fail('starting ring not owned');
	}
	const purchasedOwned = owned - freeTiles + 1; // as the economy counts (castle + purchases)

	const castleLevel = castleTile.level ?? 1;

	// ---- resources, XP and level ----------------------------------------------------------------
	if (!isRecord(raw.resources)) return fail('resources');
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
	if (!isRecord(raw.characterStats)) return fail('character stats');
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
	};
	Object.assign(characterStats, calculateCombatStats(characterStats));

	// ---- merchant bonuses (optional: an older save has none). Parsed first because Pack Rat sets the bag size ----------
	const merchantUpgrades: Record<string, number> = {};
	if (raw.merchantUpgrades !== undefined) {
		if (!isRecord(raw.merchantUpgrades)) return fail('merchant upgrades');
		for (const [id, lvl] of Object.entries(raw.merchantUpgrades)) {
			if (!(id in MERCHANT_UPGRADES)) return fail('unknown merchant upgrade');
			const v = int(lvl, 0, MERCHANT_UPGRADES[id as MerchantUpgradeId].maxLevel);
			if (v === null) return fail('merchant upgrade level');
			if (v > 0) merchantUpgrades[id] = v;
		}
	}
	// The bag is sized below, once the Embers (Deep Pockets) are read: a saved bag may be smaller than that (padded) but never beyond the ceiling
	const maxBagSize = limitOf('bagSize', { hardCap: true });

	// ---- gear, bag, HP, monsters (all optional: a save from before combat gets the starter kit) ------------------
	let equipment: Equipment;
	let bag: BagSlot[];
	if (raw.equipment === undefined && raw.bag === undefined) {
		equipment = { ...STARTER_EQUIPMENT };
		bag = starterBag();
	} else {
		if (raw.equipment === undefined || raw.bag === undefined) return fail('equipment and bag belong together');
		if (!isRecord(raw.equipment)) return fail('equipment');
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
		if (!Array.isArray(raw.bag) || raw.bag.length < 1 || raw.bag.length > maxBagSize) return fail('bag size');
		bag = [];
		for (const entry of raw.bag) {
			if (entry === null) {
				bag.push(null);
				continue;
			}
			if (!isRecord(entry)) return fail('bag entry');
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
		if (!isRecord(raw.lootPity)) return fail('loot pity');
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
	const maxPlayerMp = maxMana(characterStats, equipment, raw.playerClass);
	let playerMp = maxPlayerMp;
	if (raw.playerMp !== undefined) {
		const v = num(raw.playerMp, 0, maxPlayerMp);
		if (v === null) return fail('player mana');
		playerMp = v;
	}

	// ---- farm, click power, castle timer, misc -------------------------------------------------------
	if (!isRecord(raw.farmLevels)) return fail('farm');
	const farmLevels: Record<string, number> = {};
	for (const [key, lvl] of Object.entries(raw.farmLevels)) {
		const id = key === 'deer' ? 'sheep' : key; // the deer became the sheep (same price and meat); a save that has both keeps the sheep
		if (key === 'deer' && 'sheep' in raw.farmLevels) continue;
		if (!ANIMALS.some((a) => a.id === id)) return fail('unknown animal');
		const v = int(lvl, 0, MAX_ANIMALS);
		if (v === null) return fail('animal count');
		if (v > 0) farmLevels[id] = v;
	}

	// farm upgrades arrived later than the farm: an older save simply has none
	const farmUpgrades: Record<string, number> = {};
	if (raw.farmUpgrades !== undefined) {
		if (!isRecord(raw.farmUpgrades)) return fail('farm upgrades');
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
		if (!isRecord(raw.castleUpgrade)) return fail('castle upgrade');
		const toLevel = int(raw.castleUpgrade.toLevel, 2, CASTLE_UPGRADE.maxLevel);
		if (toLevel === null || toLevel !== castleLevel + 1) return fail('castle upgrade level');
		const remaining = num(raw.castleUpgrade.remainingSec, 0, castleUpgradeDuration(castleLevel));
		if (remaining === null) return fail('castle upgrade time');
		castleUpgrade = { toLevel, remainingSec: remaining };
	}

	// ---- Building system (only read while BUILDINGS_FLAG is on; absent means none) --------------------------
	let buildingUpgrade: BuildingUpgradeState | null = null;
	const idolLevels: Record<string, number> = {};
	if (BUILDINGS_FLAG.enabled) {
		// a level the castle does not allow (the gate `min(5, castle level)`) is dropped with its building, like any other building that cannot be valid
		const cap = buildingLevelCap(castleLevel);
		// an Idol is exempt: its level is the account's and it is placed again at that level whatever the castle level is (the server's ledger bounds it)
		for (const { tile } of placed)
			if (tile.building && buildingDef(tile.building)?.kind !== 'idol' && levelOfTile(tile) > cap) {
				delete tile.building;
				delete tile.buildingLevel;
			}
		// the running upgrade must belong to a building one level below it, with a timer that fits; anything else is dropped (the server derives and judges the timer anyway)
		const b = raw.buildingUpgrade;
		if (isRecord(b) && !castleUpgrade) {
			const bx = int(b.x, -16000, 16000);
			const by = int(b.y, -16000, 16000);
			const toLevel = int(b.toLevel, 2, HARD_LIMITS.idolMaxLevel);
			const at = bx === null || by === null ? undefined : placed.find((p) => p.x === bx && p.y === by);
			const remaining = toLevel === null ? null : num(b.remainingSec, 0, buildingUpgradeDuration(toLevel - 1));
			if (
				bx !== null &&
				by !== null &&
				toLevel !== null &&
				remaining !== null &&
				at &&
				levelOfTile(at.tile) === toLevel - 1 &&
				toLevel <= upgradeCapOf(buildingDef(at.tile.building), castleLevel)
			) {
				buildingUpgrade = { x: bx, y: by, toLevel, remainingSec: remaining };
			}
		}
		// the levels the account remembers for its Idols: known biomes, whole levels up to the hard limit; a standing Idol is never above what is remembered (a tile that says more raises the record, the server's ledger bounds it)
		if (isRecord(raw.idolLevels)) {
			for (const idol of IDOLS) {
				const v = int(raw.idolLevels[idol.biome], 1, HARD_LIMITS.idolMaxLevel);
				if (v !== null) idolLevels[idol.biome] = v;
			}
		}
		for (const { tile } of placed) {
			const def = buildingDef(tile.building);
			if (def?.kind === 'idol') idolLevels[def.biome] = Math.max(idolLevels[def.biome] ?? 0, levelOfTile(tile));
		}
	}

	// ---- Rebirth / Embers (optional so saves from before it existed stay valid) -----------------------------
	let prestige: PrestigeState = { ...EMPTY_PRESTIGE, upgrades: {} };
	if (raw.prestige !== undefined) {
		if (!isRecord(raw.prestige)) return fail('prestige');
		const rebirths = int(raw.prestige.rebirths, 0, 10000);
		const legacyPoints = int(raw.prestige.legacyPoints, 0, 1_000_000);
		const legacyEarned = int(raw.prestige.legacyEarned, 0, 1_000_000);
		if (rebirths === null || legacyPoints === null || legacyEarned === null) return fail('prestige numbers');
		const upgrades: PrestigeState['upgrades'] = {};
		if (!isRecord(raw.prestige.upgrades)) return fail('prestige upgrades');
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

	// An older, smaller bag is padded up to what the save is entitled to (base, Pack Rat, Deep Pockets): a bag only ever grows, it is never cut
	const bagSize = limitOf('bagSize', { merchantUpgrades, prestige });
	if (bag.length < bagSize) bag = [...bag, ...Array.from({ length: bagSize - bag.length }, () => null)];

	// Gems (optional so saves from before they existed stay valid: those players get the starting gems too)
	const gems = raw.gems === undefined ? STARTING_GEMS : int(raw.gems, 0, GEMS_CAP);
	if (gems === null) return fail('gems');

	const playSeconds = num(raw.playSeconds, 0, 1e9);
	if (playSeconds === null) return fail('timers');

	// The merchant's goods (optional: older saves get a fresh shelf on the next tick). Every offer is a full item check.
	let merchantStock: MerchantStock | null = null;
	if (raw.merchantStock !== undefined && raw.merchantStock !== null) {
		const rawStock = raw.merchantStock;
		if (!isRecord(rawStock)) return fail('merchant stock');
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

	let merchantRefresh: MerchantRefresh = { windowAt: 0, freeUsed: 0, lastAt: 0 };
	if (raw.merchantRefresh !== undefined) {
		const r = raw.merchantRefresh;
		if (!isRecord(r)) return fail('merchant refresh');
		const windowAt = num(r.windowAt, 0, playSeconds);
		const freeUsed = int(r.freeUsed, 0, MERCHANT_GOODS.refresh.freePerWindow);
		const lastAt = num(r.lastAt, 0, playSeconds);
		if (windowAt === null || freeUsed === null || lastAt === null) return fail('merchant refresh');
		merchantRefresh = { windowAt, freeUsed, lastAt };
	}

	const rawName = typeof raw.playerName === 'string' ? raw.playerName.trim().slice(0, 9) : '';
	const playerClass: PlayerClassId =
		typeof raw.playerClass === 'string' && raw.playerClass in PLAYER_CLASSES ? (raw.playerClass as PlayerClassId) : DEFAULT_PLAYER_CLASS;

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
			merchantRefresh,
			...(BUILDINGS_FLAG.enabled ? { buildingUpgrade, idolLevels } : {}),
		},
	};
};
