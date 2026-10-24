import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, store } from './helpers';
import { COMBAT, MONSTERS } from '../src/config/combatConfig';
import { GRID_CENTER_X, GRID_CENTER_Y, REBIRTH } from '../src/config/gameConfig';
import { ITEM_CATALOG, RATTATUI_SET, STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { emptyBag } from '../src/lib/inventory';
import { maxHp } from '../src/lib/combat';
import { pickPersisted } from '../src/lib/sanitizeSave';
import type { Monster } from '../src/types/game';

let seq = 0;
let clock = 1_000_000;
/** One trusted click; `gapMs` between clicks keeps a human pace (4/s) unless a test wants to hammer the limiter. */
const hit = (gapMs = 250) => api().hitMonster({ eventId: ++seq, now: (clock += gapMs), trusted: true });
const hits = (n: number) => Array.from({ length: n }, () => hit());
const run = (seconds: number) => {
	for (let i = 0; i < seconds; i++) api().tick(1000);
};
const max = () => maxHp(api().characterStats, api().equipment);

const ownedSpots = () => {
	const found: { x: number; y: number }[] = [];
	api().tiles.forEach((row, y) =>
		row.forEach((t, x) => {
			if (t.isOwned && t.biome !== 'castle') found.push({ x, y });
		})
	);
	return found;
};

/** Fresh game with 6 tiles and one monster (id 1) on the first free owned tile. */
const withMonster = (over: Partial<Monster> = {}) => {
	freshGame();
	growTo(6);
	const spot = ownedSpots()[0];
	store.setState({ monsters: [{ id: 1, type: 'rat', tier: 1, ...spot, ageSec: 0, ...over }], nextMonsterId: 2 });
	return spot;
};

test('50 hits at 2 damage kill a tier-1 rat and 49 do not', () => {
	withMonster();
	assert.equal(api().startFight(1), true);
	const results = hits(49);
	assert.ok(results.every((r) => r && r.damage === 2 && !r.killed));
	assert.equal(api().fight?.monsterHp, 2);
	const last = hit();
	assert.equal(last?.killed, true);
	assert.equal(api().fight?.phase, 'won');
	assert.equal(api().monsters.length, 0);
});

test('untrusted clicks and clicks over the limiter rate do nothing', () => {
	withMonster();
	api().startFight(1);
	assert.equal(api().hitMonster({ eventId: ++seq, now: (clock += 250), trusted: false }), null);
	const now = (clock += 10_000);
	const results = Array.from({ length: 20 }, () => api().hitMonster({ eventId: ++seq, now, trusted: true }));
	assert.equal(results.filter(Boolean).length, 8); // CLICK_LIMIT.capacity
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
	assert.equal(api().fight?.monsterHp, 80);
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
		assert.ok(ids.some((id) => RATTATUI_SET.pieces.includes(id)));
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
		const piece = ITEM_CATALOG[RATTATUI_SET.pieces[0]];
		assert.equal(summary.convertedGold, piece.sellValue + ITEM_CATALOG.potion_minor.sellValue);
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
		const tiles = s.tiles.map((row) => [...row]);
		tiles[GRID_CENTER_Y][GRID_CENTER_X] = { ...tiles[GRID_CENTER_Y][GRID_CENTER_X], level: REBIRTH.minCastleLevel };
		return { tiles, equipment: { ...STARTER_EQUIPMENT, head: 'rattatui_cap' }, fight: null };
	});
	growTo(20);
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
	assert.ok(!(m.x === GRID_CENTER_X && m.y === GRID_CENTER_Y));
	assert.equal(api().tiles[m.y][m.x].hasChest, undefined);
});

test('monsters never exceed the cap, never share a tile and never stand on the castle', () => {
	freshGame();
	growTo(30);
	for (let i = 0; i < 160; i++) api().tick(300_000);
	const list = api().monsters;
	assert.equal(list.length, COMBAT.maxMonsters);
	assert.equal(new Set(list.map((m) => `${m.x},${m.y}`)).size, list.length);
	assert.ok(list.every((m) => api().tiles[m.y][m.x].isOwned && api().tiles[m.y][m.x].biome !== 'castle'));
	assert.ok(list.filter((m) => m.type === 'ratKing').length <= 1);
	assert.ok(list.every((m) => !api().tiles[m.y][m.x].hasChest));
});

test('chests never spawn on a monster tile', () => {
	freshGame();
	growTo(3); // castle + 2 tiles: below the monster spawn threshold of 5 owned tiles
	const [a, b] = ownedSpots();
	store.setState({ monsters: [{ id: 1, type: 'rat', tier: 1, ...a, ageSec: 0 }], nextMonsterId: 2 });
	for (let i = 0; i < 3; i++) api().tick(300_000);
	assert.equal(api().tiles[a.y][a.x].hasChest, undefined);
	assert.equal(api().tiles[b.y][b.x].hasChest, true);
});

test('the Rat King times out after 60 s, taunts, and stays on the map at full HP', () => {
	withMonster({ type: 'ratKing', tier: 1 });
	api().startFight(1);
	assert.equal(api().fight?.timeLeftSec, 60);
	hits(40);
	run(61);
	assert.equal(api().fight?.phase, 'timeout');
	assert.ok((MONSTERS.ratKing.taunts as readonly string[]).includes(api().fight!.taunt!));
	assert.equal(api().monsters.length, 1);
	assert.equal(api().monsters[0].type, 'ratKing');
	api().leaveFight();
	api().startFight(1);
	assert.equal(api().fight?.monsterHp, 1000);
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
	const saved = JSON.parse(JSON.stringify(pickPersisted(api())));
	const merged = merge(saved, api()) as ReturnType<typeof api>;
	assert.equal(merged.fight, null);
	assert.equal(merged.isHydrated, true);
});
