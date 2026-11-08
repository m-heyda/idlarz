// Crafting maths, pure (no store, no server): the crafting level curve and what a recipe costs. The server (/api/craft) and the
// overlay both use these, so a level and a price are the same on both sides.
import { RESOURCES } from '@/catalog/resources';
import { RECIPES, type Recipe } from '@/catalog/recipes';
import { CRAFTING } from '@/config/crafting';

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

/** The recipe that makes a component (the first one, there is one per component). */
const makerOf = (component: string): Recipe | undefined => RECIPES.find((r) => 'component' in r.output && r.output.component === component);

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
