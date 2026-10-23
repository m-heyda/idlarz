import { PLAYER_CLASSES, DEFAULT_PLAYER_CLASS, type PlayerClassId } from '@/config/playerClasses';
import {
	ANIMALS,
	BIOMES,
	BUILDINGS,
	CASTLE_UPGRADE,
	CHEST,
	CLICK_LADDER,
	DEFAULT_PLAYER_NAME,
	GRID_CENTER_X,
	GRID_CENTER_Y,
	GRID_HEIGHT,
	GRID_SIZE,
	INITIAL_CHARACTER_STATS,
	INITIAL_RESOURCES,
	LEGACY_UPGRADES,
	RESOURCE_CAP,
	type LegacyUpgradeId,
} from '@/config/gameConfig';
import { COMBAT } from '@/config/combatConfig';
import { EQUIPMENT_LAYOUT, ITEM_CATALOG, STARTER_EQUIPMENT } from '@/config/itemCatalog';
import { maxHp } from '@/lib/combat';
import { starterBag } from '@/lib/inventory';
import { tierFor } from '@/lib/monsters';
import {
	calculateCombatStats,
	calculateLevel,
	calculateXpGain,
	castleUpgradeDuration,
	EMPTY_PRESTIGE,
	legacySpent,
} from '@/utils/gameUtils';
import type {
	BagSlot,
	CastleUpgradeState,
	CharacterStats,
	Equipment,
	EquipmentSlot,
	GameState,
	Monster,
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
	'clickLevel',
	'castleUpgrade',
	'prestige',
	'playSeconds',
	'chestSpawnTimer',
	'activeChests',
	'lastChestReward',
	'lastChestGoldRate',
	'lastChestMinutesAwarded',
	'equipment',
	'bag',
	'playerHp',
	'monsters',
	'monsterSpawnTimer',
	'nextMonsterId',
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

const num = (v: unknown, min = 0, max = RESOURCE_CAP): number | null =>
	typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;

const int = (v: unknown, min: number, max: number): number | null => {
	const n = num(v, min, max);
	return n !== null && Number.isInteger(n) ? n : null;
};

const BASE_STAT_KEYS = ['strength', 'dexterity', 'intelligence', 'vitality', 'charisma'] as const;
const RESOURCE_KEYS = Object.keys(INITIAL_RESOURCES) as (keyof Resources)[];
const TILE_KEYS = new Set(['biome', 'isOwned', 'level', 'upgradeCost', 'building', 'hasChest']);
const MAX_ANIMALS = 5000;
const GEAR_SLOTS = new Set<string>([...EQUIPMENT_LAYOUT.left, ...EQUIPMENT_LAYOUT.right, ...EQUIPMENT_LAYOUT.bottom]);
const MONSTER_KEYS = new Set(['id', 'type', 'tier', 'x', 'y', 'ageSec']);
const BAG_ENTRY_KEYS = new Set(['id', 'qty']);
/** Level-ups are awarded by the tick, so a save written a moment after a purchase can be a few points behind. */
const POINT_TOLERANCE = 5;

/**
 * Validates and normalises a loaded/imported save. Anything that cannot be produced by playing the game
 * (impossible grid, negative/huge/non-numeric values, more stat points than the level allows, XP that does not
 * pay for the owned tiles ...) is rejected; derived values (rates, level, reputation, combat stats, castle
 * cost) are recomputed instead of trusted. Returns the cleaned persisted slice.
 */
export const sanitizeSave = (raw: unknown): SanitizeResult => {
	if (!isObject(raw)) return fail('not an object');

	// ---- grid ---------------------------------------------------------------------------------
	const rawTiles = raw.tiles;
	if (!Array.isArray(rawTiles) || rawTiles.length !== GRID_HEIGHT) return fail('grid height');

	const tiles: Tile[][] = [];
	let owned = 0;
	let chests = 0;
	for (let y = 0; y < GRID_HEIGHT; y++) {
		const row = rawTiles[y];
		if (!Array.isArray(row) || row.length !== GRID_SIZE) return fail('grid width');
		const outRow: Tile[] = [];
		for (let x = 0; x < GRID_SIZE; x++) {
			const t = row[x];
			if (!isObject(t)) return fail('tile shape');
			for (const key of Object.keys(t)) if (!TILE_KEYS.has(key)) return fail('tile key');
			if (typeof t.biome !== 'string' || !(t.biome in BIOMES)) return fail('tile biome');
			if (typeof t.isOwned !== 'boolean') return fail('tile owned');

			const isCenter = x === GRID_CENTER_X && y === GRID_CENTER_Y;
			if ((t.biome === 'castle') !== isCenter) return fail('castle position');
			if (isCenter && !t.isOwned) return fail('castle not owned');

			if (!t.isOwned) {
				if (t.biome !== 'empty' || t.level !== undefined || t.building !== undefined || t.hasChest) {
					return fail('unowned tile content');
				}
				outRow.push({ biome: 'empty', isOwned: false });
				continue;
			}
			if (t.biome === 'empty') return fail('owned empty tile');
			owned++;

			const tile: Tile = { biome: t.biome, isOwned: true };
			if (t.biome === 'castle') {
				const level = int(t.level, 1, CASTLE_UPGRADE.maxLevel);
				if (level === null) return fail('castle level');
				tile.level = level;
				if (level < CASTLE_UPGRADE.maxLevel) {
					tile.upgradeCost = { ...CASTLE_UPGRADE.upgradeCosts[level - 1] };
				}
			} else if (t.biome === 'grounds') {
				const building = t.building;
				if (building !== undefined) {
					if (typeof building !== 'string' || !(building in BUILDINGS)) return fail('building');
					if (t.level !== 2) return fail('building level');
					tile.level = 2;
					tile.building = building;
				} else if (t.level !== undefined) {
					return fail('grounds level');
				}
			} else if (t.level !== undefined || t.building !== undefined) {
				return fail('level on non-grounds tile');
			}
			if (t.hasChest !== undefined) {
				if (t.hasChest !== true || t.biome === 'castle') return fail('chest');
				tile.hasChest = true;
				chests++;
			}
			outRow.push(tile);
		}
		tiles.push(outRow);
	}
	if (chests > CHEST.max) return fail('too many chests');

	// Every owned tile must be reachable from the castle through owned neighbours
	const seen = new Set<number>();
	const stack: [number, number][] = [[GRID_CENTER_X, GRID_CENTER_Y]];
	seen.add(GRID_CENTER_Y * GRID_SIZE + GRID_CENTER_X);
	while (stack.length) {
		const [cx, cy] = stack.pop()!;
		for (const [nx, ny] of [
			[cx - 1, cy],
			[cx + 1, cy],
			[cx, cy - 1],
			[cx, cy + 1],
		]) {
			const id = ny * GRID_SIZE + nx;
			if (tiles[ny]?.[nx]?.isOwned && !seen.has(id)) {
				seen.add(id);
				stack.push([nx, ny]);
			}
		}
	}
	if (seen.size !== owned) return fail('disconnected territory');

	const castleLevel = tiles[GRID_CENTER_Y][GRID_CENTER_X].level ?? 1;

	// ---- resources, XP and level ----------------------------------------------------------------
	if (!isObject(raw.resources)) return fail('resources');
	const resources = { ...INITIAL_RESOURCES };
	for (const key of RESOURCE_KEYS) {
		const v = num(raw.resources[key]);
		if (v === null) return fail(`resource ${key}`);
		resources[key] = v;
	}
	let minXp = 0;
	for (let k = 2; k <= owned; k++) minXp += calculateXpGain(k);
	if (resources.xp < minXp * 0.999) return fail('xp does not cover owned tiles');
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
	const expectedTotal = BASE_STAT_KEYS.length * INITIAL_CHARACTER_STATS.strength + (level.level - 1);
	const total = allocated + available;
	if (total > expectedTotal) return fail('too many stat points');
	if (total < expectedTotal - POINT_TOLERANCE) return fail('too few stat points');
	const characterStats: CharacterStats = {
		...INITIAL_CHARACTER_STATS,
		...base,
		availablePoints: available + (expectedTotal - total),
		reputation: INITIAL_CHARACTER_STATS.reputation + 100 * (owned - 1),
	};
	Object.assign(characterStats, calculateCombatStats(characterStats));


	// ---- gear, bag, HP, monsters (all optional: a save from before combat gets the starter kit) ------------------
	let equipment: Equipment;
	let bag: BagSlot[];
	if (raw.equipment === undefined && raw.bag === undefined) {
		equipment = { ...STARTER_EQUIPMENT };
		bag = starterBag();
	} else {
		if (raw.equipment === undefined || raw.bag === undefined) return fail('equipment and bag belong together');
		if (!isObject(raw.equipment)) return fail('equipment');
		equipment = {};
		for (const [slot, id] of Object.entries(raw.equipment)) {
			if (!GEAR_SLOTS.has(slot)) return fail('equipment slot');
			const def = typeof id === 'string' ? ITEM_CATALOG[id] : undefined;
			if (!def || !def.slot || def.consumable) return fail('equipped item');
			const fits = def.slot === slot || (def.slot === 'ring' && (slot === 'ring1' || slot === 'ring2'));
			if (!fits) return fail('equipped item in the wrong slot');
			equipment[slot as EquipmentSlot] = id as string;
		}
		if (!Array.isArray(raw.bag) || raw.bag.length !== COMBAT.bagSize) return fail('bag size');
		bag = [];
		for (const entry of raw.bag) {
			if (entry === null) {
				bag.push(null);
				continue;
			}
			if (!isObject(entry)) return fail('bag entry');
			for (const key of Object.keys(entry)) if (!BAG_ENTRY_KEYS.has(key)) return fail('bag entry key');
			const def = typeof entry.id === 'string' ? ITEM_CATALOG[entry.id] : undefined;
			if (!def) return fail('bag item');
			const qty = int(entry.qty, 1, def.stackMax ?? 1);
			if (qty === null) return fail('bag quantity');
			bag.push({ id: def.id, qty });
		}
	}

	const maxPlayerHp = maxHp(characterStats, equipment);
	let playerHp = maxPlayerHp;
	if (raw.playerHp !== undefined) {
		const v = num(raw.playerHp, 0, maxPlayerHp);
		if (v === null) return fail('player hp');
		playerHp = v;
	}

	const nextMonsterId = raw.nextMonsterId === undefined ? 1 : int(raw.nextMonsterId, 1, 1e9);
	if (nextMonsterId === null) return fail('next monster id');
	const monsterSpawnTimer = raw.monsterSpawnTimer === undefined ? 0 : num(raw.monsterSpawnTimer, 0, COMBAT.spawn.intervalSec);
	if (monsterSpawnTimer === null) return fail('monster spawn timer');
	const monsters: Monster[] = [];
	if (raw.monsters !== undefined) {
		if (!Array.isArray(raw.monsters) || raw.monsters.length > COMBAT.maxMonsters) return fail('monsters');
		const ids = new Set<number>();
		const spots = new Set<string>();
		let kings = 0;
		for (const m of raw.monsters) {
			if (!isObject(m)) return fail('monster shape');
			for (const key of Object.keys(m)) if (!MONSTER_KEYS.has(key)) return fail('monster key');
			const id = int(m.id, 1, nextMonsterId - 1);
			const x = int(m.x, 0, GRID_SIZE - 1);
			const y = int(m.y, 0, GRID_HEIGHT - 1);
			const ageSec = num(m.ageSec, 0, 1e8);
			if (id === null || x === null || y === null || ageSec === null) return fail('monster numbers');
			if (m.type !== 'rat' && m.type !== 'ratKing') return fail('monster type');
			if (m.tier !== tierFor(m.type, ageSec)) return fail('monster tier');
			const tile = tiles[y][x];
			if (!tile.isOwned || tile.biome === 'castle' || tile.hasChest) return fail('monster tile');
			if (ids.has(id) || spots.has(`${x},${y}`)) return fail('duplicate monster');
			ids.add(id);
			spots.add(`${x},${y}`);
			if (m.type === 'ratKing' && ++kings > 1) return fail('more than one king');
			monsters.push({ id, type: m.type, tier: m.tier, x, y, ageSec });
		}
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

	// ---- Rebirth / Legacy (optional so saves from before it existed stay valid) -----------------------------
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
			if (!(id in LEGACY_UPGRADES)) return fail('unknown legacy upgrade');
			const level = int(lvl, 0, LEGACY_UPGRADES[id as LegacyUpgradeId].maxLevel);
			if (level === null) return fail('legacy upgrade level');
			if (level > 0) upgrades[id as LegacyUpgradeId] = level;
		}
		// Points are conserved: everything earned is either still unspent or paid for shop levels
		if (legacyPoints + legacySpent(upgrades) !== legacyEarned) return fail('legacy points do not add up');
		if ((rebirths === 0) !== (legacyEarned === 0)) return fail('rebirths and legacy disagree');
		if (legacyEarned < rebirths) return fail('too few legacy points for the rebirths');
		prestige = { rebirths, legacyPoints, legacyEarned, upgrades };
	}

	const chestSpawnTimer = num(raw.chestSpawnTimer, 0, CHEST.intervalSec);
	const playSeconds = num(raw.playSeconds, 0, 1e9);
	const lastChestReward = num(raw.lastChestReward ?? 0);
	const lastChestGoldRate = num(raw.lastChestGoldRate ?? 0);
	const lastChestMinutesAwarded = num(raw.lastChestMinutesAwarded ?? 0);
	if (
		chestSpawnTimer === null ||
		playSeconds === null ||
		lastChestReward === null ||
		lastChestGoldRate === null ||
		lastChestMinutesAwarded === null
	) {
		return fail('timers');
	}

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
			clickLevel,
			castleUpgrade,
			prestige,
			playSeconds,
			chestSpawnTimer,
			activeChests: chests,
			lastChestReward,
			lastChestGoldRate,
			lastChestMinutesAwarded,
			equipment,
			bag,
			playerHp,
			monsters,
			monsterSpawnTimer,
			nextMonsterId,
		},
	};
};
