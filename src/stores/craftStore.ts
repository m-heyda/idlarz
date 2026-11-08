import { create } from 'zustand';
import { RECIPE_BY_ID } from '@/catalog/recipes';
import { CRAFTING } from '@/config/crafting';
import { craftBlock, craftLevelOf, craftNeeds, emptyCraft } from '@/lib/crafting';
import type { CraftRefusal, CraftState } from '@/lib/offline/types';
import { newClaimId } from '@/lib/offlineClient';
import { requestCraft } from '@/lib/rewardsClient';
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
};

/** One shared empty stock: a selector must hand back the same reference every time, or Zustand re-renders forever (the Crafting window crashed on it). */
export const EMPTY_STOCK: Readonly<Record<string, number>> = Object.freeze({});

export const selectStock = (state: { craft: CraftState | null }): Readonly<Record<string, number>> => state.craft?.stock ?? EMPTY_STOCK;

interface CraftStore {
	/** The last state the server sent; null until the overlay has asked */
	craft: CraftState | null;
	busy: boolean;
	/** Asks the server for the crafting state (the overlay does it when it opens) */
	refresh: () => Promise<void>;
	/** Pays the resources, asks the server to craft, settles. Returns the toast text. */
	craftItem: (recipeId: string, count: number) => Promise<string>;
}

export const useCraftStore = create<CraftStore>((set, get) => ({
	craft: null,
	busy: false,

	refresh: async () => {
		const reply = await requestCraft(newClaimId(), 'glass_vial', 0);
		if (reply.status !== 'ok') return;
		set({ craft: reply.value.craft });
		useGameStore.getState().applyServerInventory(reply.value.inv);
	},

	craftItem: async (recipeId, count) => {
		const recipe = Object.prototype.hasOwnProperty.call(RECIPE_BY_ID, recipeId) ? RECIPE_BY_ID[recipeId] : undefined;
		const state = get();
		if (!recipe || state.busy || !Number.isInteger(count) || count < 1 || count > CRAFTING.maxCount) return 'Cannot craft that.';
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
		set({ craft: answer.craft });
		if (!answer.ok) {
			pay(1);
			return REFUSAL[answer.reason ?? 'bad_request'];
		}
		useGameStore.getState().applyServerInventory(answer.inv);
		const text = `Crafted ${count} x ${recipe.name}`;
		return text;
	},
}));
