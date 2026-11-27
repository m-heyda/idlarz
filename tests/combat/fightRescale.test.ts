import assert from 'node:assert/strict';
import test from 'node:test';
import { COMBAT } from '../../src/config/combatConfig';
import { simSetup } from '../../src/lib/fightSim';
import { runCombat } from '../../src/lib/offline/fight';
import { monsterStats } from '../../src/lib/monsters';
import type { Ledger } from '../../src/lib/offline/ledger';
import { STRONG_KIT } from '../builders';

// A fight opened before a balance change stores the old max HP; the next step brings it to the monster's current max and keeps the share of HP left.

(COMBAT.auto as { minWinChance: number }).minWinChance = 0;

test('an open fight follows a changed max HP and keeps its share of HP', () => {
	const s = simSetup({ equipment: STRONG_KIT, monsters: [{ type: 'thistleBoar', level: 40 }], seed: 'rescale' });
	let ledger: Ledger = s.ledger;
	for (let t = 1; t <= 30 && !ledger.combat!.fight; t++) ledger = runCombat(ledger, s.env(s.start + t), {}).ledger;
	const fight = ledger.combat!.fight!;
	assert.ok(fight, 'a fight opened');
	const now = monsterStats(fight.type, fight.level).maxHp;
	// what an older build stored: four times the max, half of it left
	ledger = { ...ledger, combat: { ...ledger.combat!, fight: { ...fight, monsterMaxHp: now * 4, monsterHp: now * 2 } } };
	const after = runCombat(ledger, s.env(Math.ceil(ledger.combat!.at) + 1), {}).ledger.combat!.fight;
	assert.ok(after, 'the fight is still open');
	assert.equal(after.monsterMaxHp, now, 'max HP is the current one');
	assert.ok(Math.abs(after.monsterHp / now - 0.5) < 0.1, `about half the HP is left: ${after.monsterHp} of ${now}`);
});
