import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, store, tileAt, gridCells } from './helpers';
import { COMBAT, MONSTERS } from '../src/config/combatConfig';
import { CASTLE_X, CASTLE_Y, REBIRTH } from '../src/config/gameConfig';
import { BASIC_GEAR, ITEM_CATALOG, RATTATUI_SET, STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { emptyBag } from '../src/lib/inventory';
import { maxHp } from '../src/lib/combat';
import { castleLevelOf } from '../src/lib/castleWard';
import { spawnCap } from '../src/lib/spawnLimits';
import { fullSet } from '../src/lib/fightSim';
import { pickPersisted } from '../src/lib/sanitizeSave';
import type { Monster } from '../src/types/game';
import { patchTile } from '../src/utils/world';

let seq = 0;
let clock = 1_000_000;
/**
 * One trusted click. Crits are rolled with Math.random, so unless a test stubbed it already the click runs with a
 * random of `rnd` (0 = never a crit, 0.999 = always a crit and a super crit at the default odds).
 */
const hit = (gapMs = 250, rnd = 0) => {
	const input = { eventId: ++seq, now: (clock += gapMs), trusted: true };
	if ('mock' in Math.random) return api().hitMonster(input);
	const stub = mock.method(Math, 'random', () => rnd);
	try {
		return api().hitMonster(input);
	} finally {
		stub.mock.restore();
	}
};
const hits = (n: number, gapMs = 250) => Array.from({ length: n }, () => hit(gapMs));
const run = (seconds: number) => {
	for (let i = 0; i < seconds; i++) api().tick(1000);
};
const max = () => maxHp(api().characterStats, api().equipment);

const ownedSpots = () => {
	return gridCells()
		.filter(({ t }) => t.isOwned && t.biome !== 'castle')
		.map(({ x, y }) => ({ x, y }));
};

/** Fresh game with 6 tiles and one monster (id 1) on the first free owned tile. */
const withMonster = (over: Partial<Monster> = {}) => {
	freshGame();
	growTo(6);
	const spot = ownedSpots()[0];
	store.setState({ monsters: [{ id: 1, type: 'rat', tier: 1, ...spot, ageSec: 0, ...over }], nextMonsterId: 2 });
	return spot;
};

test('17 hits at 6 damage kill a tier-1 rat and 16 do not', () => {
	withMonster();
	assert.equal(api().startFight(1), true);
	const results = hits(16);
	assert.ok(results.every((r) => r && r.damage === 6 && !r.killed));
	assert.equal(api().fight?.monsterHp, 4);
	const last = hit();
	assert.equal(last?.killed, true);
	assert.equal(api().fight?.phase, 'won');
	assert.equal(api().monsters.length, 0);
});

test('untrusted clicks and repeated events do nothing, but fight hits are not rate limited', () => {
	withMonster();
	api().startFight(1);
	assert.equal(api().hitMonster({ eventId: ++seq, now: (clock += 250), trusted: false }), null);
	const sameEvent = { eventId: ++seq, now: (clock += 250), trusted: true };
	assert.ok(api().hitMonster(sameEvent));
	assert.equal(api().hitMonster(sameEvent), null); // one DOM event counts once
	// 10 distinct real clicks in the same millisecond all land: speed is skill, there is no cap
	const now = (clock += 10_000);
	const stub = mock.method(Math, 'random', () => 0);
	try {
		const results = Array.from({ length: 10 }, () => api().hitMonster({ eventId: ++seq, now, trusted: true }));
		assert.equal(results.filter(Boolean).length, 10);
	} finally {
		stub.mock.restore();
	}
});

test('crits: a high roll doubles the click, a super crit multiplies it by 5, a low roll is a plain hit', () => {
	withMonster({ type: 'ratKing', tier: 1 });
	api().startFight(1);
	const base = 6;
	assert.deepEqual(hit(250, 0), { damage: base, killed: false, crit: 'none' });
	assert.deepEqual(hit(250, 0.999), { damage: base * COMBAT.crit.superMult, killed: false, crit: 'super' });
	// a roll that crits (>= 1 - crit chance) but misses the super threshold
	const rolls = [0.99, 0];
	const stub = mock.method(Math, 'random', () => rolls.shift() ?? 0);
	try {
		assert.deepEqual(api().hitMonster({ eventId: ++seq, now: (clock += 250), trusted: true }), { damage: base * COMBAT.crit.mult, killed: false, crit: 'crit' });
	} finally {
		stub.mock.restore();
	}
});

test('hitMonster without a fight, or after the fight ended, returns null', () => {
	withMonster();
	assert.equal(hit(), null);
	api().startFight(1);
	hits(50);
	assert.equal(api().fight?.phase, 'won');
	assert.equal(hit(), null);
});

test('startFight on a missing or already killed monster, or while fighting, is false', () => {
	withMonster();
	assert.equal(api().startFight(99), false);
	assert.equal(api().startFight(1), true);
	assert.equal(api().startFight(1), false);
	hits(50);
	api().leaveFight();
	assert.equal(api().startFight(1), false); // killed: gone from the map
});

test('leaveFight then startFight gives the monster full HP again', () => {
	withMonster();
	api().startFight(1);
	hits(10);
	assert.equal(api().fight?.monsterHp, 40);
	api().leaveFight();
	assert.equal(api().fight, null);
	api().startFight(1);
	assert.equal(api().fight?.monsterHp, 100);
});

test('a kill pays gold, xp and loot', () => {
	withMonster();
	mock.method(Math, 'random', () => 0);
	try {
		api().startFight(1);
		const before = { ...api().resources };
		hits(50);
		const summary = api().fight!.summary!;
		assert.ok(summary.gold >= COMBAT.rewards.minGold);
		assert.equal(api().resources.gold - before.gold, summary.gold);
		assert.ok(Math.abs(api().resources.xp - before.xp - summary.xp) < 1e-6);
		const ids = summary.items.map((i) => i.id);
		assert.ok(ids.includes('potion_minor'));
		assert.ok(ids.some((id) => (BASIC_GEAR as readonly string[]).includes(id)));
		assert.equal(ids.some((id) => RATTATUI_SET.pieces.includes(id)), false, 'a rat drops no Rattatui piece');
		assert.equal(api().bag.find((s) => s?.id === 'potion_minor')?.qty, 3);
		assert.equal(summary.convertedGold, 0);
	} finally {
		mock.restoreAll();
	}
});

test('loot with a full bag converts to gold and loses no items', () => {
	withMonster();
	const full = emptyBag().map(() => ({ id: 'wooden_sword', qty: 1 }));
	store.setState({ bag: full });
	mock.method(Math, 'random', () => 0);
	try {
		api().startFight(1);
		const before = api().resources.gold;
		hits(50);
		const summary = api().fight!.summary!;
		assert.deepEqual(api().bag, full);
		assert.deepEqual(summary.items, []);
		const gear = ITEM_CATALOG[BASIC_GEAR[0]];
		assert.equal(summary.convertedGold, gear.sellValue + ITEM_CATALOG.potion_minor.sellValue);
		assert.equal(api().resources.gold - before, summary.gold + summary.convertedGold);
	} finally {
		mock.restoreAll();
	}
});

test('drinkPotion heals, respects the cooldown, rejects empty slots, non-consumables and full HP', () => {
	withMonster();
	store.setState({ playerHp: 50 });
	api().startFight(1);
	assert.equal(api().drinkPotion(0), true);
	assert.equal(api().playerHp, 85);
	assert.equal(api().bag[0]?.qty, 1);
	assert.equal(api().fight?.potionCd, COMBAT.potionCooldownSec);
	assert.equal(api().drinkPotion(0), false); // cooldown
	assert.equal(api().bag[0]?.qty, 1);
	run(COMBAT.potionCooldownSec);
	assert.equal(api().fight?.potionCd, 0);
	store.setState({ playerHp: 40 });
	assert.equal(api().drinkPotion(0), true);
	assert.equal(api().bag[0], null);
	store.setState({ playerHp: 10, fight: { ...api().fight!, potionCd: 0 } });
	assert.equal(api().drinkPotion(0), false); // empty slot
	assert.equal(api().drinkPotion(1.5), false);
	assert.equal(api().drinkPotion(-1), false);
	store.setState({ bag: [{ id: 'wooden_sword', qty: 1 }, ...emptyBag().slice(1)] });
	assert.equal(api().drinkPotion(0), false); // not a consumable
	store.setState({ bag: [{ id: 'potion_minor', qty: 1 }, ...emptyBag().slice(1)], playerHp: max() });
	assert.equal(api().drinkPotion(0), false); // full HP
});

test('potions work outside fights with no cooldown', () => {
	freshGame();
	store.setState({ playerHp: 20 });
	assert.equal(api().drinkPotion(0), true);
	assert.equal(api().drinkPotion(0), true);
	assert.equal(api().playerHp, 90);
	assert.equal(api().bag[0], null);
});

test('tick(300000) during a fight deals at most one attack', () => {
	withMonster();
	api().startFight(1);
	const before = api().playerHp;
	api().tick(300_000);
	assert.ok(api().playerHp >= before - 4, `${before} -> ${api().playerHp}`);
	assert.equal(api().fight?.phase, 'active');
});

test('knockout restores 30 % HP, ends the fight and blocks further hits', () => {
	withMonster();
	store.setState({ playerHp: 1 });
	api().startFight(1);
	for (let i = 0; i < 5 && api().fight?.phase === 'active'; i++) api().tick(1000);
	assert.equal(api().fight?.phase, 'knockedOut');
	assert.equal(api().playerHp, Math.round(max() * COMBAT.knockoutHpFraction));
	assert.equal(hit(), null);
	assert.equal(api().monsters.length, 1);
	api().leaveFight();
	api().startFight(1);
	assert.equal(api().fight?.monsterHp, 100);
});

test('HP regenerates only outside fights', () => {
	freshGame();
	store.setState({ playerHp: 50 });
	run(10);
	assert.equal(api().playerHp, 60);
	run(1000);
	assert.equal(api().playerHp, max());

	withMonster();
	store.setState({ playerHp: 50 });
	api().startFight(1);
	run(1);
	assert.equal(api().playerHp, 50);
});

test('rebirth and resetGame clear the fight and the monsters; rebirth keeps the gear', () => {
	withMonster();
	api().startFight(1);
	store.setState((s) => {
		const tiles = patchTile(s.tiles, CASTLE_X, CASTLE_Y, { level: REBIRTH.minCastleLevel });
		return { tiles, equipment: { ...STARTER_EQUIPMENT, head: 'rattatui_cap' }, fight: null };
	});
	growTo(REBIRTH.minTiles);
	api().startFight(1);
	assert.equal(api().rebirth(), true);
	assert.equal(api().fight, null);
	assert.deepEqual(api().monsters, []);
	assert.equal(api().equipment.head, 'rattatui_cap');

	api().resetGame();
	assert.equal(api().fight, null);
	assert.deepEqual(api().monsters, []);
	assert.deepEqual(api().equipment, STARTER_EQUIPMENT);
});

test('the first rat spawns after 120 s with 5 owned tiles, not before', () => {
	freshGame();
	growTo(4);
	run(300);
	assert.deepEqual(api().monsters, []); // too little land
	growTo(5);
	api().tick(1000);
	run(110);
	assert.deepEqual(api().monsters, []);
	run(15);
	assert.equal(api().monsters.length, 1);
	const m = api().monsters[0];
	assert.equal(m.type, 'rat');
	assert.equal(m.tier, 1);
	assert.equal(api().nextMonsterId, 2);
	assert.ok(!(m.x === CASTLE_X && m.y === CASTLE_Y));
	assert.equal(tileAt(api().tiles, m.x, m.y).hasChest, undefined);
});

test('monsters and chests fill exactly their share of the map, never share a tile and never stand on the castle', () => {
	freshGame();
	growTo(30);
	for (let i = 0; i < 160; i++) api().tick(300_000);
	const list = api().monsters;
	const cap = spawnCap(api().tiles, castleLevelOf(api().tiles));
	assert.equal(list.length + api().tiles.stats.chests, cap);
	assert.equal(new Set(list.map((m) => `${m.x},${m.y}`)).size, list.length);
	assert.ok(list.every((m) => tileAt(api().tiles, m.x, m.y).isOwned && tileAt(api().tiles, m.x, m.y).biome !== 'castle'));
	assert.ok(list.filter((m) => m.type === 'ratKing').length <= 1);
	assert.ok(list.every((m) => !tileAt(api().tiles, m.x, m.y).hasChest));
});

test('chests never spawn on a monster tile', () => {
	freshGame();
	growTo(3); // castle + 2 tiles: below the monster spawn threshold of 5 owned tiles
	const [a, b] = ownedSpots();
	store.setState({ monsters: [{ id: 1, type: 'rat', tier: 1, ...a, ageSec: 0 }], nextMonsterId: 2 });
	for (let i = 0; i < 3; i++) api().tick(300_000);
	assert.equal(tileAt(api().tiles, a.x, a.y).hasChest, undefined);
	assert.equal(tileAt(api().tiles, b.x, b.y).hasChest, true);
});

test('the Rat King times out, taunts, and stays on the map at full HP', () => {
	withMonster({ type: 'ratKing', tier: 1 });
	store.setState({ equipment: fullSet('rattatui') }); // armor that outlasts the whole time limit
	store.setState({ playerHp: max() });
	api().startFight(1);
	assert.equal(api().fight?.timeLeftSec, MONSTERS.ratKing.timeLimitSec);
	hits(40);
	run(MONSTERS.ratKing.timeLimitSec + 1);
	assert.equal(api().fight?.phase, 'timeout');
	assert.ok((MONSTERS.ratKing.taunts as readonly string[]).includes(api().fight!.taunt!));
	assert.equal(api().monsters.length, 1);
	assert.equal(api().monsters[0].type, 'ratKing');
	api().leaveFight();
	api().startFight(1);
	assert.equal(api().fight?.monsterHp, MONSTERS.ratKing.hp);
});

test('a fast clicker in full Rattatui gear beats the Rat King and wins Rattatui gear; the starter kit cannot', () => {
	withMonster({ type: 'ratKing', tier: 1 });
	mock.method(Math, 'random', () => 0); // no crits, no lucky drops: plain damage only
	try {
		store.setState({ equipment: fullSet('rattatui') });
		store.setState({ playerHp: max() });
		api().startFight(1);
		for (let sec = 0; sec < MONSTERS.ratKing.timeLimitSec && api().fight?.phase === 'active'; sec++) {
			hits(10, 100); // 10 clicks per second
			api().tick(1000);
		}
		assert.equal(api().fight?.phase, 'won');
		const ids = api().fight!.summary!.items.map((i) => i.id);
		assert.ok(ids.some((id) => RATTATUI_SET.pieces.includes(id)), 'the king drops a Rattatui piece');
		assert.equal(api().monsters.length, 0);
	} finally {
		mock.restoreAll();
	}
	withMonster({ type: 'ratKing', tier: 1 });
	api().startFight(1);
	for (let sec = 0; sec < MONSTERS.ratKing.timeLimitSec && api().fight?.phase === 'active'; sec++) {
		hits(25, 40); // even 25 clicks per second with the wooden sword gets nowhere
		api().tick(1000);
	}
	assert.notEqual(api().fight?.phase, 'won');
});

test('the monster being fought does not age', () => {
	withMonster();
	api().startFight(1);
	run(60);
	assert.equal(api().monsters[0].ageSec, 0);
	api().leaveFight();
	run(60);
	assert.equal(api().monsters[0].ageSec, 60);
});

test('loading a save (tab take-over / reload) drops a stale open fight', () => {
	withMonster();
	api().startFight(1);
	const merge = store.persist.getOptions().merge!;
	const saved = pickPersisted(api());
	const merged = merge(saved, api()) as ReturnType<typeof api>;
	assert.equal(merged.fight, null);
	assert.equal(merged.isHydrated, true);
});
