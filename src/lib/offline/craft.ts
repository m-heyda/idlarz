import { ITEM_CATALOG } from '@/catalog';
import { RECIPES, RECIPE_BY_ID, type Recipe } from '@/catalog/recipes';
import type { ItemInstance } from '@/types/game';
import { CRAFTING } from '@/config/crafting';
import { addDrop } from '@/lib/inventory';
import { rollGear } from '@/lib/craftGear';
import { sealedRng } from '@/lib/offline/seal';
import { craftCostFactor, craftLevelOf, craftLimit, craftNeeds, craftTimeSec, craftXpOf, finishedOf, recipeResourceGold, stashKeyOf } from '@/lib/crafting';
import type { LimitContext } from '@/lib/limits';
import { ENCHANT } from '@/config/crafting';
import { LOOT_DATA } from '@/lib/loot/data';
import { pickAffix } from '@/lib/loot/generate';
import { gearOf } from '@/lib/inventory';
import { instanceProblem } from '@/lib/itemInstance';
import { qualityBiasOf } from '@/lib/craftGear';
import type { GearTarget } from '@/catalog/recipes';
import type { CraftQueueEntry, CraftRefusal, CraftReply, CraftState, Inventory } from '@/lib/offline/types';

// SERVER ONLY (with the ledger). The crafting requests (docs/plan/crafting-v0.md):
//  - craft:  a recipe WITH a time (`timeSec`) is queued as a batch (components taken from the stock now, the clock starts); a recipe without
//            one is done at once (v0.0).
//  - claim:  the finished crafts of a batch (or of every batch, `applyClaimAll`) are delivered and their XP is added. Components (and later refined materials) go into the crafting stash `craft.stock`, counted by id (a rebirth keeps it);
//            potions and trade goods go straight into the BAG, like gear. What does not fit (the stash cap, a full bag) waits in the batch (never gold).
//  - withdraw: potions and trade goods crafted before they went straight into the bag move from the stash into the bag (as many as fit).
//  - gear:   a gear recipe (IDL-241) is queued like any timed recipe; when its finished crafts are claimed the server rolls each piece (the `craft` loot source, sealed on the lifetime
//            counter `craft.ord`, so a replayed claim rolls the same pieces) and puts it in the BAG, marked `crafted`. A full bag stops the delivery (the rest waits in the batch, never gold).
//  - cancel: the unfinished crafts of a batch end; their components go back to the stock and the answer names the resources to give back.
// A refusal changes nothing and charges nothing. The resources themselves are paid by the browser (they are still client-held); the gold value
// of them is only counted in `craft.spent`.

/** What rolling a gear craft needs besides the ledger: the sealing secret and the player's Luck and Intelligence (from the last accepted save). Absent: gear cannot be delivered (the queue still works). */
export interface CraftEnv {
	secret: string;
	userId: string;
	luck: number;
	intelligence: number;
	/** % more crafting XP from the Blossom Shrine (the Idol of the orchard), from the last accepted save */
	xpPct?: number;
	/** What raises the crafting limits and discounts (Ember shop from the last accepted save, Gem shop from the ledger): the batch run time and, at queue time, the speed, slots and cost */
	limits?: LimitContext;
}

export interface CraftResult {
	ok: boolean;
	reason?: CraftRefusal;
	inv: Inventory;
	craft: CraftState;
	/** Crafts delivered (instant crafts, or claimed) */
	crafted?: number;
	/** Crafts put into the queue */
	queued?: number;
	/** Items a stash withdrawal moved into the bag */
	moved?: number;
	refund?: CraftReply['refund'];
}

const refuse = (reason: CraftRefusal, inv: Inventory, craft: CraftState): CraftResult => ({ ok: false, reason, inv, craft });

const recipeOf = (id: string): Recipe | undefined => (Object.prototype.hasOwnProperty.call(RECIPE_BY_ID, id) ? RECIPE_BY_ID[id] : undefined);

const dropEmpty = (stock: Record<string, number>) => {
	for (const key of Object.keys(stock)) if (stock[key] <= 0) delete stock[key];
	return stock;
};

/** Takes `count` crafts' components from a copy of the stock (null: not enough). */
const takeComponents = (recipe: Recipe, count: number, stockIn: Record<string, number>): Record<string, number> | null => {
	const stock = { ...stockIn };
	for (const input of recipe.inputs) {
		if (!('component' in input)) continue;
		stock[input.component] = (stock[input.component] ?? 0) - input.qty * count;
		if (stock[input.component] < 0) return null;
	}
	return stock;
};

/** Whether the player already has the unique piece a legendary recipe makes: in the bag, worn, or being made in the queue. */
const holdsUnique = (inv: Inventory, craft: CraftState, recipe: Recipe): boolean => {
	const id = 'item' in recipe.output ? recipe.output.item : '';
	return (
		inv.bag.some((slot) => !!slot && 'item' in slot && slot.item.base === id) ||
		Object.values(inv.equipment).some((item) => !!item && item.base === id) ||
		craft.queue.some((entry) => entry.recipeId === recipe.id)
	);
};

/**
 * Does or queues `count` crafts of `recipeId` at `nowMs`. Neither input is touched; the new ones are returned.
 * A timed recipe becomes a queue entry (needs a free slot); an instant one is done as in v0.0.
 */
export const applyCraft = (
	inv: Inventory,
	craft: CraftState,
	recipeId: string,
	count: number,
	nowMs: number,
	xpPct = 0,
	limits: LimitContext = {},
): CraftResult => {
	const recipe = recipeOf(recipeId);
	if (!Number.isInteger(count) || count < 1 || count > craftLimit('craftBatchCap')) return refuse('bad_request', inv, craft);
	if (!recipe) return refuse('unknown_recipe', inv, craft);
	if (recipe.kind === 'gear' && !recipe.timeSec) return refuse('not_craftable', inv, craft);
	if (craftLevelOf(craft.xp).level < recipe.unlock) return refuse('locked', inv, craft);
	if (nowMs - craft.last < CRAFTING.minGapMs) return refuse('too_fast', inv, craft);
	if (recipe.kind === 'legendary') {
		// a legendary: one at a time, one per request, and a free bag slot before anything is taken (a finished one is never turned into gold)
		if (count !== 1) return refuse('bad_request', inv, craft);
		if (holdsUnique(inv, craft, recipe)) return refuse('already_have', inv, craft);
		if (!inv.bag.some((slot) => slot === null)) return refuse('bag_full', inv, craft);
	}

	const stock = takeComponents(recipe, count, craft.stock);
	if (!stock) return refuse('no_components', inv, craft);
	const factor = craftCostFactor(limits);
	const spent = craft.spent + recipeResourceGold(recipe) * factor * count;

	if (recipe.timeSec) {
		if (craft.queue.length >= craftLimit('craftQueueSlots', limits)) return refuse('queue_full', inv, craft);
		const entry: CraftQueueEntry = { recipeId, count, startedAt: nowMs, timeSec: craftTimeSec(recipe, limits), ...(factor < 1 ? { costFactor: factor } : {}) };
		return { ok: true, inv, queued: count, craft: { ...craft, stock: dropEmpty(stock), spent, last: nowMs, queue: [...craft.queue, entry] } };
	}

	// a potion or trade good goes straight into the bag (all of it or none); only components wait in the crafting stash
	if ('item' in recipe.output) {
		const added = addDrop(inv.bag, { kind: 'consumable', id: recipe.output.item, qty: recipe.output.qty * count });
		if (added.overflow > 0) return refuse('bag_full', inv, craft);
		return {
			ok: true,
			crafted: count,
			inv: { ...inv, bag: added.bag, ver: inv.ver + 1 },
			craft: { ...craft, xp: craft.xp + craftXpOf(recipe, count, xpPct), ord: craft.ord + count, stock: dropEmpty(stock), spent, last: nowMs },
		};
	}
	const key = stashKeyOf(recipe);
	const made = (stock[key] ?? 0) + recipe.output.qty * count;
	if (made > CRAFTING.componentCap) return refuse('stock_full', inv, craft);
	stock[key] = made;
	return {
		ok: true,
		crafted: count,
		inv,
		craft: { ...craft, xp: craft.xp + craftXpOf(recipe, count, xpPct), ord: craft.ord + count, stock: dropEmpty(stock), spent, last: nowMs },
	};
};

const isGear = (entry: CraftQueueEntry): boolean => {
	const recipe = recipeOf(entry.recipeId);
	return !!recipe && 'gear' in recipe.output;
};

/** A potion or trade good batch: delivered into the bag like gear */
const isItem = (entry: CraftQueueEntry): boolean => {
	const recipe = recipeOf(entry.recipeId);
	return !!recipe && 'item' in recipe.output;
};

/** How many of `want` crafts of a recipe fit into the stash now (its cap per entry); the rest has to wait in the batch. */
const fitting = (recipe: Recipe, want: number, stock: Record<string, number>): number => {
	const room = Math.max(0, CRAFTING.componentCap - (stock[stashKeyOf(recipe)] ?? 0));
	return Math.min(want, Math.floor(room / recipe.output.qty));
};

/**
 * Rolls and delivers the finished pieces of a gear batch into the bag, one sealed roll each (`craft.ord` + 1, + 2 ...), stopping at the first piece that does not fit (it is rolled again by a later claim, from the same
 * ordinal, so the same piece). The grade's pity counter moves with every delivered piece. Null when the server cannot roll (no env) or the catalog has nothing to roll.
 */
const deliverGear = (inv: Inventory, craft: CraftState, index: number, nowMs: number, recipe: Recipe, target: GearTarget, env?: CraftEnv) => {
	if (!env) return null;
	const entry = craft.queue[index];
	const craftLevel = craftLevelOf(craft.xp).level;
	let bag = inv.bag;
	let pity = craft.pity[target.grade] ?? 0;
	let n = 0;
	for (const want = finishedOf(entry, nowMs, env.limits); n < want; n++) {
		const rng = sealedRng(env.secret, env.userId, 0, 'craft', craft.ord + n + 1);
		const rolled = rollGear(target, { craftLevel, luck: env.luck, intelligence: env.intelligence, pity }, rng);
		if (!rolled) break;
		const added = addDrop(bag, { kind: 'gear', item: rolled.item });
		if (added.overflow > 0) break;
		bag = added.bag;
		pity = rolled.pity;
	}
	const left = entry.count - n;
	const queue = craft.queue.slice();
	if (left > 0) queue[index] = { ...entry, count: left, startedAt: Math.round(entry.startedAt + n * entry.timeSec * 1000) };
	else queue.splice(index, 1);
	const pities = { ...craft.pity };
	if (pity > 0) pities[target.grade] = pity;
	else delete pities[target.grade];
	return {
		n,
		inv: n > 0 ? { ...inv, bag, ver: inv.ver + 1 } : inv,
		craft: { ...craft, xp: craft.xp + craftXpOf(recipe, n, env.xpPct), ord: craft.ord + n, pity: pities, queue },
	};
};

/**
 * Delivers the finished crafts of a potion or trade good batch straight into the bag, as many as fit (the rest stays in the batch and is delivered by a later claim, like gear). Whole crafts only: what a
 * craft makes (`output.qty`) is never split.
 */
const deliverItems = (
	inv: Inventory,
	craft: CraftState,
	index: number,
	nowMs: number,
	recipe: Recipe,
	output: { item: string; qty: number },
	env?: CraftEnv,
) => {
	const entry = craft.queue[index];
	const want = finishedOf(entry, nowMs, env?.limits);
	const tried = addDrop(inv.bag, { kind: 'consumable', id: output.item, qty: want * output.qty });
	const n = Math.floor((want * output.qty - tried.overflow) / output.qty);
	// the bag takes exactly `n` crafts' worth (a partial craft is not delivered)
	const bag = n === want || n < 1 ? (n < 1 ? inv.bag : tried.bag) : addDrop(inv.bag, { kind: 'consumable', id: output.item, qty: n * output.qty }).bag;
	const left = entry.count - n;
	const queue = craft.queue.slice();
	if (left > 0) queue[index] = { ...entry, count: left, startedAt: Math.round(entry.startedAt + n * entry.timeSec * 1000) };
	else queue.splice(index, 1);
	return {
		n,
		inv: n > 0 ? { ...inv, bag, ver: inv.ver + 1 } : inv,
		craft: { ...craft, xp: craft.xp + craftXpOf(recipe, n, env?.xpPct), ord: craft.ord + n, queue },
	};
};

/**
 * Delivers a finished legendary (a craft-only piece with a fixed rarity, no affixes yet: `docs` TODO of the special abilities): one piece into the bag as a `crafted` instance of the item at its first item level. It waits in the batch when the bag is full, like any
 * crafted piece; `applyCraft` already checked there was a slot when it was queued.
 */
const deliverUnique = (
	inv: Inventory,
	craft: CraftState,
	index: number,
	nowMs: number,
	recipe: Recipe,
	output: { item: string; qty: number },
	env?: CraftEnv,
) => {
	const entry = craft.queue[index];
	const def = ITEM_CATALOG[output.item];
	const want = Math.min(finishedOf(entry, nowMs, env?.limits), entry.count);
	const instance: ItemInstance = {
		base: def.id,
		level: def.minItemLevel ?? 1,
		rarity: def.fixedRarity ?? def.allowedRarities?.[0] ?? 'legendary',
		quality: 50,
		affixes: [],
		crafted: true,
	};
	let bag = inv.bag;
	let n = 0;
	for (; n < want; n++) {
		const added = addDrop(bag, { kind: 'gear', item: instance });
		if (added.overflow > 0) break;
		bag = added.bag;
	}
	const left = entry.count - n;
	const queue = craft.queue.slice();
	if (left > 0) queue[index] = { ...entry, count: left, startedAt: Math.round(entry.startedAt + n * entry.timeSec * 1000) };
	else queue.splice(index, 1);
	return {
		n,
		inv: n > 0 ? { ...inv, bag, ver: inv.ver + 1 } : inv,
		craft: { ...craft, xp: craft.xp + craftXpOf(recipe, n, env?.xpPct), ord: craft.ord + n, queue },
	};
};

/** Pays the finished crafts of one entry into the stash (components) as far as they fit; returns the new state (null when the batch is unknown). */
const deliver = (inv: Inventory, craft: CraftState, index: number, nowMs: number, env?: CraftEnv) => {
	const entry = craft.queue[index];
	const recipe = recipeOf(entry.recipeId);
	if (!recipe) return null;
	if ('gear' in recipe.output) return deliverGear(inv, craft, index, nowMs, recipe, recipe.output.gear, env);
	if ('item' in recipe.output)
		return ITEM_CATALOG[recipe.output.item]?.slot
			? deliverUnique(inv, craft, index, nowMs, recipe, recipe.output, env)
			: deliverItems(inv, craft, index, nowMs, recipe, recipe.output, env);
	const stock = { ...craft.stock };
	const n = fitting(recipe, finishedOf(entry, nowMs, env?.limits), stock);
	if (n > 0) stock[stashKeyOf(recipe)] = (stock[stashKeyOf(recipe)] ?? 0) + recipe.output.qty * n;
	const left = entry.count - n;
	const queue = craft.queue.slice();
	if (left > 0) queue[index] = { ...entry, count: left, startedAt: Math.round(entry.startedAt + n * entry.timeSec * 1000) };
	else queue.splice(index, 1);
	return { n, inv, craft: { ...craft, xp: craft.xp + craftXpOf(recipe, n, env?.xpPct), ord: craft.ord + n, stock, queue } };
};

/** How many crafted pieces of each rarity the bag holds (the server marks a crafted piece `crafted`). */
const craftedGearOf = (inv: Inventory): Record<string, number> => {
	const out: Record<string, number> = {};
	for (const slot of inv.bag) if (slot && 'item' in slot && slot.item.crafted) out[slot.item.rarity] = (out[slot.item.rarity] ?? 0) + 1;
	return out;
};

/** The crafted pieces a delivery added to the bag, by rarity (a delivery only adds pieces), for the Crafting deeds. */
export const craftedGearAdded = (before: Inventory, after: Inventory): Record<string, number> => {
	const was = craftedGearOf(before);
	const out: Record<string, number> = {};
	for (const [rarity, n] of Object.entries(craftedGearOf(after))) if (n > (was[rarity] ?? 0)) out[rarity] = n - (was[rarity] ?? 0);
	return out;
};

/** Delivers what is finished in batch `slot`. Whatever does not fit stays in the batch and is delivered by a later claim. */
export const applyClaim = (inv: Inventory, craft: CraftState, slot: number, nowMs: number, env?: CraftEnv): CraftResult => {
	const entry = Number.isInteger(slot) ? craft.queue[slot] : undefined;
	if (!entry || !recipeOf(entry.recipeId)) return refuse('no_batch', inv, craft);
	if (nowMs - craft.last < CRAFTING.minGapMs) return refuse('too_fast', inv, craft);
	if (finishedOf(entry, nowMs, env?.limits) < 1) return refuse('nothing_ready', inv, craft);
	const done = deliver(inv, craft, slot, nowMs, env);
	if (!done) return refuse('no_batch', inv, craft);
	if (done.n < 1) return refuse(isGear(entry) || isItem(entry) ? 'bag_full' : 'stock_full', inv, craft);
	return { ok: true, crafted: done.n, inv: done.inv, craft: { ...done.craft, last: nowMs } };
};

/** Delivers what is finished in every batch in one request (Collect all). Refused only when nothing is ready or nothing fits. */
export const applyClaimAll = (inv: Inventory, craft: CraftState, nowMs: number, env?: CraftEnv): CraftResult => {
	if (nowMs - craft.last < CRAFTING.minGapMs) return refuse('too_fast', inv, craft);
	let state = craft;
	let inventory = inv;
	let crafted = 0;
	let ready = false;
	let gearWaiting = false;
	// last to first, so removing a used-up batch never shifts one still to do
	for (let index = craft.queue.length - 1; index >= 0; index--) {
		const entry = state.queue[index];
		if (!recipeOf(entry.recipeId) || finishedOf(entry, nowMs, env?.limits) < 1) continue;
		ready = true;
		const done = deliver(inventory, state, index, nowMs, env);
		if (!done) continue;
		if (done.n < finishedOf(entry, nowMs, env?.limits) && (isGear(entry) || isItem(entry))) gearWaiting = true;
		crafted += done.n;
		state = done.craft;
		inventory = done.inv;
	}
	if (!ready) return refuse('nothing_ready', inv, craft);
	if (crafted < 1) return refuse(gearWaiting ? 'bag_full' : 'stock_full', inv, craft);
	return { ok: true, crafted, inv: inventory, craft: { ...state, last: nowMs } };
};

/**
 * Ends batch `slot`: the finished crafts are delivered first (as a claim does; those that do not fit keep waiting as a smaller batch), the
 * unfinished ones are cancelled, their components go back into the stock and their resources are named in `refund`.
 */
export const applyCancel = (inv: Inventory, craft: CraftState, slot: number, nowMs: number, env?: CraftEnv): CraftResult => {
	const entry = Number.isInteger(slot) ? craft.queue[slot] : undefined;
	const recipe = entry && recipeOf(entry.recipeId);
	if (!entry || !recipe) return refuse('no_batch', inv, craft);
	if (nowMs - craft.last < CRAFTING.minGapMs) return refuse('too_fast', inv, craft);

	const delivered = finishedOf(entry, nowMs, env?.limits) > 0 ? deliver(inv, craft, slot, nowMs, env) : null;
	const after = delivered?.craft ?? craft;
	const outInv = delivered?.inv ?? inv;
	const index = delivered && delivered.craft.queue.length < craft.queue.length ? -1 : slot; // -1: the delivery used the entry up
	const rest = index < 0 ? null : after.queue[index];
	// unfinished = crafts that are not done yet (what is done but did not fit stays as the smaller batch)
	const waiting = rest ? finishedOf(rest, nowMs, env?.limits) : 0;
	const cancelled = rest ? rest.count - waiting : 0;

	const stock = { ...after.stock };
	const queue = after.queue.slice();
	let spent = after.spent;
	const refund: NonNullable<CraftReply['refund']> = [];
	if (rest && cancelled > 0) {
		const factor = rest.costFactor ?? 1; // the discount the batch was paid with
		const needs = craftNeeds(recipe, cancelled, factor);
		for (const c of needs.components) stock[c.id] = (stock[c.id] ?? 0) + c.qty;
		for (const r of needs.resources) refund.push({ key: r.key, qty: r.qty });
		spent = Math.max(0, spent - recipeResourceGold(recipe) * factor * cancelled);
		if (waiting > 0) queue[index] = { ...rest, count: waiting };
		else queue.splice(index, 1);
	}
	return {
		ok: true,
		crafted: delivered?.n ?? 0,
		refund,
		inv: outInv,
		craft: { ...after, stock, queue, spent, last: nowMs },
	};
};

export type EnchantMode = 'reroll' | 'add';

/**
 * The enchant craft (IDL-120, `ENCHANT`): one affix of a piece of gear in the bag is rerolled or one is added, for Ichor from the crafting stash.
 *
 * - `reroll`: the affix at `affix` is replaced by another affix (a group the piece does not already carry, a fresh roll); `add`: one more affix, up to the most the rarity carries.
 * - Refused, with nothing taken, for a slot that holds no gear or a named legendary (`bad_item`), an affix index outside the piece (`bad_affix`), a piece that already has every affix its rarity allows or no affix left that fits (`affix_cap`),
 *   too little Ichor (`needs_ichor`: distil it from Corrupted Core first), a missing roll environment or a request within a second of the last (`too_fast`).
 * - The roll is sealed on its own lifetime counter (`craft.ordEnchant`, kind `'enchant'`), leaned up by Intelligence like a gear craft; the same request replayed (a lost answer) is the same result because the idempotency key replays the stored answer.
 *
 * @category Economy/Crafting
 * @order 10
 */
export const applyEnchant = (
	inv: Inventory,
	craft: CraftState,
	index: number,
	mode: EnchantMode,
	affix: number,
	nowMs: number,
	env?: CraftEnv,
): CraftResult => {
	if (!env) return refuse('not_craftable', inv, craft);
	if (nowMs - craft.last < CRAFTING.minGapMs) return refuse('too_fast', inv, craft);
	const slot = Number.isInteger(index) ? inv.bag[index] : null;
	const item = slot ? gearOf(slot) : null;
	const def = item ? LOOT_DATA.items[item.base] : undefined;
	if (!item || !def || def.generation === 'named') return refuse('bad_item', inv, craft);
	const rarity = LOOT_DATA.rarities[item.rarity];
	if (!rarity) return refuse('bad_item', inv, craft);
	if (mode === 'reroll' && !(Number.isInteger(affix) && affix >= 0 && affix < item.affixes.length)) return refuse('bad_affix', inv, craft);
	if (mode === 'add' && item.affixes.length >= rarity.maxAffixes) return refuse('affix_cap', inv, craft);
	const cost = mode === 'reroll' ? ENCHANT.ichor.reroll : ENCHANT.ichor.add;
	if ((craft.stock.ing_ichor ?? 0) < cost) return refuse('needs_ichor', inv, craft);

	const ord = (craft.ordEnchant ?? 0) + 1;
	const rng = sealedRng(env.secret, env.userId, 0, 'enchant', ord);
	const kept = item.affixes.filter((_, i) => mode === 'add' || i !== affix);
	const used = new Set(kept.map((a) => LOOT_DATA.affixes[a.id]?.group).filter((g): g is string => !!g));
	const picked = pickAffix(def, item.level, rarity, used, LOOT_DATA, rng, qualityBiasOf(env.intelligence));
	if (!picked) return refuse('affix_cap', inv, craft);
	const affixes =
		mode === 'add'
			? [...item.affixes, { id: picked.id, roll: picked.roll }]
			: item.affixes.map((a, i) => (i === affix ? { id: picked.id, roll: picked.roll } : a));
	const enchanted = { ...item, affixes };
	if (instanceProblem(enchanted) !== null) return refuse('bad_item', inv, craft);

	const bag = inv.bag.map((s, i) => (i === index ? { item: enchanted } : s));
	const stock = dropEmpty({ ...craft.stock, ing_ichor: (craft.stock.ing_ichor ?? 0) - cost });
	return { ok: true, crafted: 0, inv: { ...inv, bag, ver: inv.ver + 1 }, craft: { ...craft, stock, ordEnchant: ord, last: nowMs } };
};

/** Parses the body of /api/craft/enchant: the bag slot, the mode and (for a reroll) the affix index (null: not one). The values are checked again by `applyEnchant`. */
export const parseEnchant = (raw: Record<string, unknown>): { index: number; mode: EnchantMode; affix: number } | null =>
	typeof raw.index === 'number' &&
	Number.isInteger(raw.index) &&
	raw.index >= 0 &&
	raw.index < 1000 &&
	(raw.mode === 'reroll' || raw.mode === 'add') &&
	(raw.affix === undefined || (typeof raw.affix === 'number' && Number.isInteger(raw.affix) && raw.affix >= 0 && raw.affix < 20))
		? { index: raw.index, mode: raw.mode, affix: typeof raw.affix === 'number' ? raw.affix : 0 }
		: null;

/** Parses the body of /api/craft (null: not one). The numbers are checked again by `applyCraft`. */
export const parseCraft = (raw: Record<string, unknown>): { recipeId: string; count: number } | null =>
	typeof raw.recipeId === 'string' && raw.recipeId.length <= 40 && typeof raw.count === 'number' && Number.isInteger(raw.count) && raw.count >= 0
		? { recipeId: raw.recipeId, count: raw.count }
		: null;

/**
 * Moves `qty` of a crafted potion or trade good from the crafting stash into the bag (as many as fit; the rest stays in the stash). Components
 * cannot be withdrawn: they only sit in the stash for recipes. A refusal changes nothing.
 */
export const applyWithdraw = (inv: Inventory, craft: CraftState, id: string, qty: number, nowMs: number): CraftResult => {
	if (!Number.isInteger(qty) || qty < 1) return refuse('bad_request', inv, craft);
	if (!RECIPES.some((r) => 'item' in r.output && r.output.item === id)) return refuse('bad_request', inv, craft);
	if (nowMs - craft.last < CRAFTING.minGapMs) return refuse('too_fast', inv, craft);
	const held = craft.stock[id] ?? 0;
	if (held < 1) return refuse('not_in_stash', inv, craft);
	const want = Math.min(qty, held);
	const added = addDrop(inv.bag, { kind: 'consumable', id, qty: want });
	const moved = want - added.overflow;
	if (moved < 1) return refuse('bag_full', inv, craft);
	const stock = dropEmpty({ ...craft.stock, [id]: held - moved });
	return { ok: true, moved, inv: { ...inv, bag: added.bag, ver: inv.ver + 1 }, craft: { ...craft, stock, last: nowMs } };
};

/** Parses the body of /api/craft/stash: what to withdraw and how many (null: not one). */
export const parseWithdraw = (raw: Record<string, unknown>): { id: string; qty: number } | null =>
	typeof raw.id === 'string' && raw.id.length <= 40 && typeof raw.qty === 'number' && Number.isInteger(raw.qty) && raw.qty >= 1
		? { id: raw.id, qty: raw.qty }
		: null;

/** Parses the body of /api/craft/claim: a batch slot (default 0) or 'all' (Collect all). */
export const parseClaimSlot = (raw: Record<string, unknown>): { slot: number | 'all' } | null => (raw.slot === 'all' ? { slot: 'all' } : parseSlot(raw));

/** Parses the body of /api/craft/claim and /api/craft/cancel: the batch slot (default 0). */
export const parseSlot = (raw: Record<string, unknown>): { slot: number } | null =>
	raw.slot === undefined
		? { slot: 0 }
		: typeof raw.slot === 'number' && Number.isInteger(raw.slot) && raw.slot >= 0 && raw.slot < 100
			? { slot: raw.slot }
			: null;
