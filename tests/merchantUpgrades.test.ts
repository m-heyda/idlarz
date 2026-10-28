import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, rawSnapshot, store } from './helpers';
import { ANIMALS, CASTLE_X, CASTLE_Y, INITIAL_CHARACTER_STATS, MERCHANT_UPGRADES, MERCHANT_UPGRADE_GROUPS, REBIRTH, type MerchantUpgradeId } from '../src/config/gameConfig';
import { COMBAT, STAT_RULES } from '../src/config/combatConfig';
import { STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { effectiveStats } from '../src/lib/effectiveStats';
import { attacksPerSecond, critOdds, damagePerHit, lifeLeechPercent, NO_COMBAT_BONUS } from '../src/lib/combat';
import { plainItem } from '../src/lib/itemInstance';
import { shelfCells } from '../src/lib/merchant';
import { playerProfile } from '../src/lib/offline/profile';
import { sanitizeSave } from '../src/lib/sanitizeSave';
import {
	calculateCombatStats,
	calculateResourceRates,
	legacyGain,
	merchantCombat,
	merchantIncomeMultiplier,
	merchantUpgradeCost,
} from '../src/utils/gameUtils';
import { patchTile } from '../src/utils/world';
import type { CharacterStats, Equipment, MerchantStock } from '../src/types/game';

const IDS = Object.keys(MERCHANT_UPGRADES) as MerchantUpgradeId[];
const RESETTING = IDS.filter((id) => id !== 'packrat');
const ladder = (id: MerchantUpgradeId) => Array.from({ length: MERCHANT_UPGRADES[id].maxLevel }, (_, level) => merchantUpgradeCost(id, level));
const total = (ids: MerchantUpgradeId[]) => ids.reduce((sum, id) => sum + ladder(id).reduce((a, b) => a + b, 0), 0);

const stats = (): CharacterStats => Object.assign({ ...INITIAL_CHARACTER_STATS }, calculateCombatStats(INITIAL_CHARACTER_STATS));
const fx = (merchantUpgrades: Record<string, number>, equipment: Equipment = STARTER_EQUIPMENT) => effectiveStats({ characterStats: stats(), equipment, merchantUpgrades });

// ---------------------------------------------------------------------------------------------------- the gold sink

// By the first rebirth (castle 6, about day 5-6 in docs/generated/sim-milestones.md) the player has paid the castle and the tiles and has
// roughly this much gold to spare. The upgrades are the late gold sink: all of them together are bought over several runs, never in the first.
const SPARE_GOLD_FIRST_REBIRTH = 100e6;

test('gold sink: every ladder gets dearer with each level and its first levels are cheap', () => {
	for (const id of IDS) {
		const costs = ladder(id);
		costs.forEach((cost, i) => i > 0 && assert.ok(cost > costs[i - 1], `${id} level ${i + 1}`));
		assert.ok(costs[0] <= 750_000, `${id} starts cheap (${costs[0]})`);
		if (id !== 'packrat') assert.ok(costs[Math.min(2, costs.length - 1)] <= 3_000_000, `${id} level 3`);
	}
});

test('gold sink: all the upgrades that start again with a rebirth cost far more than a player has to spare before the first one', () => {
	const all = total(RESETTING);
	assert.ok(all >= 5 * SPARE_GOLD_FIRST_REBIRTH, `${(all / 1e6).toFixed(0)}M in all`);

	// spend the spare gold on the cheapest next level, again and again: most of the ladders stay out of reach
	const next = Object.fromEntries(RESETTING.map((id) => [id, 0]));
	let spare = SPARE_GOLD_FIRST_REBIRTH;
	for (;;) {
		const open = RESETTING.filter((id) => next[id] < MERCHANT_UPGRADES[id].maxLevel);
		const cheapest = open.map((id) => ({ id, cost: merchantUpgradeCost(id, next[id]) })).sort((a, b) => a.cost - b.cost)[0];
		if (!cheapest || cheapest.cost > spare) break;
		spare -= cheapest.cost;
		next[cheapest.id]++;
	}
	const bought = RESETTING.reduce((sum, id) => sum + ladder(id).slice(0, next[id]).reduce((a, b) => a + b, 0), 0);
	assert.ok(bought / all < 0.2, `a first run can pay ${((bought / all) * 100).toFixed(0)}% of the ladders`);
	for (const id of RESETTING) assert.ok(next[id] < MERCHANT_UPGRADES[id].maxLevel, `${id} cannot be maxed in the first run`);
});

test('every upgrade has a known group, and the three groups are all used', () => {
	for (const id of IDS) assert.ok(MERCHANT_UPGRADES[id].group in MERCHANT_UPGRADE_GROUPS, id);
	for (const group of Object.keys(MERCHANT_UPGRADE_GROUPS)) assert.ok(IDS.some((id) => MERCHANT_UPGRADES[id].group === group), group);
});

// ---------------------------------------------------------------------------------------------------- combat effects

test('combat upgrades: no upgrade changes nothing, and each one moves exactly its own readout', () => {
	assert.deepEqual(fx({}), effectiveStats({ characterStats: stats(), equipment: STARTER_EQUIPMENT }), 'an empty map equals none');
	assert.deepEqual(merchantCombat({}), NO_COMBAT_BONUS);
	const base = fx({});

	const swift = fx({ swift: 4 });
	assert.ok(swift.attacksPerSecond > base.attacksPerSecond);
	assert.equal(swift.critChance, base.critChance);

	const keen = fx({ keen: 4 });
	assert.ok(Math.abs(keen.critChance - base.critChance - 4) < 1e-9, 'one percentage point per level');
	assert.equal(keen.superCritChance, base.superCritChance);

	const deadly = fx({ deadly: 4 });
	assert.ok(Math.abs(deadly.superCritChance - base.superCritChance - 4) < 1e-9);
	assert.equal(deadly.critChance, base.critChance);

	assert.ok(fx({ might: 8 }, { ...STARTER_EQUIPMENT, mainHand: plainItem('iron_sword') }).damage > fx({}, { ...STARTER_EQUIPMENT, mainHand: plainItem('iron_sword') }).damage);

	const fang = fx({ fang: 6 });
	assert.ok(Math.abs(fang.lifeLeech - base.lifeLeech - 3) < 1e-9, '0.5 % per level');

	const wind = fx({ wind: 4 });
	assert.ok(Math.abs(wind.hpRegen - base.hpRegen - 1) < 1e-9, '0.25 HP/s per level');
});

test('Might helps physical weapons and Arcana helps staves and wands, not the other way round', () => {
	const sword: Equipment = { ...STARTER_EQUIPMENT, mainHand: plainItem('iron_sword') };
	const staff: Equipment = { ...STARTER_EQUIPMENT, mainHand: plainItem('oak_staff') };
	const hit = (equipment: Equipment, upgrades: Record<string, number>) => damagePerHit(equipment, stats(), merchantCombat(upgrades));
	assert.ok(hit(sword, { might: 8 }) > hit(sword, {}));
	assert.equal(hit(sword, { arcana: 8 }), hit(sword, {}));
	assert.ok(hit(staff, { arcana: 8 }) > hit(staff, {}));
	assert.equal(hit(staff, { might: 8 }), hit(staff, {}));
});

test('combat upgrades never break the caps: crit, super crit and life leech', () => {
	const maxed = Object.fromEntries(IDS.map((id) => [id, MERCHANT_UPGRADES[id].maxLevel]));
	const all = fx(maxed);
	assert.ok(all.critChance <= COMBAT.crit.maxCritChance);
	assert.ok(all.superCritChance <= COMBAT.crit.maxSuperChance);
	assert.ok(all.lifeLeech <= STAT_RULES.lifeLeechCap);
	// whatever the bonus, the caps hold
	const huge = { ...NO_COMBAT_BONUS, critPct: 500, superCritPct: 500, leechPct: 500 };
	const odds = critOdds(stats(), STARTER_EQUIPMENT, huge);
	assert.equal(odds.crit, COMBAT.crit.maxCritChance / 100);
	assert.equal(odds.superCrit, COMBAT.crit.maxSuperChance / 100);
	assert.equal(lifeLeechPercent(STARTER_EQUIPMENT, huge), STAT_RULES.lifeLeechCap);
	assert.equal(attacksPerSecond(STARTER_EQUIPMENT, stats(), NO_COMBAT_BONUS), attacksPerSecond(STARTER_EQUIPMENT, stats()), 'no bonus, no change');
});

test('the server\'s fights use the upgrades of the last accepted save', () => {
	const core = (merchantUpgrades?: Record<string, number>) => ({ equipment: STARTER_EQUIPMENT, characterStats: { ...stats() }, level: { level: 5, progress: 0 }, merchantUpgrades });
	const none = playerProfile(core());
	const some = playerProfile(core({ swift: 3, keen: 2, deadly: 1, fang: 2, wind: 4 }));
	assert.ok(some.attacksPerSec > none.attacksPerSec);
	assert.ok(Math.abs(some.crit - none.crit - 0.02) < 1e-9);
	assert.ok(Math.abs(some.superCrit - none.superCrit - 0.01) < 1e-9);
	assert.ok(Math.abs(some.leechPct - none.leechPct - 1) < 1e-9);
	assert.ok(Math.abs(some.hpRegen - none.hpRegen - 1) < 1e-9);
	assert.deepEqual(playerProfile(core({})), none);
	// a forged or broken record changes nothing and does not throw
	assert.deepEqual(playerProfile(core({ cheat: 99, swift: Number.NaN, keen: 1e9 } as never)).attacksPerSec, none.attacksPerSec);
	assert.ok(playerProfile(core({ keen: 1e9 })).crit <= COMBAT.crit.maxCritChance / 100, 'a level above the maximum counts as the maximum');
});

// ---------------------------------------------------------------------------------------------------- production and rebirth

test('Foreman raises the income of every resource but XP, Skinner only the meat and the hide', () => {
	freshGame();
	growTo(30);
	const s = api();
	const farmLevels = Object.fromEntries(ANIMALS.map((a) => [a.id, 5]));
	const rates = (merchantUpgrades?: Record<string, number>) => calculateResourceRates(s.tiles, s.characterStats, farmLevels, s.prestige, s.farmUpgrades, merchantUpgrades).total;
	const base = rates();

	const foreman = rates({ foreman: 10 });
	assert.equal(merchantIncomeMultiplier({ foreman: 10 }), 1.1);
	for (const key of ['gold', 'wood', 'stone', 'coal', 'food', 'meat', 'eggs', 'milk', 'hide'] as const) assert.ok(Math.abs(foreman[key] - base[key] * 1.1) < 1e-6 * Math.max(1, base[key]), key);
	assert.equal(foreman.xp, base.xp, 'XP is not an income of the merchant');

	const skinner = rates({ skinner: 8 });
	assert.ok(base.hide > 0 && base.meat > 0, 'the farm makes both');
	assert.ok(skinner.hide > base.hide, 'more hide');
	assert.ok(skinner.meat > base.meat, 'more meat');
	assert.ok(skinner.hide <= base.hide * 1.4 + 1e-9, 'at most +5 % x 8 on the farm part');
	for (const key of ['gold', 'wood', 'stone', 'coal', 'food', 'eggs', 'milk', 'xp'] as const) assert.equal(skinner[key], base[key], key);
	assert.deepEqual(rates({}), base);
});

test('buying Foreman or Skinner changes the income at once', () => {
	freshGame({ gold: 1e12 });
	growTo(20);
	const before = api().resourceRates.total.gold;
	assert.equal(api().buyMerchantUpgrade('foreman'), true);
	assert.ok(Math.abs(api().resourceRates.total.gold - before * 1.01) < 1e-9 * Math.max(1, before));
	const meat = api().resourceRates.total.meat;
	assert.equal(api().buyMerchantUpgrade('skinner'), true);
	assert.ok(api().resourceRates.total.meat >= meat);
});

test('Ancestral Tithe: +5 % Legacy points per level (rounded down), and it is spent with the rebirth', () => {
	assert.equal(legacyGain(8, 100), REBIRTH.gain(8, 100));
	assert.equal(legacyGain(8, 100, {}), REBIRTH.gain(8, 100));
	const gain = REBIRTH.gain(8, 100);
	assert.equal(legacyGain(8, 100, { tithe: 10 }), Math.floor(gain * 1.5));
	assert.equal(legacyGain(8, 100, { tithe: 1 }), Math.floor(gain * 1.05));
	assert.equal(legacyGain(5, 100, { tithe: 10 }), 0, 'nothing from a castle that is too low');

	freshGame({ gold: 1e12 });
	growTo(REBIRTH.minTiles);
	store.setState((st) => ({ tiles: patchTile(st.tiles, CASTLE_X, CASTLE_Y, { level: 8 }) }));
	for (let i = 0; i < 10; i++) assert.equal(api().buyMerchantUpgrade('tithe'), true);
	assert.equal(api().buyMerchantUpgrade('tithe'), false, 'max level');
	const expected = legacyGain(8, api().tiles.stats.owned ?? 0, api().merchantUpgrades);
	const owned = api().prestige.legacyPoints;
	assert.equal(api().rebirth(), true);
	assert.ok(api().prestige.legacyPoints - owned >= 1);
	assert.ok(expected >= 0);
	assert.deepEqual(api().merchantUpgrades, {}, 'the upgrades start again, so the next rebirth needs them again');
});

// ---------------------------------------------------------------------------------------------------- rebirth reset and saves

test('every new upgrade can be bought up to its maximum, costs gold, and starts again with a rebirth (the bag room stays)', () => {
	freshGame({ gold: 1e12 });
	growTo(REBIRTH.minTiles);
	store.setState((st) => ({ tiles: patchTile(st.tiles, CASTLE_X, CASTLE_Y, { level: REBIRTH.minCastleLevel }) }));
	for (const id of IDS) {
		for (let level = 0; level < MERCHANT_UPGRADES[id].maxLevel; level++) {
			const gold = api().resources.gold;
			assert.equal(api().buyMerchantUpgrade(id), true, `${id} ${level + 1}`);
			assert.equal(gold - api().resources.gold, merchantUpgradeCost(id, level));
		}
		assert.equal(api().buyMerchantUpgrade(id), false, `${id} maxed`);
	}
	api().tick(1000); // the levels the cheated tiles gave are counted (stat points), as in the other save tests
	const saved = sanitizeSave(rawSnapshot());
	assert.equal(saved.ok, true, saved.ok ? '' : `the save with everything maxed is valid: ${saved.reason}`);
	assert.equal(api().rebirth(), true);
	assert.deepEqual(api().merchantUpgrades, { packrat: MERCHANT_UPGRADES.packrat.maxLevel });
});

test('saves: a level above the maximum or an unknown upgrade is rejected, a normal level is accepted', () => {
	freshGame({ gold: 1e12 });
	api().buyMerchantUpgrade('foreman');
	api().buyMerchantUpgrade('fang');
	const raw = rawSnapshot();
	const ok = sanitizeSave(raw);
	assert.equal(ok.ok, true, ok.ok ? '' : ok.reason);
	if (ok.ok) assert.deepEqual(ok.state.merchantUpgrades, { foreman: 1, fang: 1 });
	for (const [id, level] of [['foreman', MERCHANT_UPGRADES.foreman.maxLevel + 1], ['fang', 99], ['tithe', -1], ['bogus', 1]] as const) {
		const bad = JSON.parse(JSON.stringify(raw));
		bad.merchantUpgrades[id] = level;
		assert.equal(sanitizeSave(bad).ok, false, `${id} ${level}`);
	}
});

// ---------------------------------------------------------------------------------------------------- the shelf

const stock = (bases: string[], at = 1234): MerchantStock => ({ at, offers: bases.map((base, i) => ({ ...plainItem(base), level: 3 + i })) });

test('the shelf mixes gear and potions in a fixed order that does not jump when a piece is bought', () => {
	const supplies = ['potion_minor', 'potion_greater'];
	const full = stock(['iron_sword', 'oak_staff', 'apprentice_wand', 'iron_sword', 'oak_staff', 'apprentice_wand']);
	const cells = shelfCells(full, supplies);
	assert.equal(cells.length, 8, 'six pieces and both potions on one shelf');
	assert.deepEqual(cells, shelfCells(full, supplies), 'stable between renders');
	assert.equal(new Set(cells.map((c) => c.key + (c.kind === 'offer' ? c.index : ''))).size, 8);
	assert.ok(cells.some((c) => c.kind === 'supply') && cells.some((c) => c.kind === 'offer'));

	// buying one: the others keep their relative order
	const order = (list: ReturnType<typeof shelfCells>) => list.map((c) => c.key);
	const sold = { ...full, offers: full.offers.filter((_, i) => i !== 2) };
	const after = order(shelfCells(sold, supplies));
	const before = order(cells).filter((key, i, all) => !(key === cells.find((c) => c.kind === 'offer' && c.index === 2)!.key && all.indexOf(key) === i));
	assert.equal(after.length, 7);
	assert.deepEqual(after.filter((k) => k.startsWith('supply')), before.filter((k) => k.startsWith('supply')), 'the potions stay in their order');

	// a new stock is another shuffle, an empty one still shows the potions
	assert.notDeepEqual(order(shelfCells({ ...full, at: 99999 }, supplies)), order(cells));
	assert.equal(shelfCells(null, supplies).length, 2);
});
