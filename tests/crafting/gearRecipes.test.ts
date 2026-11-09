import test from 'node:test';
import assert from 'node:assert/strict';
import { CRAFT_GRADES, CRAFT_SLOTS, GEAR_RECIPES, GEAR_UNLOCK, RECIPE_BY_ID, RECIPES } from '../../src/catalog/recipes';
import { ITEMS } from '../../src/catalog';
import { GRADE_INFO, gradeLevels, gradeOfItem } from '../../src/catalog/items/grades';
import { RARITIES } from '../../src/catalog/rarity';
import { CRAFT_GEAR } from '../../src/config/crafting';
import { gearItemLevels, gearOdds, gearRequest, pityMultiplier, pityRarityOf, qualityBiasOf, rarityCeilingAt, rollGear } from '../../src/lib/craftGear';
import { craftCumulativeXp, craftLimit, emptyCraft, recipeCostGold } from '../../src/lib/crafting';
import { generateLoot, rollLeaning } from '../../src/lib/loot/generate';
import { sellValueOf, instanceProblem } from '../../src/lib/itemInstance';
import { mulberry32 } from '../../src/lib/rng';
import { applyCancel, applyClaim, applyClaimAll, applyCraft, type CraftEnv } from '../../src/lib/offline/craft';
import { sealedRng } from '../../src/lib/offline/seal';
import { readInstance } from '../../src/lib/sanitizeSave';
import type { CraftState, Inventory } from '../../src/lib/offline/types';

// Gear recipes (IDL-241): data, the craft loot source, the odds, the server's claim and the gates that keep crafting from out-scaling drops.

const rng = (seed: string, n: number) => sealedRng('gear-test-secret', 'u', 0, seed, n);
const inv = (free = 36): Inventory =>
	({
		ver: 1,
		bag: Array.from({ length: 36 }, (_, i) => (i < 36 - free ? { id: 'potion_minor', qty: 1 } : null)),
		equipment: {},
		lootPity: {},
		autoSellUpTo: null,
	}) as unknown as Inventory;
const env: CraftEnv = { secret: 'gear-test-secret', userId: 'u', luck: 0, intelligence: 5 };
const T0 = 1_000_000;
const recipeFor = (grade: string, slot: string) =>
	GEAR_RECIPES.find((r) => 'gear' in r.output && r.output.gear.grade === grade && r.output.gear.slot === slot)!;
const bagItems = (i: Inventory) => i.bag.flatMap((s) => (s && 'item' in s ? [s.item] : []));
/** A state that has crafting level `level` */
const atLevel = (level: number, over: Partial<CraftState> = {}): CraftState => ({ ...emptyCraft(), xp: craftCumulativeXp(level), ...over });

test('13 slots x 4 grades = 52 timed gear recipes, unlocked at G1 1, G2 8, G3 15, G4 25', () => {
	assert.equal(GEAR_RECIPES.length, CRAFT_GRADES.length * CRAFT_SLOTS.length);
	assert.deepEqual(GEAR_UNLOCK, { G1: 1, G2: 8, G3: 15, G4: 25 });
	assert.equal(new Set(RECIPES.map((r) => r.id)).size, RECIPES.length, 'recipe ids stay unique');
	for (const r of GEAR_RECIPES) {
		assert.equal(r.kind, 'gear');
		assert.ok(r.timeSec && r.timeSec > 0, `${r.id} is timed`);
		assert.ok(r.xp > 0 && r.output.qty === 1);
		assert.equal(RECIPE_BY_ID[r.id], r);
		const g = (r.output as { gear: { grade: keyof typeof GEAR_UNLOCK } }).gear.grade;
		assert.equal(r.unlock, GEAR_UNLOCK[g]);
		assert.equal(r.timeSec, CRAFT_GEAR.timeSec[g]);
		// a recipe only asks for a component its level has unlocked: G1 (level 1) takes none
		for (const input of r.inputs)
			if ('component' in input) assert.ok(RECIPE_BY_ID[input.component].unlock <= r.unlock, `${r.id}: ${input.component} is unlocked by then`);
	}
	assert.ok(recipeFor('G1', 'chest').inputs.every((i) => 'resource' in i));
});

test('every grade and slot a recipe names has bases to roll in the grade window', () => {
	for (const r of GEAR_RECIPES) {
		const { grade, slot } = (r.output as { gear: { grade: keyof typeof GEAR_UNLOCK; slot: string } }).gear;
		const bases = ITEMS.filter((d) => d.enabled !== false && !d.tags?.includes('named') && gradeOfItem(d) === grade && d.slot === slot);
		assert.ok(bases.length > 0, `${grade} ${slot} has a base`);
	}
});

test('the item level climbs the grade window from its unlock to the next grade, and never leaves it', () => {
	for (const grade of CRAFT_GRADES) {
		const [lo, hi] = gradeLevels(grade);
		const start = gearItemLevels(grade, GEAR_UNLOCK[grade]);
		const end = gearItemLevels(grade, 80);
		assert.equal(start.min, lo, `${grade} starts at the bottom of its window`);
		assert.equal(end.max, hi, `${grade} ends at the top of its window`);
		for (let level = 1; level <= 80; level++) {
			const r = gearItemLevels(grade, level);
			assert.ok(r.min >= lo && r.max <= hi && r.min <= r.max, `${grade} at ${level}`);
		}
	}
	assert.equal(gearItemLevels('G1', 4).min <= gearItemLevels('G1', 7).min, true);
});

test('a roll is a base of the recipe slot and grade, inside the item level range, marked crafted, sealed and valid', () => {
	for (const grade of CRAFT_GRADES) {
		for (const slot of CRAFT_SLOTS) {
			for (let n = 1; n <= 12; n++) {
				const level = 8 + n * 6;
				const env2 = { craftLevel: level, luck: 50, intelligence: 40 };
				const a = rollGear({ grade, slot }, env2, rng('a', n))!;
				const b = rollGear({ grade, slot }, env2, rng('a', n))!;
				assert.deepEqual(a, b, 'the same seal rolls the same piece');
				const def = ITEMS.find((d) => d.id === a.item.base)!;
				assert.equal(gradeOfItem(def), grade);
				assert.equal(def.slot, slot);
				assert.equal(a.item.crafted, true);
				const range = gearItemLevels(grade, level);
				assert.ok(a.item.level >= range.min && a.item.level <= range.max, `${grade} ${slot}: level ${a.item.level} in ${range.min}-${range.max}`);
				assert.equal(instanceProblem(a.item), null, `${grade} ${slot} is a valid instance`);
				assert.ok(RARITIES[a.item.rarity as keyof typeof RARITIES].order <= RARITIES.rare.order, 'no epic or legendary from a plain craft');
			}
		}
	}
});

test('rarity follows the grade: G1 is always common, G3 always uncommon, G2 is common or uncommon, and Luck (rare and better) moves G4', () => {
	const share = (grade: 'G1' | 'G2' | 'G3' | 'G4', luck: number, rarity: string) => {
		let hits = 0;
		const N = 3000;
		for (let i = 0; i < N; i++)
			if (rollGear({ grade, slot: 'chest' }, { craftLevel: 80, luck, intelligence: 5 }, rng(`s${grade}`, i))!.item.rarity === rarity) hits++;
		return hits / N;
	};
	assert.equal(share('G1', 0, 'common'), 1);
	assert.equal(share('G3', 0, 'uncommon'), 1);
	assert.ok(share('G4', 250, 'rare') > share('G4', 0, 'rare') + 0.02, 'Luck makes rare likelier');
	assert.equal(share('G2', 250, 'uncommon'), share('G2', 0, 'uncommon'), 'Luck weighs rare and better only, so it does not move G2 (common and uncommon)');
	assert.ok(share('G2', 0, 'uncommon') > 0.1 && share('G2', 0, 'uncommon') < 0.4);
});

test('Intelligence leans the quality and the affix magnitudes up, and bias 0 changes nothing', () => {
	assert.equal(qualityBiasOf(5), 0);
	assert.equal(qualityBiasOf(0), 0);
	assert.equal(qualityBiasOf(55), 0.5);
	assert.equal(qualityBiasOf(100000), CRAFT_GEAR.qualityBiasCap);
	const plain = mulberry32(7);
	const zero = mulberry32(7);
	for (let i = 0; i < 50; i++) assert.equal(rollLeaning(zero, 0), Math.min(100, Math.floor(plain() * 101)));
	const mean = (intelligence: number) => {
		let sum = 0;
		const N = 2000;
		for (let i = 0; i < N; i++) sum += rollGear({ grade: 'G2', slot: 'head' }, { craftLevel: 20, luck: 0, intelligence }, rng('q', i))!.item.quality;
		return sum / N;
	};
	assert.ok(Math.abs(mean(5) - 50) < 3, 'no Intelligence: quality is uniform');
	assert.ok(mean(105) > mean(5) + 10, 'Intelligence 105 raises the mean quality by well over 10 points');
});

test('the rarity ceiling is rare below crafting level 50 and epic after; legendary is never rolled', () => {
	assert.equal(rarityCeilingAt(1), 'rare');
	assert.equal(rarityCeilingAt(49), 'rare');
	assert.equal(rarityCeilingAt(50), 'epic');
	assert.equal(rarityCeilingAt(80), 'epic');
	const req = { sourceId: 'craft', level: 40, luck: 250, maxRarity: 'uncommon', slot: 'chest' as const, minItemLevel: 31, maxItemLevel: 42 };
	for (let i = 0; i < 200; i++) {
		const r = generateLoot(req, rng('ceil', i)).drops[0];
		assert.ok(r.kind === 'gear' && RARITIES[r.item.rarity as keyof typeof RARITIES].order <= RARITIES.uncommon.order);
	}
});

test("pity: a miss of the grade's best rarity raises its odds (capped), a hit resets it, and a grade with one rarity has none", () => {
	assert.equal(pityRarityOf('G1', 1), undefined);
	assert.equal(pityRarityOf('G3', 15), undefined);
	assert.equal(pityRarityOf('G2', 8), 'uncommon');
	assert.equal(pityRarityOf('G4', 25), 'rare');
	assert.equal(pityMultiplier(0), 1);
	assert.ok(pityMultiplier(3) > 1);
	assert.equal(pityMultiplier(1000), CRAFT_GEAR.pity.maxMultiplier);
	const base = gearOdds({ grade: 'G4', slot: 'chest' }, { craftLevel: 25, luck: 0, intelligence: 5 });
	const pitied = gearOdds({ grade: 'G4', slot: 'chest' }, { craftLevel: 25, luck: 0, intelligence: 5, pity: 100 });
	const rare = (o: typeof base) => o.rarities.find((r) => r.id === 'rare')!.chance;
	assert.ok(rare(pitied) > rare(base));
	// the counter moves with the rolls
	let pity = 0;
	let sawMiss = false;
	let sawHit = false;
	for (let i = 0; i < 200 && !(sawMiss && sawHit); i++) {
		const r = rollGear({ grade: 'G4', slot: 'ring' }, { craftLevel: 25, luck: 0, intelligence: 5, pity }, rng('p', i))!;
		if (r.item.rarity === 'rare') {
			assert.equal(r.pity, 0);
			sawHit = true;
		} else {
			assert.equal(r.pity, pity + 1);
			sawMiss = true;
		}
		pity = r.pity;
	}
	assert.ok(sawMiss && sawHit);
});

test("the odds panel is the roll's own trace: the chances add up to 1 and match what generateLoot uses", () => {
	for (const grade of CRAFT_GRADES) {
		const target = { grade, slot: 'mainHand' as const };
		const env2 = { craftLevel: GEAR_UNLOCK[grade], luck: 120, intelligence: 30, pity: 4 };
		const odds = gearOdds(target, env2);
		assert.ok(Math.abs(odds.rarities.reduce((s, r) => s + r.chance, 0) - 1) < 1e-9);
		assert.deepEqual(odds.itemLevel, { min: gearRequest(target, env2).minItemLevel, max: gearRequest(target, env2).maxItemLevel });
		for (const r of odds.rarities) assert.ok(GRADE_INFO[grade].rarities.includes(r.id as never), `${grade}: ${r.id} is a rarity of the grade`);
	}
});

test("crafting never out-scales drops: the craft profile's rare-and-better share is below a chest's and a boss's at the same item level", () => {
	for (const [grade, levels] of [
		['G2', [9, 18]],
		['G4', [31, 42]],
	] as const) {
		for (let level = levels[0]; level <= levels[1]; level++) {
			const shareAbove = (sourceId: string, luck: number) => {
				const trace = generateLoot({ sourceId, level, luck, castleLevel: 1 }, () => 0.5).trace[0];
				const chances = trace.rarityChances;
				return Object.entries(chances).reduce((s, [id, c]) => s + (id === 'common' ? 0 : c), 0);
			};
			for (const luck of [0, 250]) {
				const craft = shareAbove('craft', luck);
				assert.ok(craft <= shareAbove('chest', luck) + 1e-9, `${grade} item level ${level}, Luck ${luck}: craft ${craft} vs chest`);
				assert.ok(craft <= shareAbove('boss', luck) + 1e-9, `${grade} item level ${level}, Luck ${luck}: craft vs boss`);
			}
		}
	}
});

test("even with the pity counter working, the long-run share of rare at G4 stays below a chest's", () => {
	let pity = 0;
	let rare = 0;
	const N = 6000;
	for (let i = 0; i < N; i++) {
		const r = rollGear({ grade: 'G4', slot: 'chest' }, { craftLevel: 25, luck: 0, intelligence: 5, pity }, rng('long', i))!;
		if (r.item.rarity === 'rare') rare++;
		pity = r.pity;
	}
	const chest = generateLoot({ sourceId: 'chest', level: 35 }, () => 0.5).trace[0].rarityChances.rare;
	assert.ok(rare / N <= chest, `crafted rare share ${rare / N} vs chest ${chest}`);
});

test('no gold printer: every gear recipe costs more than the mean sell value of its piece, at the top of the item level window, with Intelligence and Luck', () => {
	const N = 400;
	for (const grade of CRAFT_GRADES) {
		const cheapest = Math.min(...GEAR_RECIPES.filter((r) => 'gear' in r.output && r.output.gear.grade === grade).map((r) => recipeCostGold(r)));
		let worst = 0;
		for (const luck of [0, 250]) {
			let sum = 0;
			for (let i = 0; i < N; i++) sum += sellValueOf(rollGear({ grade, slot: 'chest' }, { craftLevel: 80, luck, intelligence: 105 }, rng(`v${luck}`, i))!.item);
			worst = Math.max(worst, sum / N);
		}
		assert.ok(cheapest > worst * 1.05, `${grade}: cheapest recipe ${Math.round(cheapest)} vs mean sell ${Math.round(worst)}`);
	}
});

// ---------------------------------------------------------------------------------------------------- the server

const queued = (grade: string, slot: string, count: number, craft: CraftState = atLevel(25)) => {
	const r = recipeFor(grade, slot);
	const out = applyCraft(inv(), craft, r.id, count, T0);
	assert.equal(out.ok, true, JSON.stringify(out.reason));
	return { r, craft: out.craft, inv: out.inv };
};

test('queueing a gear batch takes nothing but counts the resource value; it is locked below its crafting level', () => {
	const g1 = applyCraft(inv(), atLevel(1), recipeFor('G1', 'head').id, 3, T0);
	assert.equal(g1.ok, true);
	assert.equal(g1.queued, 3);
	assert.deepEqual(bagItems(g1.inv), []);
	assert.ok(g1.craft.spent > 0 && g1.craft.xp === 0 && g1.craft.ord === 0);
	assert.equal(applyCraft(inv(), atLevel(7), recipeFor('G2', 'head').id, 1, T0).reason, 'locked');
	assert.equal(applyCraft(inv(), atLevel(24), recipeFor('G4', 'head').id, 1, T0).reason, 'locked');
	assert.equal(applyCraft(inv(), atLevel(25), recipeFor('G4', 'head').id, 1, T0).reason, 'no_components', 'G4 needs Cured Leather in the stock');
});

test('claiming a gear batch rolls sealed pieces into the bag, marked crafted, with XP, the lifetime counter and the pity', () => {
	const q = queued('G1', 'chest', 4, atLevel(1));
	const done = T0 + 4 * q.r.timeSec! * 1000 + 1;
	const out = applyClaim(q.inv, q.craft, 0, done, env);
	assert.equal(out.ok, true);
	assert.equal(out.crafted, 4);
	const items = bagItems(out.inv);
	assert.equal(items.length, 4);
	assert.ok(items.every((i) => i.crafted === true && i.rarity === 'common' && instanceProblem(i) === null));
	assert.equal(out.craft.xp, q.craft.xp + 4 * q.r.xp);
	assert.equal(out.craft.ord, 4);
	assert.deepEqual(out.craft.queue, []);
	// the ordinal seals the piece: the same claim from the same state gives the same items (a replayed request), and the next batch continues the sequence
	assert.deepEqual(bagItems(applyClaim(q.inv, q.craft, 0, done, env).inv), items);
	const q2 = applyCraft(out.inv, out.craft, q.r.id, 1, done + 2000);
	const again = applyClaim(q2.inv, q2.craft, 0, done + 2000 + q.r.timeSec! * 1000, env);
	assert.deepEqual(bagItems(again.inv).slice(0, 4), items, 'the first four stay');
	const fifth = rollGear({ grade: 'G1', slot: 'chest' }, { craftLevel: 1 + 0, luck: 0, intelligence: 5 }, sealedRng('gear-test-secret', 'u', 0, 'craft', 5))!;
	assert.equal(bagItems(again.inv)[4].base, fifth.item.base, 'the fifth piece is sealed on ordinal 5');
});

test('Luck and Intelligence of the save reach the roll', () => {
	const q = queued('G4', 'ring', 10, atLevel(25, { stock: { plank_bundle: 1000 } }));
	const done = T0 + 10 * q.r.timeSec! * 1000 + 1;
	const quality = (e: CraftEnv) => {
		const out = applyClaim(q.inv, q.craft, 0, done, e);
		return bagItems(out.inv).reduce((s, i) => s + i.quality, 0) / 10;
	};
	assert.ok(quality({ ...env, intelligence: 205 }) > quality(env), 'the same ordinals roll higher quality with Intelligence');
});

test("a gear claim without the server's environment, or into a full bag, changes nothing", () => {
	const q = queued('G1', 'ring', 2, atLevel(1));
	const done = T0 + 2 * q.r.timeSec! * 1000 + 1;
	assert.equal(applyClaim(q.inv, q.craft, 0, done).ok, false, 'no environment: gear cannot be rolled');
	const full = applyClaim(inv(0), q.craft, 0, done, env);
	assert.equal(full.reason, 'bag_full');
	assert.deepEqual(full.craft, q.craft);
	assert.equal(applyClaimAll(inv(0), q.craft, done, env).reason, 'bag_full');
});

test('a bag with room for one takes one; the rest waits in the batch for a later claim', () => {
	const q = queued('G1', 'ring', 3, atLevel(1));
	const done = T0 + 3 * q.r.timeSec! * 1000 + 1;
	const out = applyClaim(inv(1), q.craft, 0, done, env);
	assert.equal(out.ok, true);
	assert.equal(out.crafted, 1);
	assert.equal(bagItems(out.inv).length, 1);
	assert.equal(out.craft.queue[0].count, 2, 'two crafts are still in the batch');
	assert.equal(out.craft.ord, 1);
	const rest = applyClaim(inv(5), out.craft, 0, done + 1000, env);
	assert.equal(rest.crafted, 2);
	assert.equal(rest.craft.ord, 3);
	// the next pieces are the ones ordinals 2 and 3 seal, whatever the bag did in between
	const all = applyClaim(inv(), q.craft, 0, done, env);
	assert.deepEqual(
		[...bagItems(out.inv), ...bagItems(rest.inv).slice(0, 2)].map((i) => i.base),
		bagItems(all.inv).map((i) => i.base),
	);
});

test("cancel delivers what is finished, refunds the rest's components and the XP is paid once", () => {
	const q = queued('G2', 'head', 3, atLevel(8, { stock: { cured_leather: 30 } }));
	const half = T0 + q.r.timeSec! * 1000 + 1;
	const out = applyCancel(q.inv, q.craft, 0, half, env);
	assert.equal(out.ok, true);
	assert.equal(out.crafted, 1);
	assert.equal(bagItems(out.inv).length, 1);
	assert.equal(out.craft.queue.length, 0);
	assert.equal(out.refund?.length, q.r.inputs.filter((i) => 'resource' in i).length);
	assert.equal(out.craft.xp, q.craft.xp + q.r.xp);
});

test("a level-up in the middle of a batch does not shift the batch's rolls: the level is read once per delivery", () => {
	const q = queued('G1', 'chest', 2, atLevel(1));
	const done = T0 + 2 * q.r.timeSec! * 1000 + 1;
	const out = applyClaim(q.inv, q.craft, 0, done, env);
	assert.equal(out.ok, true);
	assert.ok(bagItems(out.inv).every((i) => i.level >= 1 && i.level <= 8));
});

test('the batch cap still holds for gear', () => {
	assert.equal(applyCraft(inv(), atLevel(1), recipeFor('G1', 'head').id, craftLimit('craftBatchCap') + 1, T0).reason, 'bad_request');
});

// ---------------------------------------------------------------------------------------------------- the save

test('a crafted marker survives a save; anything but true is refused', () => {
	const piece = rollGear({ grade: 'G1', slot: 'head' }, { craftLevel: 1, luck: 0, intelligence: 5 }, rng('save', 1))!.item;
	const read = readInstance(structuredClone(piece));
	assert.equal(typeof read, 'object');
	assert.equal((read as { crafted?: true }).crafted, true);
	assert.equal(typeof readInstance({ ...piece, crafted: false }), 'string');
	assert.equal(typeof readInstance({ ...piece, crafted: 1 }), 'string');
	const { crafted: _crafted, ...plain } = piece;
	void _crafted;
	assert.equal((readInstance(plain) as { crafted?: true }).crafted, undefined);
});
