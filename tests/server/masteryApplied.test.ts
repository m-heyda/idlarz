import test from 'node:test';
import assert from 'node:assert/strict';
import { STARTER_EQUIPMENT } from '../../src/config/itemCatalog';
import { COMBAT } from '../../src/config/combatConfig';
import { runCombat } from '../../src/lib/offline/fight';
import { simSetup } from '../../src/lib/fightSim';
import { generateLoot } from '../../src/lib/loot/generate';
import { killIncome } from '../../src/lib/loot/kill';
import { mulberry32 } from '../../src/lib/rng';
import type { FightEvent } from '../../src/lib/offline/fightTypes';
import type { Ledger } from '../../src/lib/offline/ledger';

// The Bestiary bonuses are real: what a claimed tier gives is applied by the fight and the kill reward, by the same function (`masteryBonusesFor`) the window prints.

(COMBAT.auto as { minWinChance: number }).minWinChance = 0;

/** One fight against a level-3 Thistle Boar, run to its end; the ledger may carry claimed tiers. */
const fight = (claimed: Record<string, number>, biomeClaimed: Record<string, number> = {}) => {
	const { ledger, env, start } = simSetup({ equipment: STARTER_EQUIPMENT, level: 5, monsters: [{ type: 'thistleBoar', level: 3 }], seed: 'mastery-applied' });
	const withClaims: Ledger = { ...ledger, stats: { ...ledger.stats, masteryClaimed: claimed, biomeClaimed } };
	let state = runCombat(withClaims, env(start), { autoUse: false, commands: [{ kind: 'fight', n: 1 }] }).ledger;
	const events: FightEvent[] = [];
	for (let i = 0; i < 200 && state.combat!.fight; i++) {
		state = runCombat(state, env(start + 1 + i)).ledger;
		events.push(...state.combat!.log);
	}
	const won = events.find((e) => e.kind === 'won');
	const dealt = (kind: string) => events.filter((e) => e.kind === kind).reduce((sum, e) => sum + (e.amount ?? 0), 0);
	const hits = events.filter((e) => e.kind === 'hit' || e.kind === 'crit').length;
	return { won, hurt: dealt('hurt'), hits, perHit: dealt('hit') / Math.max(1, events.filter((e) => e.kind === 'hit').length) };
};

test('a claimed tier raises the damage dealt and lowers the damage taken against that monster only', () => {
	const plain = fight({});
	const mastered = fight({ thistleBoar: 4 }, { plains: 4 });
	assert.ok(plain.won && mastered.won, 'both fights are won');
	assert.ok(mastered.perHit > plain.perHit, `damage per hit rises (${plain.perHit} -> ${mastered.perHit})`);
	assert.ok(mastered.hurt <= plain.hurt, 'damage taken does not rise');
	const other = fight({ burrowBadger: 4 });
	assert.equal(other.perHit, plain.perHit, 'a bonus earned on another monster does nothing here');
});

test('a claimed tier pays more gold and XP for the kill', () => {
	const plain = fight({});
	const mastered = fight({ thistleBoar: 4 });
	const gold = (e: { reward?: { gold: number } } | undefined) => e?.reward?.gold ?? 0;
	assert.ok(gold(mastered.won as never) > gold(plain.won as never), 'gold is higher with Mastery II (+5%)');
	const income = killIncome({ type: 'thistleBoar', level: 40 }, { goldPerSec: 100, xpPerSec: 100, luck: 0 });
	const boosted = killIncome({ type: 'thistleBoar', level: 40 }, { goldPerSec: 100, xpPerSec: 100, luck: 0, masteryGoldPct: 10, masteryXpPct: 10 });
	assert.ok(boosted.gold > income.gold && boosted.xp > income.xp);
	assert.ok(Math.abs(boosted.gold / income.gold - 1.1) < 0.01 && Math.abs(boosted.xp / income.xp - 1.1) < 0.01, 'exactly +10%');
});

test('the gear drop chance bonus raises the number of gear drops', () => {
	const count = (dropChancePct?: number) => {
		let n = 0;
		for (let seed = 1; seed <= 400; seed++)
			n += generateLoot({ sourceId: 'monster_plains', level: 3, dropChancePct }, mulberry32(seed)).drops.filter((d) => d.kind === 'gear').length;
		return n;
	};
	assert.ok(count(100) > count(0), 'double the chance, more gear');
	assert.equal(count(0), count(undefined), 'a bonus of 0 changes nothing, not even the random numbers');
});
