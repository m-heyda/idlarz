import { RECIPES, RECIPE_BY_ID, type Recipe } from '@/catalog/recipes';
import { CRAFTING } from '@/config/crafting';
import { addDrop } from '@/lib/inventory';
import { rollGear } from '@/lib/craftGear';
import { sealedRng } from '@/lib/offline/seal';
import { craftLevelOf, craftLimit, craftNeeds, craftTimeSec, craftXpOf, finishedOf, recipeResourceGold, stashKeyOf } from '@/lib/crafting';
import type { GearTarget } from '@/catalog/recipes';
import type { CraftQueueEntry, CraftRefusal, CraftReply, CraftState, Inventory } from '@/lib/offline/types';

// SERVER ONLY (with the ledger). The crafting requests (docs/plan/crafting-v0.md):
//  - craft:  a recipe WITH a time (`timeSec`) is queued as a batch (components taken from the stock now, the clock starts); a recipe without
//            one is done at once (v0.0). Nothing goes to the bag yet.
//  - claim:  the finished crafts of a batch (or of every batch, `applyClaimAll`) go into the crafting stash `craft.stock` (components, potions and
//            trade goods alike, counted by id; a rebirth keeps it) and their XP is added. What does not fit the stash cap waits in the batch (never gold).
//  - withdraw: potions and trade goods move from the stash into the bag (as many as fit) to be drunk or sold.
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

/**
 * Does or queues `count` crafts of `recipeId` at `nowMs`. Neither input is touched; the new ones are returned.
 * A timed recipe becomes a queue entry (needs a free slot); an instant one is done as in v0.0.
 */
export const applyCraft = (inv: Inventory, craft: CraftState, recipeId: string, count: number, nowMs: number): CraftResult => {
	const recipe = recipeOf(recipeId);
	if (!Number.isInteger(count) || count < 1 || count > craftLimit('craftBatchCap')) return refuse('bad_request', inv, craft);
	if (!recipe) return refuse('unknown_recipe', inv, craft);
	if (recipe.kind === 'gear' && !recipe.timeSec) return refuse('not_craftable', inv, craft);
	if (craftLevelOf(craft.xp).level < recipe.unlock) return refuse('locked', inv, craft);
	if (nowMs - craft.last < CRAFTING.minGapMs) return refuse('too_fast', inv, craft);

	const stock = takeComponents(recipe, count, craft.stock);
	if (!stock) return refuse('no_components', inv, craft);
	const spent = craft.spent + recipeResourceGold(recipe) * count;

	if (recipe.timeSec) {
		if (craft.queue.length >= craftLimit('craftQueueSlots')) return refuse('queue_full', inv, craft);
		const entry: CraftQueueEntry = { recipeId, count, startedAt: nowMs, timeSec: craftTimeSec(recipe) };
		return { ok: true, inv, queued: count, craft: { ...craft, stock: dropEmpty(stock), spent, last: nowMs, queue: [...craft.queue, entry] } };
	}

	const key = stashKeyOf(recipe);
	const made = (stock[key] ?? 0) + recipe.output.qty * count;
	if (made > CRAFTING.componentCap) return refuse('stock_full', inv, craft);
	stock[key] = made;
	return {
		ok: true,
		crafted: count,
		inv,
		craft: { ...craft, xp: craft.xp + craftXpOf(recipe, count), ord: craft.ord + count, stock: dropEmpty(stock), spent, last: nowMs },
	};
};

const isGear = (entry: CraftQueueEntry): boolean => {
	const recipe = recipeOf(entry.recipeId);
	return !!recipe && 'gear' in recipe.output;
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
	for (const want = finishedOf(entry, nowMs); n < want; n++) {
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
		craft: { ...craft, xp: craft.xp + craftXpOf(recipe, n), ord: craft.ord + n, pity: pities, queue },
	};
};

/** Pays the finished crafts of one entry into the stash as far as they fit; returns the new state (null when the batch is unknown). */
const deliver = (inv: Inventory, craft: CraftState, index: number, nowMs: number, env?: CraftEnv) => {
	const entry = craft.queue[index];
	const recipe = recipeOf(entry.recipeId);
	if (!recipe) return null;
	if ('gear' in recipe.output) return deliverGear(inv, craft, index, nowMs, recipe, recipe.output.gear, env);
	const stock = { ...craft.stock };
	const n = fitting(recipe, finishedOf(entry, nowMs), stock);
	if (n > 0) stock[stashKeyOf(recipe)] = (stock[stashKeyOf(recipe)] ?? 0) + recipe.output.qty * n;
	const left = entry.count - n;
	const queue = craft.queue.slice();
	if (left > 0) queue[index] = { ...entry, count: left, startedAt: Math.round(entry.startedAt + n * entry.timeSec * 1000) };
	else queue.splice(index, 1);
	return { n, inv, craft: { ...craft, xp: craft.xp + craftXpOf(recipe, n), ord: craft.ord + n, stock, queue } };
};

/** Delivers what is finished in batch `slot`. Whatever does not fit stays in the batch and is delivered by a later claim. */
export const applyClaim = (inv: Inventory, craft: CraftState, slot: number, nowMs: number, env?: CraftEnv): CraftResult => {
	const entry = Number.isInteger(slot) ? craft.queue[slot] : undefined;
	if (!entry || !recipeOf(entry.recipeId)) return refuse('no_batch', inv, craft);
	if (nowMs - craft.last < CRAFTING.minGapMs) return refuse('too_fast', inv, craft);
	if (finishedOf(entry, nowMs) < 1) return refuse('nothing_ready', inv, craft);
	const done = deliver(inv, craft, slot, nowMs, env);
	if (!done) return refuse('no_batch', inv, craft);
	if (done.n < 1) return refuse(isGear(entry) ? 'bag_full' : 'stock_full', inv, craft);
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
		if (!recipeOf(entry.recipeId) || finishedOf(entry, nowMs) < 1) continue;
		ready = true;
		const done = deliver(inventory, state, index, nowMs, env);
		if (!done) continue;
		if (done.n < finishedOf(entry, nowMs) && isGear(entry)) gearWaiting = true;
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

	const delivered = finishedOf(entry, nowMs) > 0 ? deliver(inv, craft, slot, nowMs, env) : null;
	const after = delivered?.craft ?? craft;
	const outInv = delivered?.inv ?? inv;
	const index = delivered && delivered.craft.queue.length < craft.queue.length ? -1 : slot; // -1: the delivery used the entry up
	const rest = index < 0 ? null : after.queue[index];
	// unfinished = crafts that are not done yet (what is done but did not fit stays as the smaller batch)
	const waiting = rest ? finishedOf(rest, nowMs) : 0;
	const cancelled = rest ? rest.count - waiting : 0;

	const stock = { ...after.stock };
	const queue = after.queue.slice();
	let spent = after.spent;
	const refund: NonNullable<CraftReply['refund']> = [];
	if (rest && cancelled > 0) {
		const needs = craftNeeds(recipe, cancelled);
		for (const c of needs.components) stock[c.id] = (stock[c.id] ?? 0) + c.qty;
		for (const r of needs.resources) refund.push({ key: r.key, qty: r.qty });
		spent = Math.max(0, spent - recipeResourceGold(recipe) * cancelled);
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
