import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT } from '../../src/config/combatConfig';
import { STARTER_EQUIPMENT } from '../../src/config/itemCatalog';
import { limitOf } from '../../src/lib/limits';
import { simSetup, type SimSetup } from '../../src/lib/fightSim';
import { STRONG_KIT } from '../builders';
import { combatView, dismissTicket, restThrough, runCombat } from '../../src/lib/offline/fight';
import type { FightEvent } from '../../src/lib/offline/fightTypes';
import type { Ledger } from '../../src/lib/offline/ledger';

// The battle queue (docs/reference/combat.md): clicks during a fight line monsters up, the server fights them one after the other.

// the win-chance gate is for auto-battle only and has its own tests; a queued fight ignores it by design, but the help below also fights with auto-battle on
(COMBAT.auto as { minWinChance: number }).minWinChance = 0;

const STRONG = STRONG_KIT;
const boars = (count: number, level = 1) => Array.from({ length: count }, () => ({ type: 'thistleBoar' as const, level }));
// the sim helper switches auto-battle on (it lets the engine pick the monsters); here only the queue and the clicks decide, so it starts off
const setup = (over: Partial<SimSetup> = {}) => {
	const s = simSetup({ equipment: STRONG, monsters: boars(3), seed: 'queue', ...over });
	return { ...s, ledger: { ...s.ledger, combat: { ...s.ledger.combat!, autoBattle: false } } as Ledger };
};

type Setup = ReturnType<typeof setup>;
/** A request at `t` seconds after the start. */
const at = (s: Setup, ledger: Ledger, t: number, ask: Parameters<typeof runCombat>[2] = {}) => runCombat(ledger, s.env(s.start + t), ask);
const fight = (n: number) => ({ commands: [{ kind: 'fight' as const, n }] });
const wins = (ledger: Ledger): number[] => ledger.combat!.log.filter((e: FightEvent) => e.kind === 'won').map((e) => e.n!);
const engaged = (ledger: Ledger): number[] => ledger.combat!.log.filter((e: FightEvent) => e.kind === 'engage').map((e) => e.n!);

test('a click during a fight joins the queue, and the monsters are fought one after the other without another click', () => {
	const s = setup({ monsters: boars(3) });
	let r = at(s, s.ledger, 0.1, fight(1));
	assert.equal(r.ledger.combat!.fight?.n, 1);
	r = at(s, r.ledger, 0.2, fight(2));
	assert.equal(r.queued, 'queued');
	r = at(s, r.ledger, 0.3, fight(3));
	assert.equal(r.queued, 'queued');
	assert.deepEqual(r.ledger.combat!.queue, [2, 3]);
	// the view lists them in order with what they are
	const view = combatView(r.ledger, s.env(s.start + 0.3), 0, false, null);
	assert.deepEqual(
		view.queue!.map((q) => q.n),
		[2, 3],
	);
	assert.equal(view.queueMax, limitOf('battleQueue'));
	assert.equal(view.queue![0].type, 'thistleBoar');
	// a minute later all three have fallen, in the order they were clicked, each paid once
	r = at(s, r.ledger, 60);
	assert.deepEqual(wins(r.ledger), [1, 2, 3]);
	assert.deepEqual(engaged(r.ledger), [1, 2, 3]);
	assert.deepEqual(r.ledger.combat!.queue, []);
	assert.equal(r.ledger.ordKill, 3);
});

test('a second click on a queued monster takes it out again; the monster in the fight, a missing one and a full queue are refused', () => {
	const size = limitOf('battleQueue');
	const s = setup({ monsters: boars(size + 3), equipment: STARTER_EQUIPMENT }); // a weak kit: the first fight lasts
	let r = at(s, s.ledger, 0.1, fight(1));
	assert.equal(at(s, r.ledger, 0.2, fight(1)).queued, 'refused', 'it is the fight itself');
	assert.equal(at(s, r.ledger, 0.2, fight(999)).queued, 'refused', 'no such monster');
	// fill the line: tickets 2 .. size + 1
	const line: number[] = [];
	for (let n = 2; n <= size + 1; n++) {
		r = at(s, r.ledger, 0.2 + n * 0.01, fight(n));
		line.push(n);
	}
	assert.deepEqual(r.ledger.combat!.queue, line);
	assert.equal(at(s, r.ledger, 0.6, fight(size + 2)).queued, 'full', `the queue holds ${size}`);
	const toggled = at(s, r.ledger, 0.7, fight(3));
	assert.equal(toggled.queued, 'removed');
	assert.deepEqual(
		toggled.ledger.combat!.queue,
		line.filter((n) => n !== 3),
	);
	const explicit = at(s, toggled.ledger, 0.8, { commands: [{ kind: 'unqueue', n: 2 }] });
	assert.equal(explicit.queued, 'removed');
	assert.deepEqual(
		explicit.ledger.combat!.queue,
		line.filter((n) => n !== 3 && n !== 2),
	);
});
test('a defeat ends the plan: the queue is cleared', () => {
	// the sim numbers the normal monsters first and the boss after them: tickets 1 and 2 are boars, 3 is a level 25 boss that a weak kit cannot beat
	const s = setup({ equipment: STARTER_EQUIPMENT, monsters: [{ type: 'bossGreatAuroch', level: 25 }, ...boars(2)] });
	let r = at(s, s.ledger, 0.1, fight(3));
	r = at(s, r.ledger, 0.2, fight(1));
	r = at(s, r.ledger, 0.3, fight(2));
	assert.deepEqual(r.ledger.combat!.queue, [1, 2]);
	r = at(s, r.ledger, 120);
	assert.ok(r.ledger.combat!.log.some((e) => e.kind === 'defeated' || e.kind === 'timeout'));
	assert.deepEqual(r.ledger.combat!.queue, []);
	assert.deepEqual(engaged(r.ledger), [3], 'the queued monsters were never started');
});

test('fleeing clears the queue, and so do dismissing a monster (only that one) and an absence', () => {
	const s = setup({ equipment: STARTER_EQUIPMENT, monsters: [{ type: 'bossGreatAuroch', level: 15 }, ...boars(3)] }); // boars 1-3, the boss is 4
	let r = at(s, s.ledger, 0.1, fight(4));
	r = at(s, r.ledger, 0.2, fight(1));
	r = at(s, r.ledger, 0.3, fight(2));
	r = at(s, r.ledger, 0.4, fight(3));
	assert.deepEqual(r.ledger.combat!.queue, [1, 2, 3]);
	// dismissing a queued monster takes only that one out
	const dismissed = dismissTicket(r.ledger, s.env(s.start + 0.5), 2);
	assert.equal(dismissed.ok, true);
	assert.deepEqual(dismissed.ledger.combat!.queue, [1, 3]);
	// an absence rests the hero and drops the plan
	assert.deepEqual(restThrough(r.ledger, s.env(s.start + 3600), 3600).combat!.queue, []);
	// fleeing (the retreat that switching Auto-battle off causes) clears it
	const fled = at(s, r.ledger, 0.6, { autoBattle: false });
	assert.equal(fled.ledger.combat!.fight, null);
	assert.deepEqual(fled.ledger.combat!.queue, []);
});

test('a queued monster that is gone is skipped, and the next one in line is fought', () => {
	const s = setup({ monsters: boars(3) });
	let r = at(s, s.ledger, 0.1, fight(1));
	r = at(s, r.ledger, 0.2, fight(2));
	r = at(s, r.ledger, 0.3, fight(3));
	// monster 2 leaves the map behind the queue's back (a bank change): the line closes up
	const bank = { ...r.ledger.bank, rats: r.ledger.bank.rats.filter((ticket) => ticket.n !== 2) };
	r = at(s, { ...r.ledger, bank }, 60);
	assert.deepEqual(wins(r.ledger), [1, 3]);
});

test('the next queued fight waits until the hero is back above the resume line, then starts by itself', () => {
	const s = setup({ monsters: boars(2) });
	// no fight is open, one monster waits in the queue, and the hero is down to 1 HP
	const hurt: Ledger = { ...s.ledger, combat: { ...s.ledger.combat!, fight: null, queue: [2], hp: 1 } };
	const early = at(s, hurt, 0.5);
	assert.equal(early.ledger.combat!.fight, null, 'too weak to start');
	assert.deepEqual(early.ledger.combat!.queue, [2], 'and still in line');
	// resting takes a while (regeneration only), then the queued fight starts and is won without another click
	const late = at(s, early.ledger, 600);
	assert.deepEqual(engaged(late.ledger), [2]);
	assert.deepEqual(wins(late.ledger), [2]);
	assert.deepEqual(late.ledger.combat!.queue, []);
});

test('a click with no fight open starts it at once; after a flee the queue is empty', () => {
	const s = setup({ equipment: STARTER_EQUIPMENT, monsters: [{ type: 'bossGreatAuroch', level: 15 }, ...boars(3)] }); // boars 1-3, the boss is 4
	let r = at(s, s.ledger, 0.1, fight(4));
	r = at(s, r.ledger, 0.2, fight(1));
	r = at(s, r.ledger, 0.3, fight(2));
	r = at(s, r.ledger, 0.4, { autoBattle: false }); // flee: the plan is off
	assert.deepEqual(r.ledger.combat!.queue, []);
	const again = at(s, r.ledger, 0.5, fight(3));
	assert.equal(again.ledger.combat!.fight?.n, 3, 'a plain click still just starts the fight');
	assert.equal(again.queued, undefined);
});

test('a combat record from before the queue (no field) still runs, and auto-battle goes on after an empty queue', () => {
	const s = setup({ monsters: boars(3) });
	const old = { ...s.ledger, combat: { ...s.ledger.combat!, autoBattle: true } } as Ledger;
	delete (old.combat as { queue?: number[] }).queue;
	let r = at(s, { ...old, rebirths: 1 }, 0.1, fight(1)); // auto-battle is unlocked from the first rebirth
	assert.deepEqual(r.ledger.combat!.queue, []);
	r = at(s, r.ledger, 0.2, fight(2));
	assert.equal(r.queued, 'queued');
	r = at(s, r.ledger, 120);
	// the two clicked monsters first, then auto-battle fought the third by itself
	assert.deepEqual(wins(r.ledger).slice(0, 2), [1, 2]);
	assert.equal(wins(r.ledger).length, 3);
});

test('a resting hero with a queue is asked about again when the rest is over, not after the idle wait (auto-battle off or on)', () => {
	for (const autoBattle of [false, true]) {
		const s = setup({ monsters: boars(2) });
		const hurt: Ledger = { ...s.ledger, combat: { ...s.ledger.combat!, fight: null, queue: [2], hp: 1, autoBattle } };
		const r = at(s, hurt, 0.5);
		assert.equal(r.ledger.combat!.fight, null, 'too weak to start yet');
		const view = combatView(r.ledger, s.env(s.start + 0.5), 0, false, null);
		assert.ok(view.nextPollSec < 600, `auto-battle ${autoBattle ? 'on' : 'off'}: the next poll is in ${view.nextPollSec} s (the idle wait is 600)`);
		assert.equal(view.resting, true, 'the view says the hero is resting before the queue');
		assert.ok((view.restSec ?? 0) > 0 && (view.restSec ?? 0) <= view.nextPollSec, 'and how long it takes');
	}
});

test('after a win at 40 % HP the queue rests (the view says so), and the next fight starts by itself at the poll the view asked for', () => {
	const s = setup({ monsters: boars(2) });
	const maxHp = combatView(s.ledger, s.env(s.start), 0, false, null).maxHp;
	const hurt: Ledger = { ...s.ledger, combat: { ...s.ledger.combat!, hp: Math.round(maxHp * 0.4) } };
	let r = at(s, hurt, 0.1, fight(1));
	r = at(s, r.ledger, 0.2, fight(2));
	assert.deepEqual(r.ledger.combat!.queue, [2]);
	// poll every 2 s like the browser does with the panel open, until the first fight is won
	let t = 0.2;
	while (wins(r.ledger).length === 0 && t < 120) {
		t += 2;
		r = at(s, r.ledger, t);
	}
	assert.deepEqual(wins(r.ledger), [1]);
	const view = combatView(r.ledger, s.env(s.start + t), 0, false, null);
	assert.equal(view.resting, true, 'no fight is open and the queue waits: the view says resting');
	assert.ok((view.restSec ?? 0) > 0);
	// the next poll comes when the view said (restSec + 1): the queued fight has started by then, without a click
	t += view.nextPollSec;
	r = at(s, r.ledger, t);
	assert.deepEqual(engaged(r.ledger), [1, 2]);
});

test('with nothing queued the view is not resting', () => {
	const s = setup({ monsters: boars(1) });
	const view = combatView(s.ledger, s.env(s.start + 1), 0, false, null);
	assert.equal(view.resting, false);
});
