import { create } from 'zustand';
import { ITEM_CATALOG } from '@/catalog';
import { RECIPE_BY_ID } from '@/catalog/recipes';
import { craftBlock, craftLevelOf, craftLimit, craftNeeds, emptyCraft } from '@/lib/crafting';
import type { CraftQueueEntry, CraftRefusal, CraftReply, CraftState } from '@/lib/offline/types';
import { newClaimId } from '@/lib/offlineClient';
import { requestCraft, requestCraftCancel, requestCraftClaim, requestCraftWithdraw } from '@/lib/rewardsClient';
import { useGameStore } from '@/stores/gameStore';

// The browser's picture of the player's crafting. The server's ledger owns it (level XP, component stock); this store only holds the last
// answer. Like the shop, the browser pays the resources at once and gives them back when the server refuses; the server's answer settles the rest.

const REFUSAL: Record<CraftRefusal, string> = {
	bad_request: 'That is not a valid craft.',
	unknown_recipe: 'Unknown recipe.',
	not_craftable: 'That cannot be crafted yet.',
	locked: 'Your crafting level is too low.',
	too_fast: 'Slow down: one craft per second.',
	no_components: 'Not enough components.',
	stock_full: 'The component stock is full.',
	bag_full: 'Your bag is full.',
	not_in_stash: 'None of that in the crafting stash.',
	queue_full: 'The crafting queue is full.',
	no_batch: 'That batch is gone.',
	nothing_ready: 'Nothing is ready yet.',
};

/** One shared empty stock: a selector must hand back the same reference every time, or Zustand re-renders forever (the Crafting window crashed on it). */
export const EMPTY_STOCK: Readonly<Record<string, number>> = Object.freeze({});

/** The same shared empty list for a selector, like EMPTY_STOCK */
export const EMPTY_QUEUE: readonly CraftQueueEntry[] = Object.freeze([]);

export const selectQueue = (state: { craft: CraftState | null }): readonly CraftQueueEntry[] => state.craft?.queue ?? EMPTY_QUEUE;

export const selectStock = (state: { craft: CraftState | null }): Readonly<Record<string, number>> => state.craft?.stock ?? EMPTY_STOCK;

interface CraftStore {
	/** The last state the server sent; null until the overlay has asked */
	craft: CraftState | null;
	busy: boolean;
	/** Server clock minus this browser's clock in ms (from the last answer): the queue's progress is drawn on the server's time */
	clockOffsetMs: number;
	/** Asks the server for the crafting state (the overlay does it when it opens) */
	refresh: () => Promise<void>;
	/** Pays the resources, asks the server to craft, settles. Returns the toast text. */
	craftItem: (recipeId: string, count: number) => Promise<string>;
	/** Delivers the finished crafts of a batch. Returns the toast text. */
	claim: (slot?: number | 'all') => Promise<string>;
	/** Moves crafted potions or goods from the stash into the bag. Returns the toast text. */
	withdraw: (id: string, qty: number) => Promise<string>;
	/** Ends a batch and takes the refund. Returns the toast text. */
	cancel: (slot?: number) => Promise<string>;
}

const nameOf = (recipeId: string) => (Object.prototype.hasOwnProperty.call(RECIPE_BY_ID, recipeId) ? RECIPE_BY_ID[recipeId].name : recipeId);

export const useCraftStore = create<CraftStore>((set, get) => ({
	craft: null,
	busy: false,
	clockOffsetMs: 0,

	refresh: async () => {
		const reply = await requestCraft(newClaimId(), 'glass_vial', 0);
		if (reply.status !== 'ok') return;
		set({ craft: reply.value.craft, clockOffsetMs: reply.value.serverNowSec * 1000 - Date.now() });
		useGameStore.getState().applyServerInventory(reply.value.inv);
	},

	craftItem: async (recipeId, count) => {
		const recipe = Object.prototype.hasOwnProperty.call(RECIPE_BY_ID, recipeId) ? RECIPE_BY_ID[recipeId] : undefined;
		const state = get();
		if (!recipe || state.busy || !Number.isInteger(count) || count < 1 || count > craftLimit('craftBatchCap')) return 'Cannot craft that.';
		const craft = state.craft ?? emptyCraft();
		const game = useGameStore.getState();
		const blocked = craftBlock(recipe, count, { craftLevel: craftLevelOf(craft.xp).level, resources: game.resources, stock: craft.stock });
		if (blocked === 'locked') return REFUSAL.locked;
		if (blocked === 'components') return REFUSAL.no_components;
		if (blocked === 'resources') return 'Not enough resources.';

		// pay at once (like the shop); the server's refusal gives it back
		const needs = craftNeeds(recipe, count);
		const pay = (sign: 1 | -1) =>
			useGameStore.setState((s) => {
				const resources = { ...s.resources };
				for (const n of needs.resources) resources[n.key] = Math.max(0, resources[n.key] + sign * n.qty);
				return { resources };
			});
		pay(-1);
		set({ busy: true });
		const key = newClaimId();
		let reply = await requestCraft(key, recipeId, count);
		if (reply.status === 'unavailable') reply = await requestCraft(key, recipeId, count);
		set({ busy: false });
		if (reply.status !== 'ok') {
			pay(1);
			return 'Could not reach the server: nothing was crafted.';
		}
		const answer = reply.value;
		set({ craft: answer.craft, clockOffsetMs: answer.serverNowSec * 1000 - Date.now() });
		if (!answer.ok) {
			pay(1);
			return REFUSAL[answer.reason ?? 'bad_request'];
		}
		useGameStore.getState().applyServerInventory(answer.inv);
		return recipe.timeSec ? `Queued ${count} x ${recipe.name}` : `Crafted ${count} x ${recipe.name}`;
	},

	claim: async (slot: number | 'all' = 0) => {
		if (get().busy) return 'Wait a moment.';
		const entry = slot === 'all' ? undefined : get().craft?.queue[slot];
		set({ busy: true });
		const answer = await send(requestCraftClaim, slot);
		set({ busy: false });
		if (typeof answer === 'string') return answer;
		if (!answer.ok) return REFUSAL[answer.reason ?? 'bad_request'];
		return `Collected ${answer.crafted} x ${entry ? nameOf(entry.recipeId) : 'crafts'}`;
	},

	withdraw: async (id, qty) => {
		if (get().busy || !Number.isInteger(qty) || qty < 1) return 'Wait a moment.';
		set({ busy: true });
		const key = newClaimId();
		let reply = await requestCraftWithdraw(key, id, qty);
		if (reply.status === 'unavailable') reply = await requestCraftWithdraw(key, id, qty);
		set({ busy: false });
		if (reply.status !== 'ok') return 'Could not reach the server.';
		const answer = reply.value;
		set({ craft: answer.craft, clockOffsetMs: answer.serverNowSec * 1000 - Date.now() });
		useGameStore.getState().applyServerInventory(answer.inv);
		if (!answer.ok) return REFUSAL[answer.reason ?? 'bad_request'];
		return `Moved ${answer.moved ?? 0} x ${ITEM_CATALOG[id]?.name ?? id} to the bag`;
	},

	cancel: async (slot = 0) => {
		if (get().busy) return 'Wait a moment.';
		set({ busy: true });
		const answer = await send(requestCraftCancel, slot);
		set({ busy: false });
		if (typeof answer === 'string') return answer;
		if (!answer.ok) return REFUSAL[answer.reason ?? 'bad_request'];
		// the unfinished part's resources come back to the browser
		if (answer.refund?.length)
			useGameStore.setState((s) => {
				const resources = { ...s.resources };
				for (const r of answer.refund ?? []) resources[r.key] = resources[r.key] + r.qty;
				return { resources };
			});
		return answer.crafted > 0 ? `Batch ended: collected ${answer.crafted}, the rest refunded` : 'Batch cancelled: refunded';
	},
}));

/** Sends a claim or cancel (one retry with the same key after an outage), stores the answer and the bag. A string is the failure toast. */
const send = async (request: (key: string, slot: never) => ReturnType<typeof requestCraftClaim>, slot: number | 'all'): Promise<CraftReply | string> => {
	const key = newClaimId();
	let reply = await request(key, slot as never);
	if (reply.status === 'unavailable') reply = await request(key, slot as never);
	if (reply.status !== 'ok') return 'Could not reach the server.';
	const answer = reply.value;
	useCraftStore.setState({ craft: answer.craft, clockOffsetMs: answer.serverNowSec * 1000 - Date.now() });
	useGameStore.getState().applyServerInventory(answer.inv);
	return answer;
};
