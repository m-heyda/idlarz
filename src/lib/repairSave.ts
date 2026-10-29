import {
	ANIMALS,
	BUILDINGS,
	BUILDING_COST,
	CASTLE_UPGRADE,
	CASTLE_X,
	CASTLE_Y,
	CLICK_LADDER,
	EMBER_UPGRADES,
	FARM_UPGRADES,
	GEMS_CAP,
	INITIAL_CHARACTER_STATS,
	INITIAL_RESOURCES,
	MERCHANT_UPGRADES,
	RESOURCE_CAP,
	XP_CAP,
} from '@/config/gameConfig';
import { EQUIPMENT_LAYOUT, ITEM_CATALOG } from '@/config/itemCatalog';
import { limitOf } from '@/lib/limits';
import { MAX_ANIMALS, readInstance, sanitizeSave, BASE_STAT_KEYS, type SanitizeResult } from '@/lib/sanitizeSave';
import { calculateLevel, calculateXpGain, castleUpgradeDuration, emberSpent, totalStatPoints } from '@/utils/gameUtils';

/**
 * Reading the game's OWN copies of a save (browser storage, the account's save) with the rules as they are today.
 *
 * `sanitizeSave` refuses anything the current rules cannot produce, which is what the server and an import need. But the rules move
 * while saves are kept for weeks: a curve is retuned, a maximum drops, an item, a building or an upgrade is removed. A save written
 * a day ago can then fail the check for one value and the whole game is lost to its player (this locked players out once already,
 * see the schema 5 -> 6 migration). So for the game's own copies a refusal is not the end: the value that broke a rule is adjusted
 * (clamped, dropped, recomputed) and the check runs again, until the save passes or the problem is one that is not a rule
 * (a damaged or impossible map, a save that is not a save), which stays refused.
 *
 * Nothing here lets a save get past the check: the result is what `sanitizeSave` accepted, so everything it guarantees still holds,
 * and an upload of it goes through the server's strict check like any other.
 */

type Raw = Record<string, unknown>;

/** Changes `raw` to remove the problem and says whether it changed anything. */
type Fix = (raw: Raw) => boolean;

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

const toInt = (v: unknown, min: number, max: number, fallback: number): number =>
	typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : fallback;

/** A `{ id: level }` record keeping only the ids that still exist, each level cut to the maximum. */
const cleanLevels = (value: unknown, maxOf: (id: string) => number | null): Raw => {
	const out: Raw = {};
	if (!isObject(value)) return out;
	for (const [id, level] of Object.entries(value)) {
		const max = maxOf(id);
		if (max === null) continue;
		const v = toInt(level, 0, max, 0);
		if (v > 0) out[id] = v;
	}
	return out;
};

const has = (table: object, id: string) => Object.prototype.hasOwnProperty.call(table, id);

const replace = (raw: Raw, key: string, next: unknown): boolean => {
	if (JSON.stringify(raw[key]) === JSON.stringify(next)) return false;
	if (next === undefined) delete raw[key];
	else raw[key] = next;
	return true;
};

const drop =
	(key: string): Fix =>
	(raw) =>
		replace(raw, key, undefined);

const fixResources: Fix = (raw) => {
	if (!isObject(raw.resources)) return false;
	const resources = { ...raw.resources };
	for (const key of Object.keys(INITIAL_RESOURCES)) {
		if (resources[key] === undefined) continue;
		resources[key] = toInt(resources[key], 0, RESOURCE_CAP, 0);
	}
	return replace(raw, 'resources', resources);
};

/** The XP curve moved and the land owned is worth more XP than the save holds: it holds what the land needs. */
const fixXp: Fix = (raw) => {
	if (!isObject(raw.resources) || !Array.isArray(raw.land)) return false;
	const freeTiles = raw.freeTiles === 9 ? 9 : 1;
	const purchasedOwned = raw.land.length - freeTiles + 1;
	let minXp = 0;
	for (let k = 2; k <= purchasedOwned; k++) minXp += calculateXpGain(k);
	const target = Math.min(minXp, XP_CAP);
	const xp = raw.resources.xp;
	if (typeof xp === 'number' && xp >= target * 0.999) return false;
	return replace(raw, 'resources', { ...raw.resources, xp: target });
};

/** The attribute points no longer match the level: spent ones are refunded, and a shortfall is left to spend. */
const fixStats: Fix = (raw) => {
	if (!isObject(raw.resources) || typeof raw.resources.xp !== 'number') return false;
	const { level } = calculateLevel(raw.resources.xp);
	const earned = totalStatPoints(level);
	const stats = isObject(raw.characterStats) ? raw.characterStats : {};
	let allocated = 0;
	let valid = true;
	for (const key of BASE_STAT_KEYS) {
		const v = stats[key];
		if (typeof v !== 'number' || !Number.isInteger(v) || v < INITIAL_CHARACTER_STATS[key] || v > 100000) valid = false;
		else allocated += v;
	}
	const available = stats.availablePoints;
	if (typeof available !== 'number' || !Number.isInteger(available) || available < 0 || available > 100000) valid = false;
	const expected = BASE_STAT_KEYS.length * INITIAL_CHARACTER_STATS.strength + earned;
	if (valid && allocated + (available as number) < expected) {
		return replace(raw, 'characterStats', { ...stats, availablePoints: expected - allocated });
	}
	const refunded: Raw = { availablePoints: earned };
	for (const key of BASE_STAT_KEYS) refunded[key] = INITIAL_CHARACTER_STATS[key];
	return replace(raw, 'characterStats', refunded);
};

const GEAR_SLOTS = new Set<string>([...EQUIPMENT_LAYOUT.left, ...EQUIPMENT_LAYOUT.right, ...EQUIPMENT_LAYOUT.bottom]);

/** A bag entry as it is, or null when it is not a piece of gear or a stack that exists. */
const cleanBagEntry = (entry: unknown): unknown => {
	if (!isObject(entry)) return null;
	if ('item' in entry) {
		return Object.keys(entry).length === 1 && typeof readInstance(entry.item) !== 'string' ? entry : null;
	}
	const def = typeof entry.id === 'string' && has(ITEM_CATALOG, entry.id) ? ITEM_CATALOG[entry.id] : undefined;
	if (!def || def.kind !== 'consumable' || Object.keys(entry).some((k) => k !== 'id' && k !== 'qty')) return null;
	const qty = toInt(entry.qty, 0, def.stackMax ?? 1, 0);
	return qty >= 1 ? { id: def.id, qty } : null;
};

/** Gear and bag: items that no longer exist are dropped, gear in the wrong slot goes to the bag, and the bag gets its size. */
const fixGear: Fix = (raw) => {
	if (raw.equipment === undefined || raw.bag === undefined || !isObject(raw.equipment) || !Array.isArray(raw.bag)) {
		// not a gear record: the character starts with the starter kit, as a save from before combat does
		const a = replace(raw, 'equipment', undefined);
		const b = replace(raw, 'bag', undefined);
		return a || b;
	}
	const merchantUpgrades = isObject(raw.merchantUpgrades) ? (raw.merchantUpgrades as Record<string, number>) : {};
	const size = limitOf('bagSize', { merchantUpgrades });

	let bag: unknown[] = raw.bag.map(cleanBagEntry);
	const equipment: Raw = {};
	const moved: unknown[] = [];
	for (const [slot, value] of Object.entries(raw.equipment)) {
		if (!GEAR_SLOTS.has(slot)) continue;
		const item = readInstance(value);
		if (typeof item === 'string') continue;
		const def = ITEM_CATALOG[item.base];
		const fits = def.slot === slot || (def.slot === 'ring' && (slot === 'ring1' || slot === 'ring2'));
		if (fits) equipment[slot] = value;
		else moved.push({ item: value });
	}

	// the bag gets its size: empty slots are what gives way, items never do
	if (bag.length > size) bag = bag.filter((entry) => entry !== null);
	if (bag.length > size) return false; // more items than the bag can hold: not something to guess about
	while (bag.length < size) bag.push(null);
	for (const entry of moved) {
		const free = bag.indexOf(null);
		if (free >= 0) bag[free] = entry; // no room: the piece is lost, the save is not
	}

	const a = replace(raw, 'equipment', equipment);
	const b = replace(raw, 'bag', bag);
	return a || b;
};

const fixFarm: Fix = (raw) => replace(raw, 'farmLevels', cleanLevels(raw.farmLevels, (id) => (ANIMALS.some((a) => a.id === id) ? MAX_ANIMALS : null)));

const fixFarmUpgrades: Fix = (raw) => {
	if (raw.farmUpgrades === undefined) return false;
	return replace(raw, 'farmUpgrades', cleanLevels(raw.farmUpgrades, (id) => (has(FARM_UPGRADES, id) ? FARM_UPGRADES[id as keyof typeof FARM_UPGRADES].maxLevel : null)));
};

const fixMerchantUpgrades: Fix = (raw) => {
	if (raw.merchantUpgrades === undefined) return false;
	return replace(raw, 'merchantUpgrades', cleanLevels(raw.merchantUpgrades, (id) => (has(MERCHANT_UPGRADES, id) ? MERCHANT_UPGRADES[id as keyof typeof MERCHANT_UPGRADES].maxLevel : null)));
};

const fixClickLevel: Fix = (raw) => replace(raw, 'clickLevel', toInt(raw.clickLevel, 0, CLICK_LADDER.length - 1, 0));

/** The castle's tile in the unpacked land, if the layout is the one the game writes. */
const castleEntry = (raw: Raw): Raw | null => {
	if (!Array.isArray(raw.land)) return null;
	const entry = raw.land.find((e) => isObject(e) && e.x === CASTLE_X && e.y === CASTLE_Y);
	return isObject(entry) ? entry : null;
};

const fixCastleUpgrade: Fix = (raw) => {
	const castle = castleEntry(raw);
	const upgrade = raw.castleUpgrade;
	if (!castle || !isObject(upgrade)) return replace(raw, 'castleUpgrade', null);
	const level = toInt(castle.level, 1, CASTLE_UPGRADE.maxLevel, 1);
	if (upgrade.toLevel !== level + 1 || level >= CASTLE_UPGRADE.maxLevel) return replace(raw, 'castleUpgrade', null);
	return replace(raw, 'castleUpgrade', { toLevel: level + 1, remainingSec: Math.min(Math.max(0, Number(upgrade.remainingSec) || 0), castleUpgradeDuration(level)) });
};

/** Embers: unknown shop levels are dropped, and what is left unspent is what was earned minus what the levels cost today. */
const fixPrestige: Fix = (raw) => {
	if (!isObject(raw.prestige)) return replace(raw, 'prestige', undefined);
	const prestige = raw.prestige;
	let upgrades = cleanLevels(prestige.upgrades, (id) => (has(EMBER_UPGRADES, id) ? EMBER_UPGRADES[id as keyof typeof EMBER_UPGRADES].maxLevel : null));
	const earned = toInt(prestige.legacyEarned, 0, 1_000_000, 0);
	let spent = emberSpent(upgrades as never);
	if (spent > earned) {
		upgrades = {};
		spent = 0;
	}
	return replace(raw, 'prestige', {
		rebirths: toInt(prestige.rebirths, 0, 10000, 0),
		legacyEarned: earned,
		legacyPoints: earned - spent,
		upgrades,
	});
};

const fixGems: Fix = (raw) => replace(raw, 'gems', typeof raw.gems === 'number' ? toInt(raw.gems, 0, GEMS_CAP, 0) : undefined);

const fixPlaySeconds: Fix = (raw) => replace(raw, 'playSeconds', typeof raw.playSeconds === 'number' && Number.isFinite(raw.playSeconds) ? Math.min(1e9, Math.max(0, raw.playSeconds)) : 0);

/** Starting land: only the two layouts the game knows are allowed. */
const fixFreeTiles: Fix = (raw) => replace(raw, 'freeTiles', 1);

/** Tiles: a removed building, a building or chest where none may stand, a level without a building. The land itself is never touched. */
const fixLand: Fix = (raw) => {
	if (!Array.isArray(raw.land)) return false;
	let changed = false;
	const change = (entry: Raw, key: string, next?: unknown) => {
		if (next === undefined) delete entry[key];
		else entry[key] = next;
		changed = true;
	};
	for (const entry of raw.land) {
		if (!isObject(entry)) continue;
		if (entry.biome === 'castle') {
			if (entry.building !== undefined) change(entry, 'building');
			const level = toInt(entry.level, 1, CASTLE_UPGRADE.maxLevel, 1);
			if (entry.level !== level) change(entry, 'level', level);
			if (entry.chest !== undefined) change(entry, 'chest');
			continue;
		}
		const standing = typeof entry.building === 'string' && has(BUILDINGS, entry.building) && !(BUILDING_COST.blockedBiomes as readonly string[]).includes(entry.biome as string);
		if (entry.building !== undefined && !standing) change(entry, 'building');
		if (entry.level !== undefined) change(entry, 'level'); // buildings never have a level
		if (entry.chest !== undefined && entry.chest !== true) change(entry, 'chest');
	}
	return changed;
};

/** What to do about a refusal, by the reason `sanitizeSave` gives. A reason that is not here is not a rule and stays a refusal. */
const FIXES: [RegExp, Fix][] = [
	[/^resource /, fixResources],
	[/^xp does not cover/, fixXp],
	[/^(stat |available points|character stats|too (many|few) stat points)/, fixStats],
	[/^player hp/, drop('playerHp')],
	[/^player mana/, drop('playerMp')],
	[/^(equipment|equipped item|bag)/, fixGear],
	[/^(unknown )?merchant upgrade/, fixMerchantUpgrades],
	[/^merchant (stock|offer)/, (raw) => replace(raw, 'merchantStock', null)],
	[/^merchant refreshes/, (raw) => replace(raw, 'merchantRefreshes', 0)],
	[/^merchant refresh$/, drop('merchantRefresh')],
	[/loot/, drop('lootPity')],
	[/^auto-sell/, drop('autoSellUpTo')],
	[/^(farm|unknown animal|animal count)$/, fixFarm],
	[/farm upgrade/, fixFarmUpgrades],
	[/^click level/, fixClickLevel],
	[/^castle upgrade/, fixCastleUpgrade],
	[/^(prestige|unknown ember|ember upgrade|embers do not add up)/, fixPrestige],
	[/^gems$/, fixGems],
	[/^timers$/, fixPlaySeconds],
	[/^(free tiles|starting ring)/, fixFreeTiles],
	[/^(building|level without|chest|castle level)/, fixLand],
];

const MAX_ROUNDS = 60;

export type LenientResult = SanitizeResult & { /** The refusals that were adjusted away, in order */ repaired?: string[] };

/**
 * `sanitizeSave` for the game's own copies: a refusal for a rule that moved is fixed and the check runs again (see the header).
 * A save the strict check accepts comes back exactly as it does there, without `repaired`.
 */
export const sanitizeSaveLenient = (input: unknown): LenientResult => {
	const first = sanitizeSave(input);
	if (first.ok || !isObject(input)) return first;

	const raw = structuredClone(input);
	const repaired: string[] = [];
	let result: SanitizeResult = first;
	let previous = '';
	for (let round = 0; round < MAX_ROUNDS && !result.ok; round++) {
		const reason = result.reason;
		const fix = FIXES.find(([pattern]) => pattern.test(reason))?.[1];
		if (!fix || reason === previous || !fix(raw)) break;
		repaired.push(reason);
		previous = reason;
		result = sanitizeSave(raw);
	}
	return result.ok ? { ...result, repaired } : result;
};
