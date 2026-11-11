// Crafting maths, pure (no store, no server): the crafting level curve and what a recipe costs. The server (/api/craft) and the
// overlay both use these, so a level and a price are the same on both sides.
import { RESOURCES, type MerchantResourceKey } from '@/catalog/resources';
import { RECIPES, type Recipe } from '@/catalog/recipes';
import { CRAFTING } from '@/config/crafting';
import { HARD_LIMITS } from '@/config/limits';
import { limitOf, type LimitContext } from '@/lib/limits';
import type { CraftQueueEntry, CraftState } from '@/lib/offline/types';

/** XP steps, index L - 1 = XP from level L to L + 1. Same technique as the character curve: a constant ratio between anchors, solved by bisection. */
const buildSteps = (): number[] => {
	const steps: number[] = [];
	let last = CRAFTING.firstStepXp;
	let level = 1;
	let xp = 0;
	for (const [toLevel, toXp] of CRAFTING.anchors) {
		const n = toLevel - level;
		const total = toXp - xp;
		const first = (r: number) => (level === 1 ? CRAFTING.firstStepXp : last * r);
		const sumFor = (r: number) => {
			let step = first(r);
			let sum = 0;
			for (let i = 0; i < n; i++) {
				sum += step;
				step *= r;
			}
			return sum;
		};
		let lo = 1;
		let hi = 4;
		for (let i = 0; i < 200; i++) {
			const mid = (lo + hi) / 2;
			if (sumFor(mid) < total) lo = mid;
			else hi = mid;
		}
		const r = (lo + hi) / 2;
		let step = first(r);
		for (let i = 0; i < n; i++) {
			steps.push(Math.floor(step));
			last = step;
			step *= r;
		}
		level = toLevel;
		xp = toXp;
	}
	return steps;
};
const STEPS = buildSteps();

/** The crafting state of a player who never crafted (the ledger column reads as this when it is missing). */
export const emptyCraft = (): CraftState => ({ xp: 0, ord: 0, stock: {}, pity: {}, spent: 0, last: 0, queue: [] });

type CraftLimitKey = 'craftBatchCap' | 'craftQueueSlots' | 'craftOfflineHours' | 'craftSpeed';

/** A crafting limit: base plus bonuses (`limitOf`), never above its hard ceiling and never below 1. Whole numbers except the speed. */
export const craftLimit = (key: CraftLimitKey, ctx: LimitContext = {}): number => {
	const value = Math.min(limitOf(key, ctx), HARD_LIMITS[key]);
	return Math.max(1, key === 'craftSpeed' ? value : Math.floor(value));
};

/** Seconds one craft of a recipe takes now (the speed multiplier applied); 0 for an instant recipe. */
export const craftTimeSec = (recipe: Recipe, ctx: LimitContext = {}): number => (recipe.timeSec ? recipe.timeSec / craftLimit('craftSpeed', ctx) : 0);

/**
 * Crafts of a batch that are done at `nowMs`: min(count, floor(running time / timeSec)). The running time stops at the offline run cap
 * (a batch nobody claims waits there; the next claim moves `startedAt` forward and the clock runs on). No per-item timers.
 */
export const finishedOf = (entry: CraftQueueEntry, nowMs: number, ctx: LimitContext = {}): number => {
	if (!(entry.timeSec > 0)) return entry.count;
	const runMs = Math.min(Math.max(0, nowMs - entry.startedAt), craftLimit('craftOfflineHours', ctx) * 3_600_000);
	return Math.min(entry.count, Math.floor(runMs / (entry.timeSec * 1000)));
};

/** Epoch ms the batch's next craft is done (null: the batch is finished, or stopped at the offline run cap). */
export const nextDoneAt = (entry: CraftQueueEntry, nowMs: number, ctx: LimitContext = {}): number | null => {
	const done = finishedOf(entry, nowMs, ctx);
	if (done >= entry.count) return null;
	const at = entry.startedAt + (done + 1) * entry.timeSec * 1000;
	return at - entry.startedAt > craftLimit('craftOfflineHours', ctx) * 3_600_000 ? null : at;
};

/**
 * The crafting XP one payout gives: the recipe's `xp` times how many were made times `CRAFTING.xpScale` (the end-game slow-down, `config/crafting.ts`), rounded to six decimals so repeated small
 * additions never drift. The server uses this for every craft, claim and queue payout, the UI to show it.
 *
 * @category Progression/Crafting
 * @order 4
 * @formula craftXpOf = recipe.xp x count x CRAFTING.xpScale x (1 + crafting XP bonus %)   (the bonus is the Blossom Shrine Idol's)
 */
export const craftXpOf = (recipe: { xp: number }, count: number, bonusPct = 0): number =>
	Math.round(recipe.xp * count * CRAFTING.xpScale * (1 + bonusPct / 100) * 1e6) / 1e6;

/** Crafting XP to go from `level` to the next one (Infinity at the maximum). */
export const craftXpToNext = (level: number): number => {
	if (!(level >= 1)) return STEPS[0];
	if (level >= CRAFTING.maxLevel) return Infinity;
	return STEPS[Math.floor(level) - 1];
};

/** The total crafting XP at which `level` is reached (level 1 is 0). */
export const craftCumulativeXp = (level: number): number => {
	let total = 0;
	for (let l = 1; l < Math.min(level, CRAFTING.maxLevel); l++) total += craftXpToNext(l);
	return total;
};

/** Crafting level and progress (0-1) to the next level from the lifetime crafting XP. Bad input reads as 0. */
export const craftLevelOf = (xp: number): { level: number; progress: number } => {
	let remaining = Number.isFinite(xp) ? Math.max(0, xp) : 0;
	let level = 1;
	while (level < CRAFTING.maxLevel && remaining >= craftXpToNext(level)) {
		remaining -= craftXpToNext(level);
		level++;
	}
	if (level >= CRAFTING.maxLevel) return { level, progress: 1 };
	return { level, progress: remaining / craftXpToNext(level) };
};

/** The key of what a recipe makes in the crafting stash (`craft.stock`): the item id for a potion or a trade good, the component id for a component. Gear never sits in the stash (it goes to the bag), so its key is one nothing is stored under. */
export const stashKeyOf = (recipe: Recipe): string =>
	'item' in recipe.output
		? recipe.output.item
		: 'component' in recipe.output
			? recipe.output.component
			: `gear:${recipe.output.gear.grade}:${recipe.output.gear.slot}`;

/** The recipe that makes a component (the first one, there is one per component). */
const makerOf = (component: string): Recipe | undefined => RECIPES.find((r) => 'component' in r.output && r.output.component === component);

/** The gold value of the merchant resources a recipe takes itself (components are not counted: they were paid when they were made). */
export const recipeResourceGold = (recipe: Recipe): number =>
	recipe.inputs.reduce((sum, input) => ('resource' in input ? sum + input.qty * RESOURCES[input.resource].merchant.price : sum), 0);

/** The gold value of a recipe's inputs at merchant prices; a component counts at what its own recipe costs per piece made. */
export const recipeCostGold = (recipe: Recipe, seen: readonly string[] = []): number => {
	let sum = 0;
	for (const input of recipe.inputs) {
		if ('resource' in input) {
			sum += input.qty * RESOURCES[input.resource].merchant.price;
			continue;
		}
		const maker = makerOf(input.component);
		if (!maker || seen.includes(maker.id)) throw new Error(`recipe ${recipe.id}: no way to make component ${input.component}`);
		sum += (input.qty * recipeCostGold(maker, [...seen, recipe.id])) / maker.output.qty;
	}
	return sum;
};

/** What `count` crafts of a recipe take: the merchant resources (paid by the browser) and the components (taken by the server from its stock). */
export const craftNeeds = (recipe: Recipe, count: number) => {
	const resources: { key: MerchantResourceKey; qty: number }[] = [];
	const components: { id: string; qty: number }[] = [];
	for (const input of recipe.inputs) {
		if ('resource' in input) resources.push({ key: input.resource, qty: input.qty * count });
		else components.push({ id: input.component, qty: input.qty * count });
	}
	return { resources, components };
};

export type CraftBlock = 'locked' | 'resources' | 'components';

/** Why `count` crafts cannot be done now (null: they can). The server checks the level and the components again; the resources are the browser's. */
export const craftBlock = (
	recipe: Recipe,
	count: number,
	have: { craftLevel: number; resources: Partial<Record<string, number>>; stock: Record<string, number> },
): CraftBlock | null => {
	if (have.craftLevel < recipe.unlock) return 'locked';
	const needs = craftNeeds(recipe, count);
	if (needs.resources.some((n) => (have.resources[n.key] ?? 0) < n.qty)) return 'resources';
	if (needs.components.some((n) => (have.stock[n.id] ?? 0) < n.qty)) return 'components';
	return null;
};

/** Most crafts of a recipe the player can start now: the scarcest input decides, capped at the batch cap (0 when locked). */
export const maxCraftable = (
	recipe: Recipe,
	have: { craftLevel: number; resources: Partial<Record<string, number>>; stock: Record<string, number> },
): number => {
	if (have.craftLevel < recipe.unlock) return 0;
	const one = craftNeeds(recipe, 1);
	let most = craftLimit('craftBatchCap');
	for (const n of one.resources) most = Math.min(most, Math.floor((have.resources[n.key] ?? 0) / n.qty));
	for (const n of one.components) most = Math.min(most, Math.floor((have.stock[n.id] ?? 0) / n.qty));
	return Math.max(0, most);
};
