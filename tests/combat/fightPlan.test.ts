import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT } from '../../src/config/combatConfig';
import { simSetup } from '../../src/lib/fightSim';
import { STRONG_KIT } from '../builders';
import { runCombat } from '../../src/lib/offline/fight';
import { combatView } from '../../src/lib/offline/fightView';
import { projectFight } from '../../src/lib/offline/fightProject';
import { planPictureAt } from '../../src/lib/planPicture';

(COMBAT.auto as { minWinChance: number }).minWinChance = 0;

const open = (seed: string, monsterType: 'thistleBoar' | 'bossGreatAuroch' = 'thistleBoar') => {
	const s = simSetup({ equipment: STRONG_KIT, monsters: [{ type: monsterType, level: monsterType === 'thistleBoar' ? 1 : 15 }], seed });
	const ledger = runCombat(s.ledger, s.env(s.start)).ledger;
	return { s, ledger };
};

test('a plan says when the open fight ends, and the real request at that time ends it the same way', () => {
	const { s, ledger } = open('plan-a');
	const c = ledger.combat!;
	assert.ok(c.fight, 'a fight is open');
	const plan = projectFight(ledger, s.env(c.at), c)!;
	assert.ok(plan && plan.endsInSec > 0);
	assert.ok(c.fight, 'the projection left the real fight alone');
	const hpBefore = c.fight!.monsterHp;
	// asked just before the end: still fighting; asked after it: the projected outcome is in the log
	const before = runCombat(ledger, s.env(c.at + plan.endsInSec - 0.3)).ledger.combat!;
	assert.ok(before.fight, 'still fighting just before the projected end');
	const after = runCombat(ledger, s.env(c.at + plan.endsInSec + COMBAT.poll.afterEndSec)).ledger.combat!;
	assert.ok(!after.fight || after.fight.n !== c.fight!.n, 'the fight is over at the projected end');
	assert.ok(
		after.log.some((e) => e.kind === plan.outcome),
		`the log has the projected ${plan.outcome}`,
	);
	assert.equal(c.fight!.monsterHp, hpBefore, 'the ledger was not touched');
});

test('the view carries the plan and polls again when the fight is over, not every 2 seconds', () => {
	const { s, ledger } = open('plan-b', 'bossGreatAuroch');
	const c = ledger.combat!;
	const view = combatView(ledger, s.env(c.at), 0, false, null);
	assert.ok(view.plan, 'a plan is sent');
	assert.equal(view.nextPollSec, Math.max(0.5, view.plan!.endsInSec + COMBAT.poll.afterEndSec));
	assert.ok(view.nextPollSec > COMBAT.poll.fightSec || view.plan!.endsInSec < 2, 'a long fight is not polled every 2 s');
	const behind = combatView(ledger, s.env(c.at), 0, true, null);
	assert.equal(behind.plan, undefined);
	assert.equal(behind.nextPollSec, 0.5);
});

test('the plan is a few rows: at most 60 samples, and it starts and ends where the fight does', () => {
	const { s, ledger } = open('plan-c', 'bossGreatAuroch');
	const c = ledger.combat!;
	const plan = projectFight(ledger, s.env(c.at), c)!;
	assert.ok(plan.samples.length <= 60);
	assert.deepEqual(plan.samples[0].slice(1), [Math.round(c.hp * 10) / 10, Math.round(c.fight!.monsterHp * 10) / 10]);
	assert.equal(plan.samples[plan.samples.length - 1][0], plan.endsInSec);
	if (plan.outcome === 'won') assert.equal(plan.samples[plan.samples.length - 1][2], 0);
});

test('planPictureAt draws straight lines between samples and holds the last one', () => {
	const plan = {
		endsInSec: 4,
		outcome: 'won' as const,
		samples: [
			[0, 100, 50],
			[2, 80, 30],
			[4, 80, 0],
		] as [number, number, number][],
		fx: [],
	};
	assert.deepEqual(planPictureAt(plan, 0), { hp: 100, monsterHp: 50 });
	assert.deepEqual(planPictureAt(plan, 1), { hp: 90, monsterHp: 40 });
	assert.deepEqual(planPictureAt(plan, 3), { hp: 80, monsterHp: 15 });
	assert.deepEqual(planPictureAt(plan, 99), { hp: 80, monsterHp: 0 });
});
