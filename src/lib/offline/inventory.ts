import { isRecord } from '@/lib/isRecord';
import { ITEM_CATALOG, RARITIES } from '@/catalog';
import { MERCHANT_SHOP_ITEMS } from '@/config/merchant';
import {
	addDrop,
	aggregateStats,
	equipFromBag,
	gearOf,
	moveSlot,
	organizeBag,
	rebirthKit,
	removeFromBag,
	slotQty,
	stackOf,
	starterBag,
	unequip,
} from '@/lib/inventory';
import { instanceProblem, plainItem, sellValueOf } from '@/lib/itemInstance';
import { HARD_LIMITS } from '@/config/limits';
import { limitOf } from '@/lib/limits';
import { isAutoSold } from '@/lib/loot/autoSell';
import { isJunk } from '@/lib/loot/junk';
import { receiveDrops, type Received } from '@/lib/loot/receive';
import type { Inventory, InventoryOp } from '@/lib/offline/types';
import type { PersistedGame } from '@/lib/sanitizeSave';
import { sellPayout, type MerchantUpgrades, type SellContext } from '@/utils/game/merchant';
import type { BagSlot, Drop, Equipment, EquipmentSlot, ItemInstance, PrestigeState } from '@/types/game';

// SERVER ONLY. The player's things - the bag, the worn gear, the loot pity and the auto-sell filter - belong to the ledger, not to the save.
// A save the browser uploads cannot change them (the stored copy is stamped with these), the fights and the rewards read and write them
// here, and the player's own changes (equip, sell, move, buy) arrive as the operations below, each applied by the same pure functions of
// lib/inventory.ts the browser uses for its instant preview. Nothing here rolls anything.

type Core = Record<string, unknown>;

/** The Ember levels a save holds, as the limit machinery reads them (nothing when the save has none). */
const prestigeOf = (prestige: unknown): PrestigeState | undefined => (isRecord(prestige) ? (prestige as unknown as PrestigeState) : undefined);

/** The Pack Rat level a save holds (0 when none). */
const packratOf = (merchantUpgrades: unknown): number => {
	const level = isRecord(merchantUpgrades) ? merchantUpgrades.packrat : 0;
	return typeof level === 'number' && Number.isFinite(level) && level > 0 ? Math.floor(level) : 0;
};

/**
 * The Pack Rat level the server holds for the player rides with their bag (`Inventory.packrat`): it only ever goes up, a rebirth keeps it, a New Game
 * starts it again. The bag is as big as THIS level entitles it to, whatever level an upload (a stale or another browser's save) claims, and the
 * browser takes the level from the server together with the bag, so a bag and the upgrade that sizes it can never disagree.
 */
const packratFor = (inv: Pick<Inventory, 'packrat'> | null, merchantUpgrades: unknown): number => Math.max(inv?.packrat ?? 0, packratOf(merchantUpgrades));

/** The bag slots the worn belt gives (its `bagSlots` stat), rounded down. Read from the server's own equipment, never from the client. */
const wornBeltSlots = (equipment: Equipment): number => Math.max(0, Math.floor(aggregateStats(equipment).bagSlots));

/**
 * The belt bag slots the server holds for the player: the most a belt has ever given (`Inventory.beltSlots`) or the worn belt gives now. Like Pack Rat it only goes up,
 * so taking a belt off, or a rebirth, never shrinks the bag below the items in it.
 *
 * @category Progression/Limits
 * @order 3
 * @formula
 * beltSlots = max(Inventory.beltSlots, bagSlots of the worn gear)
 */
export const beltSlotsFor = (inv: Pick<Inventory, 'beltSlots' | 'equipment'> | null, equipment: Equipment = inv?.equipment ?? {}): number =>
	Math.max(inv?.beltSlots ?? 0, wornBeltSlots(equipment));

/**
 * The bag size the server entitles a player to, always through `limitOf('bagSize', ctx)`: the base, the Pack Rat level, the Deep Pockets level the
 * save's Embers hold and the belt's bag slots, all under `HARD_LIMITS.bagSize`. The one place the server's bag sizes come from.
 */
const sizeAt = (packrat: number, prestige: unknown, beltSlots = 0): number =>
	limitOf('bagSize', { merchantUpgrades: packrat > 0 ? { packrat } : {}, prestige: prestigeOf(prestige), beltSlots });

/** A bag brought to `size` slots: it only ever grows (Pack Rat, Deep Pockets, a raised base), never loses an item. */
const padBag = (bag: BagSlot[], size: number): BagSlot[] => (bag.length >= size ? bag : [...bag, ...Array.from({ length: size - bag.length }, () => null)]);

/** The inventory a save holds: what a ledger starts from the first time, and again for a New Game. */
export const inventoryFromCore = (core: Core): Inventory => {
	const bag = Array.isArray(core.bag) ? (core.bag as BagSlot[]) : starterBag();
	const lootPity: Record<string, number> = {};
	if (isRecord(core.lootPity))
		for (const [id, misses] of Object.entries(core.lootPity)) if (typeof misses === 'number' && Number.isFinite(misses)) lootPity[id] = misses;
	const packrat = packratOf(core.merchantUpgrades);
	const equipment = isRecord(core.equipment) ? (core.equipment as Equipment) : {};
	const beltSlots = wornBeltSlots(equipment);
	return {
		ver: 1,
		packrat,
		...(beltSlots > 0 ? { beltSlots } : {}),
		bag: padBag(bag, sizeAt(packrat, core.prestige, beltSlots)),
		equipment,
		lootPity,
		autoSellUpTo: typeof core.autoSellUpTo === 'string' ? core.autoSellUpTo : null,
	};
};

/** The inventory a rebirth leaves: the starter kit (see `rebirthKit`); only the auto-sell filter, a setting, carries over. A newer `ver`, so the browser takes it. */
export const rebirthInventory = (before: Inventory, merchantUpgrades: unknown, prestige?: unknown, playerClass?: unknown): Inventory => {
	const packrat = packratFor(before, merchantUpgrades);
	const beltSlots = beltSlotsFor(before);
	return {
		ver: before.ver + 1,
		packrat,
		...(beltSlots > 0 ? { beltSlots } : {}),
		...rebirthKit(packrat > 0 ? { packrat } : undefined, prestigeOf(prestige), beltSlots, typeof playerClass === 'string' ? playerClass : undefined),
		autoSellUpTo: before.autoSellUpTo,
	};
};

/** The inventory with a bag as big as the save's Pack Rat and Deep Pockets levels entitle it to (a bigger bag shows as a new version). */
export const fitInventory = (inv: Inventory, core: Core): Inventory => {
	const packrat = packratFor(inv, core.merchantUpgrades);
	const beltSlots = beltSlotsFor(inv);
	const size = sizeAt(packrat, core.prestige, beltSlots);
	return inv.bag.length >= size && (inv.packrat ?? 0) === packrat && (inv.beltSlots ?? 0) === beltSlots
		? inv
		: { ...inv, packrat, ...(beltSlots > 0 ? { beltSlots } : {}), bag: padBag(inv.bag, size), ver: inv.ver + 1 };
};

/** A save with the server's bag, gear, pity and auto-sell filter in place of the ones it carried. */
export const stampInventory = <T extends Pick<PersistedGame, 'bag' | 'equipment' | 'lootPity' | 'autoSellUpTo' | 'merchantUpgrades' | 'prestige'>>(
	state: T,
	inv: Inventory,
): T => {
	const packrat = packratFor(inv, state.merchantUpgrades);
	return {
		...state,
		// the server's Pack Rat level wins over a lower one in the upload (the bag is sized by it)
		merchantUpgrades: packrat > packratOf(state.merchantUpgrades) ? { ...state.merchantUpgrades, packrat } : state.merchantUpgrades,
		bag: padBag(inv.bag, sizeAt(packrat, state.prestige, beltSlotsFor(inv))),
		equipment: inv.equipment,
		lootPity: inv.lootPity,
		autoSellUpTo: inv.autoSellUpTo,
	};
};

/** The core of a stored save as the engine should see it: the ledger's inventory in place of the one the save was uploaded with. */
export const coreWithInventory = (core: Core, inv: Inventory | null): Core =>
	inv ? { ...core, bag: inv.bag, equipment: inv.equipment, lootPity: inv.lootPity, autoSellUpTo: inv.autoSellUpTo } : core;

/** What the merchant's sell bonuses read from a save: the Haggler level and the rebirth state. */
export const sellContextOf = (core: Core): SellContext => ({
	merchantUpgrades: isRecord(core.merchantUpgrades) ? (core.merchantUpgrades as MerchantUpgrades) : undefined,
	prestige: isRecord(core.prestige) ? (core.prestige as unknown as SellContext['prestige']) : undefined,
	// the Lighthouse's %, stamped into the stored save by the save pipeline from the standing Idol (`idolFx`)
	idolSellPct:
		isRecord(core.idolFx) && typeof core.idolFx.merchantSellPct === 'number' && Number.isFinite(core.idolFx.merchantSellPct)
			? Math.max(0, core.idolFx.merchantSellPct)
			: undefined,
});

const bump = (inv: Inventory, change: Partial<Omit<Inventory, 'ver'>>): Inventory => ({ ...inv, ...change, ver: inv.ver + 1 });

/** The ids of the base items the player has, worn or in the bag (for tables with `preferMissing`). */
export const ownedBases = (inv: Inventory): string[] =>
	[...Object.values(inv.equipment).map((item) => item?.base), ...inv.bag.map((slot) => (slot && 'item' in slot ? slot.item.base : slot?.id))].filter(
		(id): id is string => typeof id === 'string',
	);

/** How many of a stackable (a potion) the bag holds. */
export const bagCountOf = (inv: Inventory, id: string): number => {
	let total = 0;
	for (const slot of inv.bag) {
		const stack = stackOf(slot);
		if (stack && stack.id === id && Number.isFinite(stack.qty)) total += stack.qty;
	}
	return total;
};

/** Takes one of a stackable out of the bag (a drunk potion). Null when there is none. */
export const takeOne = (inv: Inventory, id: string): Inventory | null => {
	const index = inv.bag.findIndex((slot) => stackOf(slot)?.id === id);
	return index < 0 ? null : bump(inv, { bag: removeFromBag(inv.bag, index, 1) });
};

/** Hands drops to the player (the auto-sell filter, the full-bag rule): the new inventory and what happened, for the answer and the grant. */
export const receiveInto = (
	inv: Inventory,
	drops: readonly Drop[],
	sellCtx: SellContext,
	pity?: Record<string, number>,
): { inv: Inventory; received: Received } => {
	const received = receiveDrops(inv.bag, drops, inv.autoSellUpTo, sellCtx);
	return { inv: bump(inv, { bag: received.bag, ...(pity ? { lootPity: pity } : {}) }), received };
};

// ---------------------------------------------------------------------------------------------------- the player's operations

export type { InventoryOp };

/** Operations that change what the player carries while a fight is open are refused (the fight swings with the gear it started with). */
export const needsNoFight = (op: InventoryOp): boolean =>
	op.action !== 'buyShop' && op.action !== 'buyOffer' && op.action !== 'autoSell' && op.action !== 'use';

export interface OpResult {
	ok: boolean;
	inv: Inventory;
	/** Gold the player is paid (a sale): the server records it as granted */
	gold: number;
	/** Pieces of gear sold (sellJunk) */
	count: number;
}

const EQUIPMENT_SLOTS: readonly string[] = [
	'head',
	'shoulder',
	'chest',
	'hands',
	'legs',
	'feet',
	'neck',
	'cape',
	'ring1',
	'ring2',
	'charm',
	'belt',
	'mainHand',
	'offHand',
];

const refused = (inv: Inventory): OpResult => ({ ok: false, inv, gold: 0, count: 0 });
const done = (inv: Inventory, gold = 0, count = 0): OpResult => ({ ok: true, inv, gold, count });
const wholeQty = (qty: number | undefined, available: number): number | null => {
	const amount = qty === undefined ? 1 : Math.floor(qty);
	return Number.isFinite(amount) && amount >= 1 && amount <= available ? amount : null;
};

/**
 * The "Sell junk" button: sells every piece of gear in the bag that `junk` names (the junk rule, `isJunk`), paid through the same Haggler path as any sale. Refused with nothing changed when no piece is junk, which is
 * every bag until the rule is decided (IDL-312). `junk` is a parameter so a test can flip the rule.
 *
 * @category Loot/Junk
 * @order 2
 */
export const sellJunkRule = (inv: Inventory, sellCtx: SellContext, junk: (item: ItemInstance) => boolean = isJunk): OpResult => {
	let bag = inv.bag;
	let gold = 0;
	let count = 0;
	bag.forEach((slot, index) => {
		const item = gearOf(slot);
		if (!item || !junk(item)) return;
		gold += sellPayout(sellValueOf(item), 1, sellCtx);
		count += 1;
		bag = removeFromBag(bag, index, 1);
	});
	return count === 0 ? refused(inv) : done(bump(inv, { bag }), gold, count);
};

/**
 * Applies one of the player's operations. Returns the new inventory (with a higher `ver`) or `ok: false` with the inventory untouched. The
 * gold of a sale is worked out here, with the merchant's Haggler bonus the save holds; a purchase adds to the bag only (the price is
 * paid in the browser until the merchant is server-priced).
 */
export const applyOp = (inv: Inventory, op: InventoryOp, sellCtx: SellContext): OpResult => {
	switch (op.action) {
		case 'equip': {
			const result = Number.isInteger(op.index) ? equipFromBag(inv.bag, inv.equipment, op.index) : null;
			if (!result) return refused(inv);
			// a belt with bag slots grows the bag at once (and the slots stay when it comes off again)
			const beltSlots = beltSlotsFor(inv, result.equipment);
			const gained = beltSlots - (inv.beltSlots ?? 0);
			if (gained <= 0) return done(bump(inv, result));
			return done(bump(inv, { ...result, beltSlots, bag: padBag(result.bag, Math.min(HARD_LIMITS.bagSize, result.bag.length + gained)) }));
		}
		case 'unequip': {
			if (!EQUIPMENT_SLOTS.includes(op.slot)) return refused(inv);
			const result = unequip(inv.bag, inv.equipment, op.slot);
			return result ? done(bump(inv, result)) : refused(inv);
		}
		case 'move': {
			const ok = (i: number) => Number.isInteger(i) && i >= 0 && i < inv.bag.length;
			if (!ok(op.from) || !ok(op.to) || op.from === op.to) return refused(inv);
			return done(bump(inv, { bag: moveSlot(inv.bag, op.from, op.to) }));
		}
		case 'organize':
			return done(bump(inv, { bag: organizeBag(inv.bag) }));
		case 'discard': {
			const slot = Number.isInteger(op.index) ? inv.bag[op.index] : null;
			const amount = slot ? wholeQty(op.qty, slotQty(slot)) : null;
			return slot && amount ? done(bump(inv, { bag: removeFromBag(inv.bag, op.index, amount) })) : refused(inv);
		}
		case 'sell': {
			const slot = Number.isInteger(op.index) ? inv.bag[op.index] : null;
			if (!slot) return refused(inv);
			const gear = gearOf(slot);
			const stack = stackOf(slot);
			const unit = gear ? sellValueOf(gear) : stack ? (ITEM_CATALOG[stack.id]?.sellValue ?? 0) : 0;
			const amount = wholeQty(op.qty, slotQty(slot));
			if (!unit || !amount) return refused(inv);
			return done(bump(inv, { bag: removeFromBag(inv.bag, op.index, amount) }), sellPayout(unit, amount, sellCtx), amount);
		}
		case 'sellJunk': {
			if ('rule' in op) return op.rule === 'junk' ? sellJunkRule(inv, sellCtx) : refused(inv);
			if (typeof op.maxRarity !== 'string' || !Object.prototype.hasOwnProperty.call(RARITIES, op.maxRarity)) return refused(inv);
			let bag = inv.bag;
			let gold = 0;
			let count = 0;
			bag.forEach((slot, index) => {
				const item = gearOf(slot);
				if (!item || !isAutoSold(item, op.maxRarity)) return;
				gold += sellPayout(sellValueOf(item), 1, sellCtx);
				count += 1;
				bag = removeFromBag(bag, index, 1);
			});
			return count === 0 ? refused(inv) : done(bump(inv, { bag }), gold, count);
		}
		case 'autoSell': {
			if (op.rarity !== null && (typeof op.rarity !== 'string' || !Object.prototype.hasOwnProperty.call(RARITIES, op.rarity))) return refused(inv);
			return done(bump(inv, { autoSellUpTo: op.rarity }));
		}
		case 'buyShop': {
			const entry = MERCHANT_SHOP_ITEMS.find((item) => item.id === op.id);
			if (!entry || !ITEM_CATALOG[op.id] || !Number.isInteger(op.qty) || op.qty < 1 || op.qty > 99) return refused(inv);
			let bag = inv.bag;
			if (ITEM_CATALOG[op.id].kind === 'consumable') {
				const added = addDrop(bag, { kind: 'consumable', id: op.id, qty: op.qty });
				if (added.overflow > 0) return refused(inv);
				bag = added.bag;
			} else {
				for (let i = 0; i < op.qty; i++) {
					const added = addDrop(bag, { kind: 'gear', item: plainItem(op.id) });
					if (added.overflow > 0) return refused(inv);
					bag = added.bag;
				}
			}
			return done(bump(inv, { bag }));
		}
		case 'use':
			// drinking touches the hero's HP, mana and buffs too: it is applied by applyUse (consumables.ts), never here
			return refused(inv);
		case 'buyOffer': {
			if (!isRecord(op.item) || instanceProblem(op.item as ItemInstance)) return refused(inv);
			const added = addDrop(inv.bag, { kind: 'gear', item: op.item as ItemInstance });
			return added.overflow > 0 ? refused(inv) : done(bump(inv, { bag: added.bag }));
		}
	}
};

/** Parses the body of /api/inventory into an operation (null: not one). Numbers are checked again by `applyOp`. */
export const parseOp = (raw: unknown): InventoryOp | null => {
	if (!isRecord(raw) || typeof raw.action !== 'string') return null;
	const int = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
	switch (raw.action) {
		case 'equip':
			return int(raw.index) ? { action: 'equip', index: raw.index } : null;
		case 'unequip':
			return typeof raw.slot === 'string' && EQUIPMENT_SLOTS.includes(raw.slot) ? { action: 'unequip', slot: raw.slot as EquipmentSlot } : null;
		case 'move':
			return int(raw.from) && int(raw.to) ? { action: 'move', from: raw.from, to: raw.to } : null;
		case 'organize':
			return { action: 'organize' };
		case 'discard':
		case 'sell':
			return int(raw.index) && (raw.qty === undefined || int(raw.qty))
				? { action: raw.action, index: raw.index, ...(raw.qty === undefined ? {} : { qty: raw.qty as number }) }
				: null;
		case 'sellJunk':
			if (raw.rule === 'junk') return { action: 'sellJunk', rule: 'junk' };
			return typeof raw.maxRarity === 'string' ? { action: 'sellJunk', maxRarity: raw.maxRarity } : null;
		case 'autoSell':
			return raw.rarity === null || typeof raw.rarity === 'string' ? { action: 'autoSell', rarity: raw.rarity as string | null } : null;
		case 'buyShop':
			return typeof raw.id === 'string' && int(raw.qty) ? { action: 'buyShop', id: raw.id, qty: raw.qty } : null;
		case 'use':
			return int(raw.index) ? { action: 'use', index: raw.index } : null;
		case 'buyOffer':
			return isRecord(raw.item) ? { action: 'buyOffer', item: raw.item as unknown as ItemInstance } : null;
		default:
			return null;
	}
};
