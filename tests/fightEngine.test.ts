import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT, MONSTERS } from '../src/config/combatConfig';
import { STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { SKILLS } from '../src/catalog/skills';
import { attacksPerSecond } from '../src/lib/combat';
import { fullSet, simSetup, spentCharacter, type SimSetup } from '../src/lib/fightSim';
import { plainItem } from '../src/lib/itemInstance';
import { runCombat } from '../src/lib/offline/fight';
import type { FightEvent } from '../src/lib/offline/fightTypes';
import type { Ledger } from '../src/lib/offline/ledger';
import type { Equipment } from '../src/types/game';

// The server's fight engine, run without a database: a player's saved strength, monsters placed on the map, a sealed random stream.

// Auto-battle's win-chance gate (offline/winChance.ts) is tested in winChance.test.ts. Here the player fights whatever the test puts in front of
// them, weak kit against strong monsters included, so the gate is off for this file (each test file runs in its own process).
(COMBAT.auto as { minWinChance: number }).minWinChance = 0;

const DAGGER: Equipment = { ...STARTER_EQUIPMENT, mainHand: plainItem('steel_dagger') };
const MAUL: Equipment = { ...STARTER_EQUIPMENT, mainHand: plainItem('obsidian_maul') };
const STRONG = fullSet('rattatui');

const setup = (over: Partial<SimSetup> = {}) => simSetup({ equipment: STARTER_EQUIPMENT, monsters: [{ type: 'rat', level: 1 }], seed: 'engine', ...over });

/** Runs the clock forward `seconds` seconds, one request per `stepSec`, and returns the ledger and every event seen. */
const advance = (s: ReturnType<typeof setup>, from: Ledger, seconds: number, stepSec = 1, ask: Parameters<typeof runCombat>[2] = {}) => {
	let ledger = from;
	const events: FightEvent[] = [];
	let last = ledger.combat?.eventNo ?? 0;
	for (let t = stepSec; t <= seconds + 1e-9; t += stepSec) {
		ledger = runCombat(ledger, s.env(s.start + (ledger.combat ? ledger.combat.at - s.start : 0) + stepSec), t === stepSec ? ask : {}).ledger;
		events.push(...ledger.combat!.log.filter((e) => e.no > last));
		last = ledger.combat!.eventNo;
	}
	return { ledger, events };
};
const kinds = (events: FightEvent[], ...wanted: FightEvent['kind'][]) => events.filter((e) => wanted.includes(e.kind));

// ---------------------------------------------------------------------------------------------------- speed

test('the player swings at the weapon speed and a monster at its own: swings in 10 seconds follow attacks per second', () => {
	const s = setup({ equipment: DAGGER, monsters: [{ type: 'ratKing', level: 15 }] }); // a King has HP for a long fight
	const first = runCombat(s.ledger, s.env(s.start)).ledger;
	const { events } = advance(s, first, 10);
	const swings = kinds(events, 'hit', 'crit', 'super').length;
	const aps = attacksPerSecond(DAGGER);
	assert.ok(Math.abs(swings - aps * 10) <= 1, `${swings} swings at ${aps}/s`);
	const bites = kinds(events, 'hurt', 'dodged').length;
	assert.ok(Math.abs(bites - MONSTERS.ratKing.attackSpeed * 10) <= 1, `${bites} bites at ${MONSTERS.ratKing.attackSpeed}/s`);

	const slow = setup({ equipment: MAUL, monsters: [{ type: 'ratKing', level: 15 }], seed: 'slow' });
	const slowEvents = advance(slow, runCombat(slow.ledger, slow.env(slow.start)).ledger, 10).events;
	assert.ok(kinds(slowEvents, 'hit', 'crit', 'super').length < swings, 'a maul swings less often than a dagger');
});

test('the engine is deterministic: the same seed gives the same fight, another seed another', () => {
	const run = (seed: string) => {
		const s = setup({ equipment: STRONG, monsters: [{ type: 'ratKing', level: 15 }], seed });
		return advance(s, runCombat(s.ledger, s.env(s.start)).ledger, 20).events.map((e) => [e.kind, e.amount]);
	};
	assert.deepEqual(run('a'), run('a'));
	assert.notDeepEqual(run('a'), run('b'));
});

test('a request carries the fight forward to the clock whatever the gap: one long request equals many short ones', () => {
	const s = setup({ equipment: STRONG, monsters: [{ type: 'rat', level: 3 }] });
	const first = runCombat(s.ledger, s.env(s.start)).ledger;
	const many = advance(s, first, 30, 1).ledger.combat!;
	const one = runCombat(first, s.env(s.start + 30)).ledger.combat!;
	assert.equal(one.eventNo, many.eventNo);
	assert.equal(Math.round(one.hp), Math.round(many.hp));
});

test('one request simulates at most the catch-up limit of fighting, then says it is behind', () => {
	const s = setup({ equipment: STARTER_EQUIPMENT, monsters: Array.from({ length: 20 }, () => ({ type: 'rat' as const, level: 3 })) });
	const first = runCombat(s.ledger, s.env(s.start)).ledger;
	const gap = COMBAT.maxCatchUpSec * 3;
	const out = runCombat(first, s.env(s.start + gap));
	assert.equal(out.behind, true);
	assert.ok(out.ledger.combat!.at < s.start + gap, 'the clock stopped short');
	assert.ok(out.ledger.combat!.at >= s.start + 1, 'but it moved');
	const more = runCombat(out.ledger, s.env(s.start + gap));
	assert.ok(more.ledger.combat!.at > out.ledger.combat!.at, 'the next request goes on');
});

// ---------------------------------------------------------------------------------------------------- engaging

test('one monster at a time: a fight ends before the next begins, and every win is paid once', () => {
	const s = setup({ equipment: STRONG, monsters: [{ type: 'rat', level: 1 }, { type: 'rat', level: 2 }, { type: 'rat', level: 3 }] });
	const first = runCombat(s.ledger, s.env(s.start)).ledger;
	const { ledger, events } = advance(s, first, 60);
	const order = [...first.combat!.log, ...events].filter((e) => ['engage', 'won', 'defeated', 'timeout', 'retreat'].includes(e.kind)).map((e) => e.kind);
	let open = 0;
	for (const kind of order) {
		open += kind === 'engage' ? 1 : -1;
		assert.ok(open === 0 || open === 1, `never two fights at once: ${order.join(',')}`);
	}
	assert.equal(kinds(events, 'won').length + kinds(first.combat!.log, 'won').length, 3);
	assert.equal(ledger.ordKill, 3, 'one sealed reward per kill');
	assert.equal(ledger.bank.rats.length, 0, 'the tickets are spent');
	assert.ok(ledger.granted.gold > 0 && ledger.granted.xp > 0);
});

test('the weakest monster is fought first, so a rat that cannot be beaten never blocks the easy ones', () => {
	const s = setup({ equipment: STARTER_EQUIPMENT, monsters: [{ type: 'rat', level: 9 }, { type: 'rat', level: 1 }] });
	const first = runCombat(s.ledger, s.env(s.start)).ledger;
	assert.equal(first.combat!.fight?.level, 1);
	assert.equal(first.combat!.fight?.n, 2, 'the level 1 rat (ticket 2) goes first');
});

test('a monster that beat you is left alone for a while, the others are not, and the fight then rests until HP is back', () => {
	const s = setup({ equipment: STARTER_EQUIPMENT, monsters: [{ type: 'rat', level: 9 }] });
	const first = runCombat(s.ledger, s.env(s.start)).ledger;
	const { ledger, events } = advance(s, first, 120);
	assert.ok(kinds(events, 'defeated').length >= 1, 'a starter kit loses to a level 9 rat');
	const defeatedAt = kinds(events, 'defeated')[0].t;
	assert.equal(kinds(events, 'engage').filter((e) => e.t > defeatedAt).length, 0, 'not tried again before the cooldown');
	assert.ok((ledger.combat!.retryAt['1'] ?? 0) >= defeatedAt + COMBAT.auto.retryCooldownSec - 1);
	// well after the cooldown it is tried again
	const later = advance(s, ledger, COMBAT.auto.retryCooldownSec + 60, 15);
	assert.ok(kinds(later.events, 'engage').length >= 1);
});

test('after a knockout HP is a share of max and no fight starts until it is back above the resume line', () => {
	const s = setup({ equipment: STARTER_EQUIPMENT, monsters: [{ type: 'rat', level: 9 }, { type: 'rat', level: 9 }] });
	const first = runCombat(s.ledger, s.env(s.start)).ledger;
	const { ledger, events } = advance(s, first, 100);
	const defeat = kinds(events, 'defeated')[0];
	assert.ok(defeat);
	const next = kinds(events, 'engage').find((e) => e.t > defeat.t);
	if (next) {
		const regen = COMBAT.regenPerSec;
		const need = (101 * COMBAT.auto.resumeHpPct) / 100 - 101 * COMBAT.knockoutHpFraction;
		assert.ok(next.t - defeat.t >= need / (regen + 0.01) - 2, `rested ${next.t - defeat.t} s`);
	}
	assert.ok(ledger.combat!.hp <= 101);
});

test('auto-battle off: nothing is engaged; on: the next fight starts at once; off again: the open fight is called off and the monster stays', () => {
	const s = setup({ equipment: STARTER_EQUIPMENT, monsters: [{ type: 'rat', level: 1 }] });
	const off = runCombat(s.ledger, s.env(s.start), { autoBattle: false }).ledger;
	assert.equal(off.combat!.fight, null);
	assert.equal(advance(s, off, 30).ledger.combat!.fight, null);
	const on = runCombat(off, s.env(s.start + 31), { autoBattle: true }).ledger;
	assert.ok(on.combat!.fight, 'engaged immediately');
	const retreat = runCombat(on, s.env(s.start + 32), { autoBattle: false }).ledger;
	assert.equal(retreat.combat!.fight, null);
	assert.equal(retreat.combat!.log.at(-1)?.kind, 'retreat');
	assert.equal(retreat.bank.rats.length, 1, 'the monster is still there');
	assert.equal(retreat.ordKill, 0, 'no reward');
});

test('auto-battle is locked until the first rebirth: asking for it changes nothing, and a save that had it on loses it', () => {
	const s = setup({ equipment: STARTER_EQUIPMENT, monsters: [{ type: 'rat', level: 1 }] });
	const young = { ...s.ledger, rebirths: 0 };
	const asked = runCombat(young, s.env(s.start), { autoBattle: true }).ledger;
	assert.equal(asked.combat!.autoBattle, false);
	assert.equal(asked.combat!.fight, null, 'nothing is engaged by itself');
	const had = runCombat({ ...young, combat: { ...young.combat!, autoBattle: true } }, s.env(s.start + 5)).ledger;
	assert.equal(had.combat!.autoBattle, false);
	assert.equal(had.combat!.fight, null);
	// a click still fights
	const clicked = runCombat(asked, s.env(s.start + 6), { commands: [{ kind: 'fight', n: asked.bank.rats[0].n }] }).ledger;
	assert.ok(clicked.combat!.fight);
});

test('a click starts a fight with auto-battle off, even below the resume HP, and the next monster is not chained on', () => {
	const s = setup({ equipment: STRONG, monsters: [{ type: 'rat', level: 1 }, { type: 'rat', level: 1 }] });
	const off = runCombat(s.ledger, s.env(s.start), { autoBattle: false }).ledger;
	assert.equal(off.combat!.fight, null, 'nothing is engaged by itself');
	const [first, second] = off.bank.rats;

	// below the 80 % line auto-battle would rest first; a click does not wait
	const tired = { ...off, combat: { ...off.combat!, hp: Math.round(off.combat!.hp * 0.5) } };
	const clicked = runCombat(tired, s.env(s.start + 1), { commands: [{ kind: 'fight', n: second.n }] }).ledger;
	assert.equal(clicked.combat!.fight?.n, second.n, 'the monster that was clicked, not the weakest');
	assert.equal(clicked.combat!.log.at(-1)?.kind, 'engage');

	// the fight runs on its own; when it is over the player is not sent against the other rat
	const { ledger, events } = advance(s, clicked, 90);
	assert.ok(kinds(events, 'won', 'defeated')[0], 'the fight was decided');
	assert.equal(kinds(events, 'engage').length, 0, 'no second engage');
	assert.equal(ledger.combat!.fight, null);
	assert.ok(ledger.bank.rats.some((rat) => rat.n === first.n), 'the other rat is still there');
});

test('a click is refused for a monster that is not there, during a fight, at 0 HP, and is ignored when the server is behind', () => {
	const s = setup({ equipment: STRONG, monsters: [{ type: 'rat', level: 1 }, { type: 'rat', level: 1 }] });
	const off = runCombat(s.ledger, s.env(s.start), { autoBattle: false }).ledger;
	const click = (ledger: Ledger, n: number, at = s.start + 1) => runCombat(ledger, s.env(at), { commands: [{ kind: 'fight', n }] }).ledger;

	assert.equal(click(off, 99).combat!.fight, null, 'no such ticket');
	assert.equal(click(off, 0).combat!.fight, null);
	assert.equal(click({ ...off, combat: { ...off.combat!, hp: 0 } }, off.bank.rats[0].n, s.start).combat!.fight, null, 'no HP (at the same clock: resting would give some back)');

	const fighting = click(off, off.bank.rats[0].n);
	assert.equal(fighting.combat!.fight?.n, off.bank.rats[0].n);
	const again = click(fighting, off.bank.rats[1].n, s.start + 2);
	assert.equal(again.combat!.fight?.n, off.bank.rats[0].n, 'a second click does not change the fight');

	// a request that is still catching up does not start a fight in the past
	const busy = setup({ equipment: STARTER_EQUIPMENT, monsters: Array.from({ length: 20 }, () => ({ type: 'rat' as const, level: 3 })) });
	const on = runCombat(busy.ledger, busy.env(busy.start)).ledger;
	const late = runCombat(on, busy.env(busy.start + COMBAT.maxCatchUpSec * 3), { autoBattle: false, commands: [{ kind: 'fight', n: on.bank.rats[5].n }] });
	assert.equal(late.behind, true);
	assert.notEqual(late.ledger.combat!.fight?.n, on.bank.rats[5].n);
});

test('the King can be clicked too, with auto-battle off', () => {
	const s = setup({ equipment: STRONG, monsters: [{ type: 'rat', level: 1 }, { type: 'ratKing', level: 15 }] });
	const off = runCombat(s.ledger, s.env(s.start), { autoBattle: false }).ledger;
	const king = off.bank.king!;
	const clicked = runCombat(off, s.env(s.start + 1), { commands: [{ kind: 'fight', n: king.n }] }).ledger;
	assert.equal(clicked.combat!.fight?.type, 'ratKing');
});

test('a King is fought only when no other monster is ready, and a King that ran out the clock waits out the boss cooldown', () => {
	const s = setup({ equipment: STRONG, monsters: [{ type: 'rat', level: 1 }, { type: 'ratKing', level: 15 }] });
	const first = runCombat(s.ledger, s.env(s.start)).ledger;
	assert.equal(first.combat!.fight?.type, 'rat');
	const weak = setup({ equipment: STARTER_EQUIPMENT, monsters: [{ type: 'ratKing', level: 15 }], seed: 'king' });
	const start = runCombat(weak.ledger, weak.env(weak.start)).ledger;
	const { ledger, events } = advance(weak, start, MONSTERS.ratKing.timeLimitSec + 40, 5);
	const ended = kinds(events, 'defeated', 'timeout')[0];
	assert.ok(ended, 'a starter kit cannot beat the King');
	assert.ok((ledger.combat!.retryAt['1'] ?? 0) >= ended.t + COMBAT.auto.bossRetryCooldownSec - 1);
	assert.equal(kinds(events, 'engage').filter((e) => e.t > ended.t).length, 0);
});

// ---------------------------------------------------------------------------------------------------- hotkeys and auto-use

test('a potion on a hotkey heals, takes one from the stock, starts the shared cooldown and refuses at full HP, with none left, or too soon', () => {
	const s = setup({ equipment: STARTER_EQUIPMENT, potions: [{ id: 'potion_minor', qty: 2 }], monsters: [{ type: 'ratKing', level: 15 }] });
	let ledger = runCombat(s.ledger, s.env(s.start), { autoUse: false }).ledger;
	const drink = (at: number, l: Ledger) => runCombat(l, s.env(s.start + at), { commands: [{ kind: 'potion', id: 'potion_minor' }] }).ledger;
	const hurt = { ...ledger, combat: { ...ledger.combat!, hp: 40 } };
	const once = drink(1, hurt);
	assert.equal(once.combat!.consumed.potion_minor, 1);
	assert.ok(once.combat!.cd.potion > 0);
	assert.ok(once.combat!.log.some((e) => e.kind === 'potion'));
	const tooSoon = drink(2, once);
	assert.equal(tooSoon.combat!.consumed.potion_minor, 1, 'the shared cooldown refuses the second');
	const later = drink(COMBAT.potionCooldownSec + 3, { ...tooSoon, combat: { ...tooSoon.combat!, hp: 20 } });
	assert.equal(later.combat!.consumed.potion_minor, 2);
	const empty = drink(COMBAT.potionCooldownSec * 2 + 6, { ...later, combat: { ...later.combat!, hp: 10, cd: { heal: 0, stun: 0, potion: 0 } } });
	assert.equal(empty.combat!.consumed.potion_minor, 2, 'the bag had two');
	ledger = { ...empty, combat: { ...empty.combat!, consumedSeen: {} } };
	assert.ok(ledger.combat);
});

test('the full-HP potion is refused outside a fight too, and a potion the bag does not have is refused', () => {
	const s = setup({ equipment: STARTER_EQUIPMENT, potions: [{ id: 'potion_minor', qty: 1 }], monsters: [] });
	const full = runCombat(s.ledger, s.env(s.start)).ledger;
	const tried = runCombat(full, s.env(s.start + 1), { commands: [{ kind: 'potion', id: 'potion_minor' }] }).ledger;
	assert.equal(tried.combat!.consumed.potion_minor ?? 0, 0, 'full HP');
	const hurt = { ...full, combat: { ...full.combat!, hp: 30 } };
	const none = runCombat(hurt, s.env(s.start + 1), { commands: [{ kind: 'potion', id: 'potion_greater' }] }).ledger;
	assert.equal(none.combat!.consumed.potion_greater ?? 0, 0, 'not in the bag');
});

test('skills: Heal needs its level, mana and a cooldown; Stun needs a fight and level 10 and freezes the monster', () => {
	const mk = (level: number) => setup({ equipment: STARTER_EQUIPMENT, level, monsters: [{ type: 'ratKing', level: 15 }], seed: `skill-${level}` });
	const low = mk(4);
	const lowStart = runCombat(low.ledger, low.env(low.start), { autoUse: false }).ledger;
	const lowHurt = { ...lowStart, combat: { ...lowStart.combat!, hp: 30 } };
	const refused = runCombat(lowHurt, low.env(low.start + 1), { commands: [{ kind: 'skill', id: 'heal' }] }).ledger;
	assert.ok(!refused.combat!.log.some((e) => e.kind === 'heal'), 'locked below level 5');

	const hi = mk(30);
	const hiStart = runCombat(hi.ledger, hi.env(hi.start), { autoUse: false }).ledger;
	const hurt = { ...hiStart, combat: { ...hiStart.combat!, hp: 30 } };
	const healed = runCombat(hurt, hi.env(hi.start + 1), { commands: [{ kind: 'skill', id: 'heal' }] }).ledger;
	assert.ok(healed.combat!.log.some((e) => e.kind === 'heal'));
	assert.equal(healed.combat!.mp < hurt.combat.mp, true, 'mana is spent');
	assert.ok(healed.combat!.cd.heal > 0);
	const again = runCombat(healed, hi.env(hi.start + 2), { commands: [{ kind: 'skill', id: 'heal' }] }).ledger;
	assert.equal(again.combat!.log.filter((e) => e.kind === 'heal').length, 1, 'on cooldown');

	const stunned = runCombat(hiStart, hi.env(hi.start + 1), { commands: [{ kind: 'skill', id: 'stun' }] }).ledger;
	const log = stunned.combat!.log;
	assert.ok(log.some((e) => e.kind === 'stun' || e.kind === 'resist'), 'a King may resist (20 %), but the cast went through');
	assert.equal(stunned.combat!.cd.stun, SKILLS.stun.cooldownSec);

	const none = setup({ equipment: STARTER_EQUIPMENT, level: 30, monsters: [] });
	const idle = runCombat(none.ledger, none.env(none.start), { commands: [{ kind: 'skill', id: 'stun' }] }).ledger;
	assert.equal(idle.combat!.cd.stun, 0, 'Stun needs a fight');
});

test('auto-use drinks below its HP line and only when switched on', () => {
	const mk = (autoUse: boolean) => {
		const s = setup({ equipment: STARTER_EQUIPMENT, potions: [{ id: 'potion_greater', qty: 3 }], monsters: [{ type: 'rat', level: 9 }], seed: 'auto' });
		return advance(s, runCombat(s.ledger, s.env(s.start), { autoUse }).ledger, 40);
	};
	assert.ok(kinds(mk(true).events, 'potion').length >= 1);
	assert.equal(kinds(mk(false).events, 'potion').length, 0);
	for (const e of kinds(mk(true).events, 'potion')) assert.ok(e.amount! > 0);
});

// ---------------------------------------------------------------------------------------------------- the log

test('a result is never lost to the cosmetic swings: a win stays in the log until the browser acknowledges it', () => {
	const s = setup({ equipment: STRONG, monsters: [{ type: 'rat', level: 1 }, { type: 'rat', level: 1 }, { type: 'rat', level: 1 }, { type: 'rat', level: 1 }] });
	const first = runCombat(s.ledger, s.env(s.start)).ledger;
	const later = runCombat(first, s.env(s.start + 100)).ledger; // one long gap: dozens of swings, four wins
	const log = later.combat!.log;
	assert.equal(log.filter((e) => e.kind === 'won').length, 4);
	assert.ok(log.length <= 100);
	// acknowledged results are dropped, the rest is kept
	const acked = runCombat(later, s.env(s.start + 101), { ack: later.combat!.eventNo }).ledger;
	assert.equal(acked.combat!.log.filter((e) => e.kind === 'won').length, 0);
});

test('stronger attributes win fights a weak build loses (the profile is read from the saved character)', () => {
	const weak = setup({ equipment: DAGGER, monsters: [{ type: 'rat', level: 9 }], seed: 'attrs' });
	const strong = setup({ equipment: DAGGER, character: spentCharacter({ strength: 25, vitality: 25 }), monsters: [{ type: 'rat', level: 9 }], seed: 'attrs' });
	const run = (s: ReturnType<typeof setup>) => advance(s, runCombat(s.ledger, s.env(s.start), { autoUse: false }).ledger, 120).events;
	assert.ok(kinds(run(strong), 'won').length >= 1);
	assert.equal(kinds(run(weak), 'won').length, 0);
});
