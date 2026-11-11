import { isRecord } from '@/lib/isRecord';
import { ITEM_CATALOG, RARITIES } from '@/catalog';
import { MONSTERS } from '@/config/combatConfig';
import { fitsSlot, readInstance } from '@/lib/sanitizeSave';
import { freshCooldowns, type CombatState } from '@/lib/offline/fightTypes';
import type { Inventory } from '@/lib/offline/types';
import type { BagSlot, Equipment, EquipmentSlot } from '@/types/game';

/**
 * Tolerant readers for the two ledger columns that hold catalog ids (`inv`: bag, gear, pity; `combat`: the open fight). The rule for every stored column: **read what you
 * understand, drop what you do not, never throw**. A catalog entry that a later release removed or changed (an item id, a monster type, a rarity, an affix, a level window) costs the
 * player that one piece, not the row: the rest of the bag, the gear and the combat state stay. (Retire content with a flag instead of deleting it and nothing is dropped at all:
 * see `docs/plan/save-compatibility.md`.)
 *
 * @category Saves & Server/The ledger
 * @order 5
 */

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * `player_ledger.inv` as the server uses it, or null when the column is empty or cannot be an inventory at all (the next request seeds it from the save). Bag entries and worn pieces that this
 * version does not know are dropped (an empty slot, an empty gear slot); a stack above a lowered stack size is cut to it; unknown pity tables are kept (they cost nothing and a later release may bring the table back).
 * Worn pieces must also fit their slot (a helm under `belt`, or a valid piece under a slot this version lacks, is dropped like in a save). Anything repaired or discarded (a piece, a slot, an auto-sell rarity that does not exist, a pity counter that is not a number) goes up `ver` by one, so a browser that already has the bag takes the corrected one.
 */
export const readInventory = (raw: unknown): Inventory | null => {
	if (!isRecord(raw) || !Array.isArray(raw.bag) || !isRecord(raw.equipment)) return null;
	let dropped = false;
	const bag: BagSlot[] = raw.bag.map((entry): BagSlot => {
		if (entry === null) return null;
		if (isRecord(entry) && 'item' in entry) {
			const item = readInstance(entry.item);
			if (typeof item === 'string') dropped = true;
			return typeof item === 'string' ? null : { item };
		}
		const def = isRecord(entry) && typeof entry.id === 'string' ? ITEM_CATALOG[entry.id] : undefined;
		if (!def || def.kind !== 'consumable' || !finite((entry as Record<string, unknown>).qty) || ((entry as Record<string, unknown>).qty as number) < 1) {
			dropped = true;
			return null;
		}
		const qty = Math.min(Math.floor((entry as Record<string, unknown>).qty as number), def.stackMax ?? 1);
		if (qty !== (entry as Record<string, unknown>).qty) dropped = true;
		return { id: def.id, qty };
	});
	const equipment: Equipment = {};
	for (const [slot, value] of Object.entries(raw.equipment)) {
		const item = readInstance(value);
		if (typeof item === 'string' || !fitsSlot(slot, item)) {
			dropped = true;
			continue;
		}
		equipment[slot as EquipmentSlot] = item;
	}
	const lootPity: Record<string, number> = {};
	if (isRecord(raw.lootPity))
		for (const [id, misses] of Object.entries(raw.lootPity)) {
			if (finite(misses) && misses >= 0) lootPity[id] = misses;
			else dropped = true;
		}
	else if (raw.lootPity !== undefined && raw.lootPity !== null) dropped = true;
	const ver = finite(raw.ver) ? raw.ver : 1;
	const autoSellUpTo = typeof raw.autoSellUpTo === 'string' && Object.prototype.hasOwnProperty.call(RARITIES, raw.autoSellUpTo) ? raw.autoSellUpTo : null;
	if (raw.autoSellUpTo !== null && raw.autoSellUpTo !== undefined && autoSellUpTo === null) dropped = true;
	const rebirth = isRecord(raw.rebirth) && finite(raw.rebirth.to) && finite(raw.rebirth.gain) ? { to: raw.rebirth.to, gain: raw.rebirth.gain } : undefined;
	return {
		ver: dropped ? ver + 1 : ver,
		...(finite(raw.packrat) ? { packrat: raw.packrat } : {}),
		...(finite(raw.beltSlots) ? { beltSlots: raw.beltSlots } : {}),
		bag,
		equipment,
		lootPity,
		autoSellUpTo,
		...(rebirth ? { rebirth } : {}),
	};
};

const FIGHT_NUMBERS = ['n', 'level', 'monsterHp', 'monsterMaxHp', 'playerTimer', 'monsterTimer', 'stunLeft', 'elapsed', 'ord', 'seq'] as const;
const PROFILE_NUMBERS = [
	'level',
	'maxHp',
	'maxMp',
	'hit',
	'crit',
	'superCrit',
	'critExtra',
	'attacksPerSec',
	'armor',
	'dodge',
	'leechPct',
	'hpRegen',
	'mpRegen',
	'heal',
] as const;

/** An open fight, only when it can be played on: a monster this version knows, its numbers and timers, and the frozen player profile (the next tick reads `profile.maxHp`). Anything damaged is closed (null); the optional profile fields stay as they are. */
const readFight = (raw: unknown): CombatState['fight'] => {
	if (!isRecord(raw) || typeof raw.type !== 'string' || !Object.prototype.hasOwnProperty.call(MONSTERS, raw.type)) return null;
	if (!FIGHT_NUMBERS.every((key) => finite(raw[key]))) return null;
	if (raw.timeLeftSec !== null && raw.timeLeftSec !== undefined && !finite(raw.timeLeftSec)) return null;
	if (!isRecord(raw.profile) || !PROFILE_NUMBERS.every((key) => finite((raw.profile as Record<string, unknown>)[key]))) return null;
	return raw as unknown as CombatState['fight'];
};

/**
 * `player_ledger.combat` as the server uses it, or null when the column is empty or not a combat record (the first combat request seeds it from the save). Missing lists read as empty and the cooldowns fill up with
 * zeros (rows from before a field existed); an open fight whose monster type this version does not know is closed (the player keeps everything else); a damaged log reads as empty.
 */
export const readCombat = (raw: unknown): CombatState | null => {
	if (!isRecord(raw) || !finite(raw.at) || !finite(raw.hp) || !finite(raw.mp)) return null;
	const fight = readFight(raw.fight);
	const cd = isRecord(raw.cd) ? { ...freshCooldowns(), ...(raw.cd as Partial<CombatState['cd']>) } : freshCooldowns();
	const retryAt: Record<string, number> = {};
	if (isRecord(raw.retryAt)) for (const [n, at] of Object.entries(raw.retryAt)) if (finite(at)) retryAt[n] = at;
	return {
		...(raw as unknown as CombatState),
		cd,
		fight,
		autoBattle: raw.autoBattle === true,
		autoUse: raw.autoUse !== false,
		ord: finite(raw.ord) ? raw.ord : 0,
		retryAt,
		queue: Array.isArray(raw.queue) ? raw.queue.filter(finite) : [],
		eventNo: finite(raw.eventNo) ? raw.eventNo : 0,
		log: Array.isArray(raw.log) ? (raw.log as CombatState['log']) : [],
	};
};
