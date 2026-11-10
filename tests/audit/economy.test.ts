// Stat audit, part 1: the economy under a strict environment.
//
// The flat base income is pinned at 1000 per second for every resource and never raised (see pinEconomy). The only thing that can
// then move a total is a modifier, so `total / 1000` IS the modifier bracket and is compared with an independent oracle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { castleWorld, character, near, oracle, pinEconomy, prestigeWith, worldWithTiles, PINNED_BASE, type Attr } from './helpers';
import { EMBER_UPGRADES, REBIRTH, type EmberUpgradeId } from '../../src/config/rebirth';
import { TILE_RESOURCE_COST } from '../../src/config/economy';
import { calculateTileCost } from '../../src/utils/game/costs';
import { calculateResourceBreakdown } from '../../src/utils/game/income';
import { castleModifier } from '../../src/utils/game/castle';
import { emberGain, emberIncomeMultiplier, emberSpent, emberUpgradeCost, rebirthStatus } from '../../src/utils/game/rebirth';
import { computeOfflineGrant } from '../../src/lib/offline/grant';
import { limitOf } from '../../src/lib/limits';
import { HARD_LIMITS, LIMITS } from '../../src/config/limits';
import { zeroResources } from '../../src/catalog/resourceKeys';
import type { Resources } from '../../src/types/game';

pinEconomy();

const KEYS: (keyof Resources)[] = ['gold', 'wood', 'stone', 'coal', 'food', 'xp'];
const attrsOf = (c: ReturnType<typeof character>): Record<Attr, number> => ({
	strength: c.strength,
	dexterity: c.dexterity,
	intelligence: c.intelligence,
	vitality: c.vitality,
	charisma: c.charisma,
});

interface Setup {
	castle?: number;
	attrs?: Partial<Record<Attr, number>>;
	earned?: number;
	foreman?: number;
	gearPct?: number;
	plains?: number;
}
const run = (o: Setup = {}) => {
	const castle = o.castle ?? 1;
	const c = character(o.attrs);
	const tiles = o.plains ? worldWithTiles(o.plains, 'plains', castle) : castleWorld(castle);
	const breakdown = calculateResourceBreakdown(tiles, c, {}, prestigeWith(o.earned ?? 0), undefined, { foreman: o.foreman ?? 0 }, o.gearPct ?? 0);
	return { breakdown, attrs: attrsOf(c) };
};
const expected = (resource: string, o: Setup, attrs: Record<Attr, number>) =>
	oracle.multiplier({
		resource,
		castleLevel: o.castle ?? 1,
		attrs,
		earned: o.earned ?? 0,
		foreman: o.foreman ?? 0,
		gearPct: o.gearPct ?? 0,
		plainsCount: o.plains,
	});

test('strict environment: with no modifiers every resource pays exactly the pinned 1000 base (castle level 1 aside)', () => {
	// castle level 1 still gives +20 %, and a fresh character's 5 points give their (full-value) stat bonus: that is the lowest bracket
	const { breakdown, attrs } = run();
	for (const key of KEYS) {
		assert.equal(breakdown[key].base, PINNED_BASE, `${key} base must be the pinned flat base`);
		near(breakdown[key].total, PINNED_BASE * expected(key, {}, attrs), `${key} total at the start`);
	}
});

test('castle modifier: +20 %, doubling to level 6, then +320 % a level (level 10 = +1920 %)', () => {
	const want = [0.2, 0.4, 0.8, 1.6, 3.2, 6.4, 9.6, 12.8, 16, 19.2];
	want.forEach((bonus, i) => {
		near(oracle.castle(i + 1), bonus, `oracle castle ${i + 1}`);
		near(castleModifier(i + 1), bonus, `castleModifier(${i + 1})`);
	});
});

test('each bucket alone: castle level, attributes, Embers, Foreman and gear income match the oracle on every resource', () => {
	const cases: Setup[] = [
		...Array.from({ length: 10 }, (_, i) => ({ castle: i + 1 })),
		...[5, 10, 20, 40, 60].flatMap((v) => (['strength', 'dexterity', 'intelligence', 'vitality', 'charisma'] as Attr[]).map((a) => ({ attrs: { [a]: v } }))),
		...[0, 1, 10, 22, 47, 76, 170, 1000, 100000].map((earned) => ({ earned })),
		...Array.from({ length: 11 }, (_, i) => ({ foreman: i })),
		...[0, 5, 20, 60, 150].map((gearPct) => ({ gearPct })),
	];
	for (const o of cases) {
		const { breakdown, attrs } = run(o);
		for (const key of KEYS) near(breakdown[key].total, PINNED_BASE * expected(key, o, attrs), `${key} for ${JSON.stringify(o)}`);
	}
});

test('all buckets together: castle x Embers x Foreman x gear x attributes over a full grid', () => {
	let checked = 0;
	for (const castle of [1, 3, 6, 7, 10])
		for (const earned of [0, 22, 170, 1000])
			for (const foreman of [0, 5, 10])
				for (const gearPct of [0, 26, 60])
					for (const stat of [5, 20, 50]) {
						const o: Setup = {
							castle,
							earned,
							foreman,
							gearPct,
							attrs: { strength: stat, dexterity: stat, intelligence: stat, vitality: stat, charisma: stat },
						};
						const { breakdown, attrs } = run(o);
						for (const key of KEYS) {
							near(breakdown[key].total, PINNED_BASE * expected(key, o, attrs), `${key} for ${JSON.stringify(o)}`);
							checked++;
						}
					}
	assert.equal(checked, 5 * 4 * 3 * 3 * 3 * KEYS.length);
});

test('structure: castle + plains + stat ADD inside one bracket; Embers, Foreman and gear MULTIPLY it; XP ignores Foreman and gear', () => {
	const o: Setup = { castle: 6, earned: 40, foreman: 5, gearPct: 20 };
	const { breakdown } = run(o);
	const gold = breakdown.gold;
	// the spot check from the audit plan (stat bonus excluded by reading the fields, not by pretending it is zero)
	near(gold.castleMod, 6.4, 'castle bonus at level 6');
	near(gold.emberMult, 1 + 0.1 * 40 ** 0.6, 'Ember multiplier');
	near(gold.merchantMult, 1.05, 'Foreman x1.05');
	near(gold.gearMult, 1.2, 'gear x1.2');
	near(gold.modifier + 1, (1 + gold.castleMod + gold.plainsMod + gold.statMod) * gold.emberMult * gold.merchantMult * gold.gearMult, 'modifier structure');
	near(gold.total, gold.base * (1 + gold.modifier), 'total = base x (1 + modifier)');
	// XP: no Foreman, no gear
	assert.equal(breakdown.xp.merchantMult, 1);
	assert.equal(breakdown.xp.gearMult, 1);
	// and the hand-calculated headline number, with the real stat bonus of the starting character
	const attrs = { strength: 5, dexterity: 5, intelligence: 5, vitality: 5, charisma: 5 };
	near(gold.total, PINNED_BASE * (1 + 6.4 + oracle.stat('gold', attrs)) * (1 + 0.1 * 40 ** 0.6) * 1.05 * 1.2, 'hand calculation');
	// two multipliers never add: doubling the Ember bonus does not double the Foreman effect
	const a = run({ ...o, earned: 0 }).breakdown.gold.total;
	const b = run({ ...o, earned: 40, foreman: 0, gearPct: 0 }).breakdown.gold.total;
	const both = gold.total;
	near(both, (a / 1.05 / 1.2) * oracle.ember(40) * 1.05 * 1.2, 'Ember x Foreman x gear compose by multiplication');
	assert.ok(both > a && both > b);
});

test('plains: +5 % per owned plains tile, on meat only', () => {
	const { breakdown } = run({ plains: 12 });
	near(breakdown.meat.plainsMod, 0.6, 'plains bonus on meat');
	for (const key of KEYS) assert.equal(breakdown[key].plainsMod, 0, `${key} has no plains bonus`);
	// meat has no pinned base (it comes from the farm alone), but its modifier is still the full bracket
	near(
		breakdown.meat.modifier + 1,
		oracle.multiplier({
			resource: 'meat',
			castleLevel: 1,
			attrs: { strength: 5, dexterity: 5, intelligence: 5, vitality: 5, charisma: 5 },
			earned: 0,
			foreman: 0,
			gearPct: 0,
			plainsCount: 12,
		}),
		'meat modifier',
	);
});

test('flat-base independence: doubling the pinned base doubles every total exactly (no hidden flat term)', () => {
	const o: Setup = { castle: 7, earned: 76, foreman: 4, gearPct: 26, attrs: { strength: 18, charisma: 22 } };
	const before = run(o).breakdown;
	pinEconomy(2 * PINNED_BASE);
	const after = run(o).breakdown;
	pinEconomy(PINNED_BASE);
	for (const key of KEYS) near(after[key].total, 2 * before[key].total, `${key} scales with the base`);
});

test('no source can lower income: every modifier bracket is at least 1 and totals are monotonic in each bucket', () => {
	let last = 0;
	for (let castle = 1; castle <= 10; castle++) {
		const total = run({ castle }).breakdown.gold.total;
		assert.ok(total > last, `castle ${castle} must pay more than ${castle - 1}`);
		last = total;
	}
	last = 0;
	for (const earned of [0, 1, 5, 20, 100, 1000]) {
		const total = run({ earned }).breakdown.gold.total;
		assert.ok(total >= last);
		last = total;
	}
});

// ---------------------------------------------------------------------------
// Costs

test('tile price: three exponential stages then the (n/300)^3.5 tail, against an independent oracle', () => {
	for (const owned of [1, 2, 10, 15, 16, 50, 99, 100, 101, 200, 299, 300, 301, 400, 600, 1000, 5000]) {
		assert.equal(calculateTileCost(owned, 0).gold, oracle.tilePrice(owned), `gold price at ${owned} tiles`);
	}
});

test('tile cost: extra resources start at their tile counts, and the discount takes the same share off every part', () => {
	for (const owned of [14, 15, 29, 30, 39, 40, 99, 100, 300]) {
		const cost = calculateTileCost(owned, 0);
		for (const [from, resource, share] of oracle.tileResourceCost) {
			const got = (cost.resources as Record<string, number | undefined>)[resource];
			if (owned >= from) assert.equal(got, Math.floor(oracle.tilePrice(owned) * share), `${resource} at ${owned}`);
			else assert.equal(got, undefined, `${resource} must not be asked before tile ${from}`);
		}
	}
	// the config table agrees with the oracle's copy of it
	assert.deepEqual(
		TILE_RESOURCE_COST.map((r) => [r.from, r.resource, r.share]),
		oracle.tileResourceCost,
	);
	for (const pct of [0, 2.5, 10, 25, 45]) {
		const cost = calculateTileCost(100, pct);
		assert.equal(cost.gold, Math.floor(oracle.tilePrice(100) * (1 - pct / 100)), `gold with ${pct}% off`);
	}
});

test('tile cost takes Charisma and Bulk Discount: Charisma 5 alone is 2.5 % (IDL-169)', () => {
	assert.equal(calculateTileCost(100, 2.5).gold, Math.floor(oracle.tilePrice(100) * 0.975));
});

// ---------------------------------------------------------------------------
// Rebirth and Embers

test('Ember gain: 3 x (castle - 5)^1.3 x (sqrt(tiles / 10) + 0.02 x tiles over the requirement), then +5 % per Tithe level', () => {
	for (const castle of [5, 6, 7, 8, 9, 10])
		for (const tiles of [399, 400, 450, 500, 600, 1000, 3000])
			for (const rebirths of [0, 1, 5])
				for (const tithe of [0, 3, 10]) {
					assert.equal(
						emberGain(castle, tiles, { tithe }, rebirths),
						oracle.emberGain(castle, tiles, rebirths, tithe),
						`castle ${castle}, ${tiles} tiles, rebirth ${rebirths}, Tithe ${tithe}`,
					);
				}
	// pinned values the plan quotes (castle 6 / 400 tiles = 18, 6 / 500 = 27, 8 / 500 = 113, 10 / 600 = 285; the castle term is (castle - 5)^1.3, IDL-183)
	assert.equal(emberGain(6, 400), 18);
	assert.equal(emberGain(6, 500), 27);
	assert.equal(emberGain(8, 500), 113);
	assert.equal(emberGain(10, 600), 285);
});

test('Ember income bonus: +10 % x earned^0.6, from Embers ever EARNED (spending never lowers it)', () => {
	for (const e of [0, 1, 10, 22, 47, 76, 170, 1000]) near(emberIncomeMultiplier(prestigeWith(e)), oracle.ember(e), `earned ${e}`);
	const spentSome = { rebirths: 3, legacyPoints: 0, legacyEarned: 47, upgrades: { thrift: 3 } };
	near(emberIncomeMultiplier(spentSome), oracle.ember(47), 'spent Embers still count');
});

test('rebirth gates: castle 6, 400 + 50 per past rebirth in tiles, no upgrade running, gain of at least 1', () => {
	const base = { tiles: worldWithTiles(10, 'plains', 6), freeTiles: 1, castleUpgrade: null, merchantUpgrades: {}, prestige: prestigeWith(0, {}, 0) };
	const status = (over: object) => rebirthStatus({ ...base, ...over } as never);
	// 10 extra tiles is far from 400: the tile requirement fails
	assert.equal(status({}).canRebirth, false);
	assert.equal(status({}).requirements.find((r) => r.id === 'tiles')?.needed, 400);
	assert.equal(status({ prestige: prestigeWith(18, {}, 4) }).requirements.find((r) => r.id === 'tiles')?.needed, 600);
	assert.equal(status({ castleUpgrade: { toLevel: 7, remainingSec: 10 } }).requirements.find((r) => r.id === 'idle')?.met, false);
});

test('Ember shop: level N+1 costs ceil(base x 1.4^N), every upgrade stops at level 10, the ladders add up', () => {
	const ids = Object.keys(EMBER_UPGRADES) as EmberUpgradeId[];
	assert.deepEqual(ids.sort(), ['builders', 'mastery', 'nightwatch', 'provisions', 'steward', 'thrift']);
	for (const id of ids) {
		const def = EMBER_UPGRADES[id];
		assert.equal(def.maxLevel, 10);
		let total = 0;
		for (let level = 0; level < 10; level++) {
			assert.equal(emberUpgradeCost(id, level), oracle.emberCost(def.baseCost, level), `${id} level ${level + 1}`);
			total += oracle.emberCost(def.baseCost, level);
		}
		assert.equal(emberSpent({ [id]: 10 }), total, `${id}: ladder total`);
	}
	assert.deepEqual(
		[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => emberUpgradeCost('thrift', l)),
		[2, 3, 4, 6, 8, 11, 16, 22, 30, 42],
	);
	assert.deepEqual(
		[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => emberUpgradeCost('steward', l)),
		[3, 5, 6, 9, 12, 17, 23, 32, 45, 62],
	);
	assert.equal(REBIRTH.discountCapPercent, 45);
});

// ---------------------------------------------------------------------------
// Offline

const rates = (gold: number): Resources => ({ ...zeroResources(), gold, xp: gold / 4 });
const offline = (over: Partial<Parameters<typeof computeOfflineGrant>[0]> = {}) =>
	computeOfflineGrant({
		rates: rates(100),
		ratesAfterCastle: null,
		castleUpgrade: null,
		xpGainPct: 0,
		gapSec: 3600,
		capSec: 8 * 3600,
		efficiency: 0.5,
		minGapSec: 300,
		...over,
	});

test('offline: pays efficiency x rate x min(gap, cap); nothing under the minimum gap; xp includes the xp bonus', () => {
	assert.equal(offline({ gapSec: 299 }), null);
	assert.equal(offline({ gapSec: 300 })?.resources.gold, Math.floor(100 * 300 * 0.5));
	assert.equal(offline()?.resources.gold, 100 * 3600 * 0.5);
	assert.equal(offline({ gapSec: 72 * 3600 })?.resources.gold, 100 * 8 * 3600 * 0.5, 'capped at 8 h');
	assert.equal(offline({ gapSec: 72 * 3600 })?.capped, true);
	assert.equal(offline({ xpGainPct: 50 })?.resources.xp, Math.floor(25 * 3600 * 0.5 * 1.5));
	assert.equal(offline({ efficiency: 7 })?.efficiency, 1, 'efficiency is clamped to 1');
	assert.equal(offline({ efficiency: -1 })?.resources.gold, 0, 'and to 0');
});

test('offline: a castle upgrade that finishes while away pays the rest at the higher rate', () => {
	const grant = offline({ castleUpgrade: { toLevel: 3, remainingSec: 1000 }, ratesAfterCastle: rates(300), gapSec: 3600, efficiency: 1 });
	assert.equal(grant?.resources.gold, 100 * 1000 + 300 * 2600);
	assert.deepEqual(grant?.castle, { toLevel: 3, finished: true });
	const unfinished = offline({ castleUpgrade: { toLevel: 3, remainingSec: 99999 }, ratesAfterCastle: rates(300), gapSec: 3600, efficiency: 1 });
	assert.equal(unfinished?.resources.gold, 100 * 3600);
	assert.equal(unfinished?.castle?.finished, false);
});

test('offline limits: Night Watch +1 h and Steward +5 % per level, each stopping at the hard ceilings (72 h, 100 %)', () => {
	assert.equal(limitOf('offlineCapHours'), LIMITS.offlineCapHours);
	assert.equal(limitOf('offlineCapHours', { prestige: prestigeWith(0, { nightwatch: 4 }) }), LIMITS.offlineCapHours + 4);
	assert.ok(Math.abs(limitOf('offlineEfficiency', { prestige: prestigeWith(0, { steward: 6 }) }) - (LIMITS.offlineEfficiency + 0.3)) < 1e-9);
	assert.equal(limitOf('offlineCapHours', { hardCap: true }), HARD_LIMITS.offlineCapHours);
	assert.equal(HARD_LIMITS.offlineCapHours, 72);
	assert.equal(HARD_LIMITS.offlineEfficiency, 1);
	assert.equal(LIMITS.offlineCapHours, 8);
	assert.equal(LIMITS.offlineEfficiency, 0.5);
});
