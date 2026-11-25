import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseMark, MARK_BUTTONS, MARK_PREFS, MARK_TARGETS, MONSTER_MARK_TILES, type MarkPref } from '../../src/config/mapMarks';
import { monsterMatches } from '../../src/lib/monsterMarks';
import { limitOf } from '../../src/lib/limits';
import { MONSTERS } from '../../src/config/combatConfig';
import { isBoss } from '../../src/lib/monsters';
import type { Monster } from '../../src/types/game';
import { api, freshGame } from '../helpers';

// The map marks (chests, ores, monsters and the monster kinds) are one choice: the buttons under the minimap and the Kingdom overview's tiles press them through `chooseMark`.

const none = Object.fromEntries(MARK_PREFS.map((key) => [key, false])) as Record<MarkPref, boolean>;
const lit = (...on: MarkPref[]) => ({ ...none, ...Object.fromEntries(on.map((key) => [key, true])) }) as Record<MarkPref, boolean>;

test('pressing a mark lights it and nothing else', () => {
	for (const pref of MARK_PREFS) assert.deepEqual(chooseMark(none, pref), lit(pref));
});

test('pressing another mark moves the choice, pressing the lit one switches it off', () => {
	const chests = chooseMark(none, 'markChests');
	const bosses = chooseMark(chests, 'markBosses');
	assert.deepEqual(bosses, lit('markBosses'));
	assert.deepEqual(chooseMark(bosses, 'markBosses'), none);
});

test('every mark has a target, the buttons and tiles cover all of them once, and a button has a picture that exists', () => {
	assert.deepEqual(Object.keys(MARK_TARGETS).sort(), [...MARK_PREFS].sort());
	assert.deepEqual([...MARK_BUTTONS.map((b) => b.pref), ...MONSTER_MARK_TILES.map((t) => t.pref)].sort(), [...MARK_PREFS].sort());
	for (const b of MARK_BUTTONS) {
		assert.ok(b.label && b.card && b.text);
		assert.ok(b.icon.startsWith('/pixel/'));
	}
	for (const t of MONSTER_MARK_TILES) assert.equal(MARK_TARGETS[t.pref].kind, 'monsters', `${t.card} rings monsters`);
});

test('the monster filters pick bosses, golden, fully grown, still growing and the strongest', () => {
	freshGame();
	const prestige = api().prestige;
	const limits = { prestige };
	const normal = Object.keys(MONSTERS).find((type) => !isBoss(type as Monster['type'])) as Monster['type'];
	const boss = Object.keys(MONSTERS).find((type) => isBoss(type as Monster['type'])) as Monster['type'];
	const grown = 5 + limitOf('monsterGrowthLevels', { prestige });
	const m = (patch: Partial<Monster>): Monster => ({ id: 1, type: normal, x: 0, y: 0, level: 5, spawnLevel: 5, ageSec: 0, ...patch });
	const mons = {
		plain: m({}),
		boss: m({ type: boss }),
		golden: m({ lucky: true }),
		grown: m({ level: grown, ageSec: 1e9 }),
	};
	const highestLevel = grown;
	const ctx = { limits, highestLevel };
	const hits = (filter: Parameters<typeof monsterMatches>[0]) =>
		Object.entries(mons)
			.filter(([, mon]) => monsterMatches(filter, mon, ctx))
			.map(([name]) => name);
	assert.deepEqual(hits('all'), ['plain', 'boss', 'golden', 'grown']);
	assert.deepEqual(hits('bosses'), ['boss']);
	assert.deepEqual(hits('golden'), ['golden']);
	assert.deepEqual(hits('grown'), ['grown']);
	assert.deepEqual(hits('growing'), ['plain', 'boss', 'golden']);
	assert.deepEqual(hits('strongest'), ['grown']);
	assert.equal(monsterMatches('strongest', mons.plain, { limits, highestLevel: 0 }), false, 'no monsters, no strongest');
});
