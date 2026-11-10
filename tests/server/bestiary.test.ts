import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT, MONSTERS } from '../../src/config/combatConfig';
import { spawnLevelRange } from '../../src/lib/monsters';
import { runCombat } from '../../src/lib/offline/fight';
import { simSetup } from '../../src/lib/fightSim';
import { bestiaryOf, emptyStats, isEmptyStats, readStats, recordEncounter, recordKill } from '../../src/lib/offline/stats';
import { useBestiaryStore, monsterNameOf } from '../../src/stores/bestiaryStore';
import { STRONG_KIT } from '../builders';
import type { MonsterType } from '../../src/types/game';

// Monster discovery: the first fight with a type marks it seen (`stats.seen`, epoch ms), every online answer carries the discovered ids and the kill counts, and the browser shows
// a "?" silhouette with no name until the type is in that list. Bestiary groundwork: the kill counts and `seen` are all a later bestiary (kill tiers 100 / 200 / 300) will read.

(COMBAT.auto as { minWinChance: number }).minWinChance = 0;

test('an encounter is recorded once per type and keeps the first time', () => {
	const first = recordEncounter(emptyStats(), 'thistleBoar', 1_800_000_000_000);
	assert.deepEqual(first.seen, { thistleBoar: 1_800_000_000_000 });
	assert.equal(recordEncounter(first, 'thistleBoar', 1_900_000_000_000), first, 'the same stats object comes back');
	assert.deepEqual(recordEncounter(first, 'bossGrove', 5).seen, { thistleBoar: 1_800_000_000_000, bossGrove: 5 });
	assert.equal(isEmptyStats(first), false);
});

test('seen reads back from the column: missing, malformed and valid values', () => {
	assert.deepEqual(emptyStats().seen, {});
	assert.deepEqual(readStats({ kills: { a: 1 } }).seen, {}, 'an old row without it: nothing discovered');
	assert.deepEqual(readStats({ seen: { a: 123, b: -1, c: 'x' } }).seen, { a: 123 });
	assert.deepEqual(readStats({ seen: [1, 2] }).seen, {});
});

test('the report lists the discovered types and the kills', () => {
	let s = recordEncounter(emptyStats(), 'thistleBoar', 1000);
	s = recordKill(s, { type: 'thistleBoar', lucky: false, boss: false });
	assert.deepEqual(bestiaryOf(s), { seen: ['thistleBoar'], kills: { thistleBoar: 1 } });
});

test('starting a fight discovers the monster, and a won fight counts a kill', () => {
	const type: MonsterType = 'thistleBoar';
	const s = simSetup({ equipment: STRONG_KIT, monsters: [{ type, level: spawnLevelRange(type, 1).min }], seed: 'bestiary-fight' });
	assert.deepEqual(s.ledger.stats.seen, {}, 'nothing met yet');
	const ledger = runCombat(s.ledger, s.env(s.start + 120)).ledger;
	assert.ok(ledger.stats.seen[type] > 0, 'the fight with it started: discovered');
	assert.equal(ledger.stats.kills[type], 1, 'and it was beaten');
	assert.deepEqual(Object.keys(ledger.stats.seen), [type], 'only the type that was fought');
});

test('the browser names an unknown monster "Unknown monster" until the server says it was met', () => {
	const label = MONSTERS.thistleBoar.label;
	useBestiaryStore.setState({ loaded: false, seen: new Set(), kills: {} });
	assert.equal(monsterNameOf('thistleBoar', label), label, 'before the first answer nothing is hidden');
	useBestiaryStore.getState().apply({ seen: ['graniteRam'], kills: {} });
	assert.equal(monsterNameOf('thistleBoar', label), 'Unknown monster');
	assert.equal(monsterNameOf('graniteRam', MONSTERS.graniteRam.label), MONSTERS.graniteRam.label);
	useBestiaryStore.getState().apply({ seen: ['graniteRam', 'thistleBoar'], kills: { thistleBoar: 3 } });
	assert.equal(monsterNameOf('thistleBoar', label), label);
	assert.equal(useBestiaryStore.getState().kills.thistleBoar, 3);
	useBestiaryStore.setState({ loaded: false, seen: new Set(), kills: {} });
});
