import test from 'node:test';
import assert from 'node:assert/strict';
import { freshGame, api } from './helpers';
import { SETS, formatStat } from '../src/catalog';
import { fullSet } from '../src/lib/fightSim';
import { gearEconomy, gearIncomePct, xpGainPct, NO_GEAR_ECONOMY } from '../src/lib/gearEconomy';
import { summarize, DEFAULT_DERIVED } from '../src/lib/cloudSave/summary';
import { pickPersisted } from '../src/lib/sanitizeSave';
import { killIncome } from '../src/lib/loot/kill';
import { damagePerHit, maxHp } from '../src/lib/combat';
import { offlineCapHours, offlineEfficiency } from '../src/lib/offline/limits';
import { computeOfflineGrant, zeroGrant } from '../src/lib/offline/grant';
import { calculateResourceRates } from '../src/utils/gameUtils';
import { useGameStore } from '../src/stores/gameStore';
import type { Equipment } from '../src/types/game';

const obsidian = () => fullSet('obsidian');
const rattatui = () => fullSet('rattatui');

/** Puts gear on the character the way a loaded save does, with the rates that go with it. */
const wear = (equipment: Equipment) =>
	useGameStore.setState((s) => ({
		equipment,
		resourceRates: calculateResourceRates(s.tiles, s.characterStats, s.farmLevels, s.prestige, s.farmUpgrades, s.merchantUpgrades, gearIncomePct(equipment)),
	}));

test('the Obsidian set is the economy set: worn in full it adds the Income, XP, Kill Rewards and away bonuses it lists', () => {
	assert.deepEqual(gearEconomy({}), NO_GEAR_ECONOMY);
	assert.deepEqual(gearEconomy(obsidian()), { incomePct: 26, xpPct: 25, killRewardPct: 37, offlineEff: 15, offlineCapHours: 3, clickPct: 10 });
	assert.equal(gearIncomePct(obsidian()), 26);
	assert.equal(xpGainPct({ xpGainMultiplier: 5 }, obsidian()), 30);
});

test('income follows the worn gear in the rates: +26% on every resource but XP', () => {
	freshGame();
	const s = api();
	const rates = (income = 0) => calculateResourceRates(s.tiles, s.characterStats, s.farmLevels, s.prestige, s.farmUpgrades, s.merchantUpgrades, income).total;
	const plain = rates();
	const geared = rates(gearIncomePct(obsidian()));
	for (const key of ['gold', 'wood', 'stone'] as const) assert.ok(Math.abs(geared[key] / plain[key] - 1.26) < 1e-9, key);
	assert.equal(geared.xp, plain.xp, 'XP is not income');
});

test('wearing the set changes the rates in the store', () => {
	freshGame();
	const before = api().resourceRates.total.wood;
	wear(obsidian());
	assert.ok(Math.abs(api().resourceRates.total.wood / before - 1.26) < 1e-9);
});

test('summarize derives the economy of the saved gear: rates, XP bonus, kill rewards and the away limits', () => {
	freshGame();
	const plain = summarize(pickPersisted(api()));
	wear(obsidian());
	const geared = summarize(pickPersisted(api()));
	assert.ok(Math.abs(geared.rates.wood / plain.rates.wood - 1.26) < 1e-9);
	assert.equal(geared.xpGainPct, plain.xpGainPct + 25);
	assert.equal(geared.derived.killRewardPct, 37);
	assert.equal(plain.derived.killRewardPct, 0);
	assert.equal(geared.derived.offlineCapSec, plain.derived.offlineCapSec + 3 * 3600);
	assert.ok(Math.abs(geared.derived.offlineEfficiency - (plain.derived.offlineEfficiency + 0.15)) < 1e-9);
	assert.equal(DEFAULT_DERIVED.killRewardPct, 0, 'rows written before the set bonuses start with none');
});

test('the away limits and a kill read the bonus', () => {
	assert.equal(offlineCapHours({ gear: { offlineEff: 0, offlineCapHours: 3 } }), offlineCapHours() + 3);
	assert.ok(Math.abs(offlineEfficiency({ gear: { offlineEff: 15, offlineCapHours: 0 } }) - (offlineEfficiency() + 0.15)) < 1e-9);
	const ctx = { goldPerSec: 100, xpPerSec: 10, hidePerSec: 5, luck: 0 };
	const base = killIncome({ type: 'rat', level: 9 }, ctx);
	const bonus = killIncome({ type: 'rat', level: 9 }, { ...ctx, killRewardPct: 50 });
	assert.ok(Math.abs(bonus.gold / base.gold - 1.5) < 0.01);
	assert.ok(Math.abs(bonus.xp / base.xp - 1.5) < 1e-9);
	assert.equal(bonus.hide, base.hide, 'hide is not a kill reward');
});

test('an absence pays more with the set: a longer cap and a better efficiency', () => {
	const rates = { ...zeroGrant(), gold: 10 };
	const input = { rates, ratesAfterCastle: null, castleUpgrade: null, xpGainPct: 0, gapSec: 20 * 3600, capSec: 8 * 3600, efficiency: 0.5, minGapSec: 300 };
	const plain = computeOfflineGrant(input)!;
	const geared = computeOfflineGrant({ ...input, capSec: 11 * 3600, efficiency: 0.65 })!;
	assert.equal(plain.resources.gold, 10 * 8 * 3600 * 0.5);
	assert.equal(geared.resources.gold, 10 * 11 * 3600 * 0.65);
});

test('the Rattatui set is the combat set: percent damage and health reach the shared combat code the server fights with', () => {
	freshGame();
	const stats = api().characterStats;
	const full = rattatui();
	const flatHp = maxHp(stats, {});
	assert.ok(maxHp(stats, full) > flatHp * 1.25, 'more than 25% of the bare HP, the gear and the +25% included');
	const withSet = damagePerHit(full, stats);
	const noSet = damagePerHit({ mainHand: full.mainHand }, stats);
	assert.ok(withSet > noSet * 1.3, `${withSet} vs ${noSet}`);
	assert.ok(SETS.rattatui.bonuses[13].damagePct! > 0 && SETS.rattatui.bonuses[13].maxHpPct! > 0);
});

test('set-only stats print like every other stat', () => {
	assert.equal(formatStat('incomePct', 6), '+6% Income');
	assert.equal(formatStat('offlineCapHours', 3), '+3h Away Time');
	assert.equal(formatStat('killRewardPct', 25), '+25% Kill Rewards');
});
