import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, store, tileAt, gridCells } from './helpers';
import { COMBAT, MONSTERS } from '../src/config/combatConfig';
import { CASTLE_X, CASTLE_Y, REBIRTH } from '../src/config/gameConfig';
import { BASIC_GEAR, ITEM_CATALOG, RATTATUI_SET, STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { emptyBag, stackOf } from '../src/lib/inventory';
import { plainItem, sellValueOf } from '../src/lib/itemInstance';
import { sellPayout } from '../src/utils/gameUtils';
import { leechHeal, maxHp, maxMana } from '../src/lib/combat';
import { calculateCombatStats } from '../src/utils/gameUtils';
import type { ItemInstance } from '../src/types/game';
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
	store.setState({ monsters: [{ id: 1, type: 'rat', level: 1, spawnLevel: 1, ...spot, ageSec: 0, ...over }], nextMonsterId: 2 });
	return spot;
};

test('17 hits at 6 damage kill a level 1 rat and 16 do not', () => {
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
	withMonster(); // a rat has no armor, so the click is the plain damage
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
		const ids = summary.items.map((d) => (d.kind === 'gear' ? d.item.base : d.id));
		assert.ok(ids.includes('potion_minor'));
		assert.ok(ids.some((id) => (BASIC_GEAR as readonly string[]).includes(id)));
		assert.equal(ids.some((id) => RATTATUI_SET.pieces.includes(id)), false, 'a rat drops no Rattatui piece');
		assert.equal(api().bag.map(stackOf).find((s) => s?.id === 'potion_minor')?.qty, 3);
		assert.equal(summary.convertedGold, 0);
		assert.deepEqual(summary.autoSold, { count: 0, gold: 0 });
	} finally {
		mock.restoreAll();
	}
});

test('loot with a full bag converts to gold and loses no items', () => {
	withMonster();
	const full = emptyBag().map(() => ({ item: plainItem('wooden_sword') }));
	store.setState({ bag: full });
	mock.method(Math, 'random', () => 0);
	try {
		api().startFight(1);
		const before = api().resources.gold;
		hits(50);
		const summary = api().fight!.summary!;
		assert.deepEqual(api().bag, full);
		assert.deepEqual(summary.items, []);
		// a random of 0 rolls a level 1 common item: the first base of the pool
		assert.equal(summary.convertedGold, sellValueOf(plainItem(BASIC_GEAR[0])) + ITEM_CATALOG.potion_minor.sellValue);
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
	assert.equal(stackOf(api().bag[0])?.qty, 1);
	assert.equal(api().fight?.potionCd, COMBAT.potionCooldownSec);
	assert.equal(api().drinkPotion(0), false); // cooldown
	assert.equal(stackOf(api().bag[0])?.qty, 1);
	run(COMBAT.potionCooldownSec);
	assert.equal(api().fight?.potionCd, 0);
	store.setState({ playerHp: 40 });
	assert.equal(api().drinkPotion(0), true);
	assert.equal(api().bag[0], null);
	store.setState({ playerHp: 10, fight: { ...api().fight!, potionCd: 0 } });
	assert.equal(api().drinkPotion(0), false); // empty slot
	assert.equal(api().drinkPotion(1.5), false);
	assert.equal(api().drinkPotion(-1), false);
	store.setState({ bag: [{ item: plainItem('wooden_sword') }, ...emptyBag().slice(1)] });
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
		return { tiles, equipment: { ...STARTER_EQUIPMENT, head: plainItem('rattatui_cap') }, fight: null };
	});
	growTo(REBIRTH.minTiles);
	api().startFight(1);
	assert.equal(api().rebirth(), true);
	assert.equal(api().fight, null);
	assert.deepEqual(api().monsters, []);
	assert.deepEqual(api().equipment.head, plainItem('rattatui_cap'));

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
	assert.equal(m.level, m.spawnLevel);
	assert.ok(m.level >= 1 && m.level <= 3, 'a castle level 1 rat appears at level 1-3');
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
	store.setState({ monsters: [{ id: 1, type: 'rat', level: 1, spawnLevel: 1, ...a, ageSec: 0 }], nextMonsterId: 2 });
	for (let i = 0; i < 3; i++) api().tick(300_000);
	assert.equal(tileAt(api().tiles, a.x, a.y).hasChest, undefined);
	assert.equal(tileAt(api().tiles, b.x, b.y).hasChest, true);
});

test('the Rat King times out, taunts, and stays on the map at full HP', () => {
	withMonster({ type: 'ratKing', level: 15, spawnLevel: 15 });
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
	withMonster({ type: 'ratKing', level: 15, spawnLevel: 15 });
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
		const items = api().fight!.summary!.items;
		const ids = items.map((d) => (d.kind === 'gear' ? d.item.base : d.id));
		assert.ok(ids.some((id) => RATTATUI_SET.pieces.includes(id)), 'the king drops a Rattatui piece');
		const piece = items.find((d) => d.kind === 'gear' && RATTATUI_SET.pieces.includes(d.item.base));
		assert.equal(piece?.kind === 'gear' ? piece.item.level : 0, 15, 'at the King level');
		assert.equal(api().lootPity['boss:king_legendary'] ?? 0, 0, 'a random of 0 always drops the legendary: nothing to protect against');
		assert.equal(api().monsters.length, 0);
	} finally {
		mock.restoreAll();
	}
	withMonster({ type: 'ratKing', level: 15, spawnLevel: 15 });
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

test('the auto-sell filter sells matching gear on the spot, pays Haggler like a hand sale, and still stores the potion', () => {
	withMonster();
	store.setState({ autoSellUpTo: 'common', merchantUpgrades: { haggler: 3 } });
	mock.method(Math, 'random', () => 0);
	try {
		const before = api().resources.gold;
		const bagBefore = api().bag;
		api().startFight(1);
		hits(50);
		const summary = api().fight!.summary!;
		const unit = sellValueOf(plainItem(BASIC_GEAR[0]));
		assert.equal(summary.autoSold.count, 1);
		assert.equal(summary.autoSold.gold, sellPayout(unit, 1, { merchantUpgrades: { haggler: 3 } }));
		assert.equal(summary.items.some((d) => d.kind === 'gear'), false, 'the gear was sold, not stored');
		assert.equal(summary.items.some((d) => d.kind === 'consumable'), true);
		assert.equal(api().resources.gold - before, summary.gold + summary.autoSold.gold);
		assert.equal(api().bag.filter((s) => s && 'item' in s).length, bagBefore.filter((s) => s && 'item' in s).length);
	} finally {
		mock.restoreAll();
	}
});

test('drops are not auto-sold above the chosen rarity, and the setting is validated', () => {
	freshGame();
	api().setAutoSell('uncommon');
	assert.equal(api().autoSellUpTo, 'uncommon');
	api().setAutoSell('mythic');
	assert.equal(api().autoSellUpTo, 'uncommon', 'an unknown rarity changes nothing');
	api().setAutoSell(null);
	assert.equal(api().autoSellUpTo, null);
});

test('a higher monster level raises the item level of what it drops', () => {
	const best = (level: number) => {
		withMonster({ type: 'rat', level, spawnLevel: level });
		store.setState({ bag: emptyBag() });
		mock.method(Math, 'random', () => 0.0001); // always drops; the item level roll takes the low end
		try {
			api().startFight(1);
			hits(400);
			const items = api().fight!.summary!.items;
			return Math.max(0, ...items.map((d) => (d.kind === 'gear' ? d.item.level : 0)));
		} finally {
			mock.restoreAll();
		}
	};
	assert.ok(best(15) > best(5) + 8);
});

// ---- mana and life leech ------------------------------------------------------------------------------------------------

test('mana refills over time, in and out of fights, and never above the maximum', () => {
	freshGame();
	assert.equal(api().playerMp, maxMana(api().characterStats, api().equipment));
	store.setState({ playerMp: 0 });
	run(10);
	assert.ok(Math.abs(api().playerMp - 7.5) < 0.01, `${api().playerMp}`); // 0.75 per second at the start
	run(500);
	assert.equal(api().playerMp, 40);
	withMonster();
	store.setState({ playerMp: 10 });
	api().startFight(1);
	run(4);
	assert.ok(api().playerMp > 12.5, 'mana also refills during a fight');
});

test('Intelligence and magic gear raise the mana pool and its refill; changing gear clamps the mana', () => {
	freshGame();
	store.setState((s) => ({ characterStats: { ...s.characterStats, intelligence: 25, ...calculateCombatStats({ ...s.characterStats, intelligence: 25 }) } }));
	store.setState({ bag: [{ item: plainItem('apprentice_tome') }, ...emptyBag().slice(1)] });
	assert.equal(maxMana(api().characterStats, api().equipment), 120);
	store.setState({ playerMp: 120 });
	assert.equal(api().equipItem(0), true); // the tome: +8 mana
	assert.equal(maxMana(api().characterStats, api().equipment), 128);
	store.setState({ playerMp: 128 });
	assert.equal(api().unequipItem('offHand'), true);
	assert.equal(api().playerMp, 120, 'the pool shrinks, the mana follows it down');
});

test('life leech: a hit gives back a share of its damage as HP, never above the maximum', () => {
	withMonster();
	const leechy: ItemInstance = { base: 'steel_dagger', level: 40, rarity: 'uncommon', quality: 50, affixes: [{ id: 'lifeLeech_prefix', roll: 100 }] };
	store.setState((s) => ({ equipment: { ...s.equipment, mainHand: leechy }, playerHp: 50 }));
	api().startFight(1);
	const before = api().playerHp;
	const hitResult = hit(250, 0)!;
	const expected = leechHeal(hitResult.damage, api().equipment);
	assert.ok(expected > 0);
	assert.ok(Math.abs(api().playerHp - before - expected) < 1e-6, `${api().playerHp - before} vs ${expected}`);
	store.setState({ playerHp: max() });
	hit(250, 0);
	assert.equal(api().playerHp, max(), 'at full HP leech cannot overheal');
});

test('a rebirth refills mana to the pool of the gear that survives', () => {
	freshGame();
	growTo(REBIRTH.minTiles);
	store.setState((s) => ({ tiles: patchTile(s.tiles, CASTLE_X, CASTLE_Y, { level: REBIRTH.minCastleLevel }), bag: [{ item: plainItem('apprentice_tome') }, ...emptyBag().slice(1)] }));
	api().equipItem(0);
	store.setState({ playerMp: 1 });
	assert.equal(api().rebirth(), true);
	assert.equal(api().playerMp, maxMana(api().characterStats, api().equipment));
	assert.equal(api().playerMp, 48);
});
