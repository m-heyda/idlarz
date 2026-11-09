import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { COMBAT } from '../../src/config/combatConfig';
import { STARTER_EQUIPMENT } from '../../src/config/itemCatalog';
import { fullSet, simSetup, spentCharacter, type SimSetup } from '../../src/lib/fightSim';
import { STRONG_KIT } from '../builders';
import { bagCountOf } from '../../src/lib/offline/inventory';
import { combatView, restThrough, runCombat } from '../../src/lib/offline/fight';
import { COSMETIC_EVENTS, type CombatCommand, type FightEvent } from '../../src/lib/offline/fightTypes';
import type { Ledger } from '../../src/lib/offline/ledger';

// IDL-16 (A4): the fight engine was split into profile, targets, steps and view. This file pins what it does: three scripted fights (fixed seed,
// so a fixed sealed random stream) are run request by request, and the HP and mana after every request, the fight's state, the kills, the
// rewards and a digest of every event must equal the fixture recorded from the code before the split. A refactor of lib/offline/fight*.ts
// that changes any number here changes the game. To record a new fixture on purpose (a deliberate rebalance), run
//   UPDATE_GOLDEN=1 npx tsx --test tests/goldenFight.test.ts
// and say in the PR why the fight changed.

// Auto-battle's win-chance gate is its own test (winChance.test.ts); here it is off so that weak kit fights strong monsters and loses.
(COMBAT.auto as { minWinChance: number }).minWinChance = 0;

const FIXTURE = join(__dirname, '..', 'fixtures', 'goldenFight.json');

/** Numbers are written to 6 decimals so a platform's last-bit noise cannot fail the comparison. */
const n6 = (value: number): string => String(Math.round(value * 1e6) / 1e6);

interface Step {
	/** Seconds after the start the request is made at */
	at: number;
	ask?: { commands?: CombatCommand[]; autoBattle?: boolean; autoUse?: boolean };
}

const eventLine = (e: FightEvent): string => {
	const reward = e.reward ? ` reward=${JSON.stringify({ ...e.reward, items: e.reward.items.map((d) => JSON.stringify(d)) })}` : '';
	return (
		[e.no, n6(e.t), e.kind, e.amount === undefined ? '' : n6(e.amount), e.crit ? 'crit' : '', e.id ?? '', e.n ?? '', e.type ?? '', e.level ?? ''].join('|') +
		reward
	);
};

const play = (setup: SimSetup, steps: Step[], potionIds: string[]) => {
	const s = simSetup(setup);
	let ledger: Ledger = s.ledger;
	let last = ledger.combat?.eventNo ?? 0;
	const trace: string[] = [];
	const events: FightEvent[] = [];
	for (const step of steps) {
		const out = runCombat(ledger, s.env(s.start + step.at), step.ask ?? {});
		ledger = out.ledger;
		const c = ledger.combat!;
		events.push(...c.log.filter((e) => e.no > last));
		last = c.eventNo;
		const f = c.fight;
		const view = combatView(ledger, s.env(s.start + step.at), 0, out.behind, 30);
		trace.push(
			[
				`t=${step.at}`,
				`at=${n6(c.at - s.start)}`,
				`hp=${n6(c.hp)}`,
				`mp=${n6(c.mp)}`,
				`cd=${n6(c.cd.heal)}/${n6(c.cd.stun)}/${n6(c.cd.potion)}`,
				f
					? `fight=#${f.n}:${f.type}:L${f.level}:hp${n6(f.monsterHp)}:stun${n6(f.stunLeft)}:el${n6(f.elapsed)}:pt${n6(f.playerTimer)}:mt${n6(f.monsterTimer)}:left${f.timeLeftSec === null ? '-' : n6(f.timeLeftSec)}:ord${f.ord}:seq${f.seq}`
					: 'fight=-',
				`queue=${c.queue.join(',')}`,
				`ev=${c.eventNo}`,
				out.behind ? 'behind' : '',
				out.queued ? `queued=${out.queued}` : '',
				`poll=${view.nextPollSec}`,
				view.resting ? `rest=${view.restSec}` : '',
				view.autoNote ? `note=${view.autoNote}` : '',
				`retry=${view.retrySec}`,
			].join(' '),
		);
	}
	const kinds: Record<string, number> = {};
	const amounts: Record<string, number> = {};
	for (const e of events) {
		kinds[e.kind] = (kinds[e.kind] ?? 0) + 1;
		if (e.amount !== undefined) amounts[e.kind] = Math.round(((amounts[e.kind] ?? 0) + e.amount) * 10) / 10;
	}
	return {
		trace,
		events: {
			count: events.length,
			kinds,
			amounts,
			digest: createHash('sha1').update(events.map(eventLine).join('\n')).digest('hex'),
			results: events.filter((e) => !COSMETIC_EVENTS.has(e.kind)).map(eventLine),
		},
		final: {
			hp: n6(ledger.combat!.hp),
			mp: n6(ledger.combat!.mp),
			kills: ledger.ordKill,
			granted: ledger.granted,
			ratsLeft: ledger.bank.rats.map((t) => t.n),
			king: ledger.bank.king?.n ?? null,
			retryAt: Object.fromEntries(Object.entries(ledger.combat!.retryAt).map(([k, v]) => [k, n6(v - s.start)])),
			potions: Object.fromEntries(potionIds.map((id) => [id, bagCountOf(ledger.inv!, id)])),
			ord: ledger.combat!.ord,
		},
	};
};

const every = (seconds: number, stepSec: number, first: Step[] = []): Step[] => {
	const steps = [...first];
	for (let at = first.length ? first[first.length - 1].at + stepSec : stepSec; at <= seconds + 1e-9; at += stepSec) steps.push({ at });
	return steps;
};

// ------------------------------------------------------------------------------------------------------ the scenarios

/** Auto-battle with a weak kit at level 30: it wins the easy rats, loses to the strong one, rests, drinks potions, heals and stuns, then tries again. */
const autoSweep = () =>
	play(
		{
			equipment: STARTER_EQUIPMENT,
			character: spentCharacter({ intelligence: 4 }),
			level: 30,
			potions: [{ id: 'potion_minor', qty: 6 }],
			monsters: [
				{ type: 'thistleBoar', level: 2 },
				{ type: 'thistleBoar', level: 9 },
				{ type: 'thistleBoar', level: 4, lucky: true },
				{ type: 'bossGreatAuroch', level: 15 },
			],
			seed: 'golden-sweep',
		},
		every(420, 1),
		['potion_minor'],
	);

/** Clicks and the battle queue with a strong kit: fight, queue two, take one out, a hotkey potion and skills, a click at rest, then the clock runs on. */
const clickQueue = () =>
	play(
		{
			equipment: STRONG_KIT,
			level: 30,
			potions: [{ id: 'potion_minor', qty: 3 }],
			monsters: [
				{ type: 'thistleBoar', level: 11 },
				{ type: 'thistleBoar', level: 12 },
				{ type: 'thistleBoar', level: 12 },
				{ type: 'thistleBoar', level: 11 },
				{ type: 'bossGreatAuroch', level: 15 },
			],
			seed: 'golden-queue',
		},
		[
			{ at: 0, ask: { autoBattle: false, commands: [{ kind: 'fight', n: 1 }] } },
			{ at: 1, ask: { commands: [{ kind: 'fight', n: 2 }] } },
			{
				at: 2,
				ask: {
					commands: [
						{ kind: 'fight', n: 3 },
						{ kind: 'fight', n: 4 },
					],
				},
			},
			{
				at: 3,
				ask: {
					commands: [
						{ kind: 'fight', n: 1 },
						{ kind: 'fight', n: 99 },
						{ kind: 'skill', id: 'stun' },
						{ kind: 'unqueue', n: 3 },
					],
				},
			},
			{
				at: 4,
				ask: {
					commands: [
						{ kind: 'potion', id: 'potion_minor' },
						{ kind: 'skill', id: 'heal' },
					],
				},
			},
			...every(90, 1).slice(4),
			{ at: 91, ask: { commands: [{ kind: 'fight', n: 5 }] } },
			...every(160, 1).slice(91),
		],
		['potion_minor'],
	);

/** A boss against a weak hero with auto-use off: a long fight that ends by the clock or the knockout, a retreat, a long idle gap and a rest. */
const kingAndRest = () => {
	const s = simSetup({
		equipment: STARTER_EQUIPMENT,
		monsters: [
			{ type: 'bossGreatAuroch', level: 15 },
			{ type: 'thistleBoar', level: 1 },
		],
		seed: 'golden-king',
	});
	const steps: Step[] = [
		{ at: 0, ask: { autoUse: false, commands: [{ kind: 'fight', n: 2 }] } },
		...every(30, 2).slice(0, 15),
		{ at: 32, ask: { commands: [{ kind: 'fight', n: 1 }] } },
		{ at: 40, ask: { autoUse: true } },
		...[60, 90, 150, 400, 401].map((at) => ({ at })),
		{ at: 640, ask: { autoBattle: false } },
		{ at: 700, ask: { autoBattle: true } },
		...[701, 702, 2000].map((at) => ({ at })),
	];
	const played = play(
		{
			equipment: STARTER_EQUIPMENT,
			monsters: [
				{ type: 'bossGreatAuroch', level: 15 },
				{ type: 'thistleBoar', level: 1 },
			],
			seed: 'golden-king',
		},
		steps,
		[],
	);
	// the rest after an absence is part of the engine's contract too (offline/service.ts calls it)
	const rested = restThrough(s.ledger, s.env(s.start + 500), 500).combat!;
	return { ...played, rested: { hp: n6(rested.hp), mp: n6(rested.mp), at: n6(rested.at - s.start), fight: rested.fight === null, queue: rested.queue.length } };
};

/** A hero who cannot hurt a boss: the boss's clock runs out (a timeout), and a switch of auto-battle off in the next fight calls it off (a retreat). */
const bossClock = () =>
	play(
		{
			equipment: { ...fullSet('obsidian'), mainHand: undefined },
			character: spentCharacter({ vitality: 25 }),
			level: 30,
			potions: [{ id: 'potion_minor', qty: 9 }],
			monsters: [{ type: 'bossGreatAuroch', level: 15 }],
			seed: 'golden-clock',
		},
		[
			...every(70, 5),
			{ at: 76 },
			{ at: 80 },
			{ at: 400, ask: { autoBattle: true } },
			{ at: 410 },
			{ at: 420, ask: { autoBattle: false } },
			...every(500, 20).filter((step) => step.at > 420),
		],
		['potion_minor'],
	);

const record = () => ({ autoSweep: autoSweep(), clickQueue: clickQueue(), kingAndRest: kingAndRest(), bossClock: bossClock() });

test('golden fights: the HP and mana after every request, the kills, the rewards and every event equal the recorded fixture', () => {
	const now = JSON.parse(JSON.stringify(record()));
	if (process.env.UPDATE_GOLDEN === '1' || !existsSync(FIXTURE)) {
		writeFileSync(FIXTURE, JSON.stringify(now, null, '\t') + '\n');
		return;
	}
	const golden = JSON.parse(readFileSync(FIXTURE, 'utf8'));
	for (const name of Object.keys(golden)) {
		assert.deepEqual(now[name].trace, golden[name].trace, `${name}: the per-request trace`);
		assert.deepEqual(now[name].events, golden[name].events, `${name}: the events`);
		assert.deepEqual(now[name].final, golden[name].final, `${name}: the final state`);
	}
	assert.deepEqual(now, golden);
});

test('golden fights cover what they claim: wins, a knockout, a timeout or retreat, potions, both skills and the queue', () => {
	const r = record();
	const all = (name: keyof typeof r) => r[name].events.kinds;
	assert.ok((all('autoSweep').won ?? 0) >= 2, 'wins');
	assert.ok((all('bossClock').timeout ?? 0) >= 1, 'a timeout');
	assert.ok((all('kingAndRest').defeated ?? 0) >= 1, 'a knockout');
	assert.ok((all('autoSweep').potion ?? 0) >= 1, 'a potion');
	assert.ok((all('autoSweep').heal ?? 0) >= 1, 'a heal');
	assert.ok((all('autoSweep').stun ?? 0) + (all('autoSweep').resist ?? 0) >= 1, 'a stun or a resist');
	assert.ok((all('clickQueue').won ?? 0) >= 3, 'the queue is fought');
	assert.ok(
		r.clickQueue.trace.some((line) => line.includes('queued=queued')) && r.clickQueue.trace.some((line) => line.includes('queued=removed')),
		'queue results',
	);
	assert.ok((all('kingAndRest').retreat ?? 0) >= 1, 'a retreat');
	assert.ok(r.kingAndRest.events.count > 50, 'the king fight ran');
});
