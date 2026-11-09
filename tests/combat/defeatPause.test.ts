import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT } from '../../src/config/combatConfig';
import { STARTER_EQUIPMENT } from '../../src/config/itemCatalog';
import { winBucketOf } from '../../src/lib/combat';
import { simSetup } from '../../src/lib/fightSim';
import { combatView, restThrough, runCombat } from '../../src/lib/offline/fight';
import type { FightEvent } from '../../src/lib/offline/fightTypes';
import type { Ledger } from '../../src/lib/offline/ledger';
import { STRONG_KIT } from '../builders';

// Auto-battle stays on after a defeat and switches itself off after COMBAT.auto.pauseAfterDefeats in a row (one win resets the count), and the
// Next strip's win-chance buckets (IDL-59).

// the win gate would never engage the hopeless monsters this needs; the defeats are the point here
const GATE = COMBAT.auto.minWinChance;
(COMBAT.auto as { minWinChance: number }).minWinChance = 0;

const count = (ledger: Ledger, kind: FightEvent['kind']) => ledger.combat!.log.filter((e) => e.kind === kind).length;
const losing = () =>
	simSetup({ equipment: STARTER_EQUIPMENT, monsters: Array.from({ length: 12 }, () => ({ type: 'thistleBoar' as const, level: 12 })), seed: 'losing' });

/** Runs second by second (the engine's own request limit) until `stop` says so or `maxSec` passed. */
const runUntil = (s: ReturnType<typeof losing>, ledger: Ledger, stop: (l: Ledger) => boolean, maxSec = 4000): Ledger => {
	let l = ledger;
	for (let t = 1; t <= maxSec && !stop(l); t += 1) l = runCombat(l, s.env(s.start + t), {}).ledger;
	return l;
};

test('three defeats in a row switch auto-battle off, with a paused event; before that it stays on', () => {
	const s = losing();
	const afterTwo = runUntil(s, s.ledger, (l) => count(l, 'defeated') >= 2);
	assert.equal(count(afterTwo, 'defeated'), 2);
	assert.equal(afterTwo.combat!.autoBattle, true, 'a defeat does not switch it off');
	assert.equal(afterTwo.combat!.defeatStreak, 2);
	assert.equal(count(afterTwo, 'paused'), 0);

	const afterThree = runUntil(s, afterTwo, (l) => count(l, 'defeated') >= 3);
	assert.equal(afterThree.combat!.autoBattle, false);
	assert.equal(count(afterThree, 'paused'), 1);
	assert.equal(afterThree.combat!.defeatStreak, 0, 'the count starts again');
	const view = combatView(afterThree, s.env(afterThree.combat!.at), 0, false, null);
	assert.equal(view.autoBattle, false);
	assert.ok(view.events.some((e) => e.kind === 'paused'));
	// and it does not start a fourth fight by itself
	const later = runUntil(s, afterThree, () => false, 10);
	assert.equal(later.combat!.fight, null);
	assert.equal(count(later, 'defeated'), 3);
});

test('a win resets the count', () => {
	const s = losing();
	const two = runUntil(s, s.ledger, (l) => count(l, 'defeated') >= 2);
	assert.equal(two.combat!.defeatStreak, 2);
	// a win with the strong kit against a weak monster, from the same state
	const easy = simSetup({ equipment: STRONG_KIT, monsters: [{ type: 'thistleBoar', level: 1 }], seed: 'easy' });
	const seeded: Ledger = { ...easy.ledger, combat: { ...easy.ledger.combat!, defeatStreak: 2 } };
	const won = runUntil(easy as never, seeded, (l) => count(l, 'won') >= 1, 200);
	assert.equal(count(won, 'won'), 1);
	assert.equal(won.combat!.defeatStreak, 0);
	assert.equal(won.combat!.autoBattle, true);
});

test('offline rest keeps the count and does not undo a pause', () => {
	const s = losing();
	const two = runUntil(s, s.ledger, (l) => count(l, 'defeated') >= 2);
	const rested = restThrough(two, s.env(two.combat!.at + 3600), 3600);
	assert.equal(rested.combat!.defeatStreak, 2, 'the absence is no win and no defeat');
	assert.equal(rested.combat!.autoBattle, true);
	// the next defeat after the absence is the third
	const third = runUntil(s, { ...rested, combat: { ...rested.combat!, at: two.combat!.at } }, (l) => count(l, 'paused') >= 1);
	assert.equal(third.combat!.autoBattle, false);

	const paused = restThrough(third, s.env(third.combat!.at + 3600), 3600);
	assert.equal(paused.combat!.autoBattle, false, 'a pause survives the absence');
	assert.equal(paused.combat!.fight, null);
});

test('the win-chance bucket: Safe from 80, Risky 50-79, Unlikely below 50', () => {
	(COMBAT.auto as { minWinChance: number }).minWinChance = GATE;
	assert.deepEqual([100, 80, 79, 50, 49, 0].map(winBucketOf), ['safe', 'safe', 'risky', 'risky', 'unlikely', 'unlikely']);
});

test('the queue in the view carries the server-side win estimate per monster, as a whole percent', () => {
	const s = simSetup({
		equipment: STRONG_KIT,
		monsters: [
			{ type: 'thistleBoar', level: 1 },
			{ type: 'thistleBoar', level: 1 },
			{ type: 'bossGreatAuroch', level: 15 },
		],
		seed: 'strip',
	});
	const base: Ledger = { ...s.ledger, combat: { ...s.ledger.combat!, autoBattle: false } };
	let r = runCombat(base, s.env(s.start + 0.1), { commands: [{ kind: 'fight', n: 1 }] });
	r = runCombat(r.ledger, s.env(s.start + 0.2), {
		commands: [
			{ kind: 'fight', n: 2 },
			{ kind: 'fight', n: 3 },
		],
	});
	const view = combatView(r.ledger, s.env(s.start + 0.2), 0, false, null);
	assert.equal(view.queue!.length, 2);
	for (const q of view.queue!) assert.ok(Number.isInteger(q.winPct) && q.winPct! >= 0 && q.winPct! <= 100, `winPct ${q.winPct}`);
	assert.equal(view.queue![0].winPct, 100, 'a strong kit against a level 1 boar');
});
