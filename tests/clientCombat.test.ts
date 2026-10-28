import test from 'node:test';
import assert from 'node:assert/strict';
import { api, closeFight, freshGame, growTo, openFight, store } from './helpers';
import { COMBAT, MONSTERS } from '../src/config/combatConfig';
import { CASTLE_X, CASTLE_Y, REBIRTH } from '../src/config/gameConfig';
import { BASIC_GEAR, ITEM_CATALOG, RATTATUI_SET } from '../src/config/itemCatalog';
import { emptyBag, stackOf } from '../src/lib/inventory';
import { plainItem, sellValueOf } from '../src/lib/itemInstance';
import { calculateCombatStats, sellPayout } from '../src/utils/gameUtils';
import { maxMana } from '../src/lib/combat';
import { generateLoot } from '../src/lib/loot';
import { useUiStore } from '../src/stores/uiStore';
import { patchTile } from '../src/utils/world';
import type { CombatView, FightEvent } from '../src/lib/offline/fightTypes';
import type { FightReply } from '../src/lib/offline/types';
import type { Drop } from '../src/types/game';

// The browser's side of server-run combat: the store applies what the server says happened (it never rolls anything itself).

let clock = 1_000;
const view = (over: Partial<CombatView> = {}): CombatView => ({
	hp: 90,
	mp: 30,
	maxHp: 101,
	maxMp: 40,
	cd: { heal: 0, stun: 0, potion: 0 },
	fight: null,
	autoBattle: true,
	autoUse: true,
	retrySec: 0,
	at: ++clock,
	eventNo: 0,
	events: [],
	behind: false,
	nextPollSec: 8,
	...over,
});
const reply = (combat: CombatView, over: Partial<FightReply> = {}): FightReply => ({ combat, tickets: { chests: 0, rats: [], king: null }, serverNowSec: clock, gemsTotal: 1000, accepted: true, ...over });
const event = (no: number, kind: FightEvent['kind'], extra: Partial<FightEvent> = {}): FightEvent => ({ no, t: clock, kind, ...extra });
const won = (no: number, drops: Drop[], over: { gold?: number; xp?: number; lucky?: boolean; level?: number } = {}): FightEvent =>
	event(no, 'won', { n: 1, type: 'rat', level: over.level ?? 1, reward: { gold: over.gold ?? 50, xp: over.xp ?? 20, items: drops, pity: {}, lucky: over.lucky ?? false } });
const ratDrops = (level = 1) => generateLoot({ sourceId: 'rat', level }, () => 0).drops;

/** A game whose cursor is already in the server's log (the first answer only says where the log stands). */
const syncedGame = () => {
	freshGame();
	growTo(6);
	api().applyFightReply(reply(view({ eventNo: 0 })));
};

// ---------------------------------------------------------------------------------------------------- applying the server's picture

test('the first answer only says where the server\'s log stands: nothing in it is applied, the picture is', () => {
	freshGame();
	const gold = api().resources.gold;
	api().applyFightReply(reply(view({ hp: 77, mp: 12, eventNo: 5, events: [won(5, [])], fight: { n: 1, type: 'rat', level: 2, lucky: false, monsterHp: 40, monsterMaxHp: 150, stunLeft: 0, timeLeftSec: null, x: 1, y: 2 } })));
	assert.equal(api().resources.gold, gold);
	assert.equal(api().playerHp, 77);
	assert.equal(api().playerMp, 12);
	assert.equal(api().combat.eventNo, 5);
	assert.equal(api().combat.fight?.monsterHp, 40);
	assert.equal(api().combat.notice, null);
});

test('a won fight pays gold, xp and loot exactly once, and announces it', () => {
	syncedGame();
	const before = { ...api().resources };
	const ev = won(1, ratDrops(), { gold: 123, xp: 45 });
	api().applyFightReply(reply(view({ eventNo: 1, events: [ev] })));
	assert.equal(api().resources.gold - before.gold, 123);
	assert.ok(Math.abs(api().resources.xp - before.xp - 45) < 1e-6);
	const notice = api().combat.notice!;
	assert.equal(notice.kind, 'won');
	assert.equal(notice.summary!.gold, 123);
	const ids = notice.summary!.items.map((d) => (d.kind === 'gear' ? d.item.base : d.id));
	assert.ok(ids.includes('potion_minor'));
	assert.ok(ids.some((id) => (BASIC_GEAR as readonly string[]).includes(id)));
	assert.equal(ids.some((id) => RATTATUI_SET.pieces.includes(id)), false, 'a rat drops no Rattatui piece');
	assert.equal(api().bag.map(stackOf).find((s) => s?.id === 'potion_minor')?.qty, 3);
	// the same events again (a second poll overlapping the first) change nothing
	const gold = api().resources.gold;
	api().applyFightReply(reply(view({ eventNo: 1, events: [ev] })));
	assert.equal(api().resources.gold, gold);
});

test('an answer older than one already applied is ignored', () => {
	syncedGame();
	api().applyFightReply(reply(view({ hp: 50, at: 5000, eventNo: 0 })));
	api().applyFightReply(reply(view({ hp: 99, at: 4000, eventNo: 0 })));
	assert.equal(api().playerHp, 50);
});

test('loot with a full bag converts to gold and loses no items', () => {
	syncedGame();
	const full = emptyBag().map(() => ({ item: plainItem('wooden_sword') }));
	store.setState({ bag: full });
	const before = api().resources.gold;
	api().applyFightReply(reply(view({ eventNo: 1, events: [won(1, ratDrops(), { gold: 10 })] })));
	const summary = api().combat.notice!.summary!;
	assert.deepEqual(api().bag, full);
	assert.deepEqual(summary.items, []);
	const expected = ratDrops().reduce((sum, d) => sum + (d.kind === 'gear' ? sellValueOf(d.item) : d.qty * ITEM_CATALOG[d.id].sellValue), 0);
	assert.ok(expected > ITEM_CATALOG.potion_minor.sellValue);
	assert.equal(summary.convertedGold, expected);
	assert.equal(api().resources.gold - before, 10 + summary.convertedGold);
});

test('the auto-sell filter sells matching gear on the spot, pays Haggler like a hand sale, and still stores the potion', () => {
	syncedGame();
	store.setState({ autoSellUpTo: 'common', merchantUpgrades: { haggler: 3 } });
	const before = api().resources.gold;
	const bagBefore = api().bag;
	api().applyFightReply(reply(view({ eventNo: 1, events: [won(1, ratDrops(), { gold: 10 })] })));
	const summary = api().combat.notice!.summary!;
	const rolled = ratDrops().find((d) => d.kind === 'gear');
	const unit = rolled && rolled.kind === 'gear' ? sellValueOf(rolled.item) : 0;
	assert.ok(unit > 0);
	assert.equal(summary.autoSold.count, 1);
	assert.equal(summary.autoSold.gold, sellPayout(unit, 1, { merchantUpgrades: { haggler: 3 } }));
	assert.equal(summary.items.some((d) => d.kind === 'gear'), false, 'the gear was sold, not stored');
	assert.equal(summary.items.some((d) => d.kind === 'consumable'), true);
	assert.equal(api().resources.gold - before, 10 + summary.autoSold.gold);
	assert.equal(api().bag.filter((s) => s && 'item' in s).length, bagBefore.filter((s) => s && 'item' in s).length);
});

test('the auto-sell setting is validated', () => {
	freshGame();
	api().setAutoSell('uncommon');
	assert.equal(api().autoSellUpTo, 'uncommon');
	api().setAutoSell('mythic');
	assert.equal(api().autoSellUpTo, 'uncommon', 'an unknown rarity changes nothing');
	api().setAutoSell(null);
	assert.equal(api().autoSellUpTo, null);
});

test('a potion the server drank leaves the bag, once', () => {
	syncedGame();
	const qty = () => api().bag.map(stackOf).find((s) => s?.id === 'potion_minor')?.qty;
	assert.equal(qty(), 2);
	const ev = event(1, 'potion', { id: 'potion_minor', amount: 35 });
	api().applyFightReply(reply(view({ eventNo: 1, events: [ev] })));
	assert.equal(qty(), 1);
	api().applyFightReply(reply(view({ eventNo: 1, events: [ev] })));
	assert.equal(qty(), 1, 'the same event is never applied twice');
});

test('a defeat or a timeout is announced; the King taunts, a rat stays silent; the monster is not touched', () => {
	syncedGame();
	api().applyFightReply(reply(view({ eventNo: 1, events: [event(1, 'defeated', { n: 2, type: 'ratKing', level: 15 })] })));
	assert.equal(api().combat.notice?.kind, 'defeated');
	assert.ok(MONSTERS.ratKing.taunts.includes(api().combat.notice!.taunt as never));
	api().applyFightReply(reply(view({ eventNo: 2, events: [event(2, 'timeout', { n: 2, type: 'ratKing', level: 15 })] })));
	assert.equal(api().combat.notice?.kind, 'timeout');
	api().applyFightReply(reply(view({ eventNo: 3, events: [event(3, 'defeated', { n: 1, type: 'rat', level: 3 })] })));
	assert.equal(api().combat.notice?.taunt, null);
	api().clearCombatNotice();
	assert.equal(api().combat.notice, null);
});

test('a log that starts again (a rebirth is a new run) is read from its beginning', () => {
	syncedGame();
	api().applyFightReply(reply(view({ eventNo: 40 })));
	assert.equal(api().combat.eventNo, 40);
	const before = api().resources.gold;
	api().applyFightReply(reply(view({ eventNo: 1, events: [won(1, [], { gold: 77 })] })));
	assert.equal(api().resources.gold - before, 77);
});

// ---------------------------------------------------------------------------------------------------- what the player may ask

const realFetch = globalThis.fetch;
const flush = () => new Promise((resolve) => setTimeout(resolve, 20));
const record = () => {
	const calls: { path: string; body: Record<string, unknown> }[] = [];
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		calls.push({ path: String(input), body: JSON.parse(String(init?.body ?? '{}')) });
		return new Response(JSON.stringify(reply(view({ eventNo: 0 }), { accepted: true })), { status: 200, headers: { 'Content-Type': 'application/json' } });
	}) as typeof fetch;
	return calls;
};

test('hotkeys, switches and dismissals are requests to the server: a key per press, nothing about damage or HP', async () => {
	syncedGame();
	store.setState({ monsters: [{ id: 3, type: 'rat', level: 1, spawnLevel: 1, x: CASTLE_X + 2, y: CASTLE_Y, ageSec: 0, ticket: 3 }] });
	const calls = record();
	try {
		assert.equal(api().requestPotion('potion_minor'), true);
		assert.equal(api().requestPotion('wooden_sword'), false, 'not a potion: never sent');
		api().requestSkill('heal');
		api().setAutoBattle(false);
		assert.equal(api().combat.autoBattle, false, 'the switch shows at once');
		api().setAutoUse(false);
		assert.equal(api().dismissMonster(3), true);
		assert.equal(api().monsters.length, 0);
		await flush();
		assert.deepEqual(calls.map((c) => c.body.action), ['use', 'use', 'auto', 'auto', 'dismiss']);
		assert.deepEqual(calls[0].body.command, { kind: 'potion', id: 'potion_minor' });
		assert.deepEqual(calls[1].body.command, { kind: 'skill', id: 'heal' });
		assert.match(String(calls[0].body.key), /^[A-Za-z0-9_-]{8,64}$/);
		assert.notEqual(calls[0].body.key, calls[1].body.key, 'every press has its own key');
		assert.equal(calls[4].body.n, 3);
		for (const call of calls) assert.equal(call.path, '/api/fight');
		for (const call of calls) assert.deepEqual(Object.keys(call.body).filter((k) => ['damage', 'hp', 'level', 'gold'].includes(k)), []);
	} finally {
		globalThis.fetch = realFetch;
	}
});

test('a click on a monster asks the server for that monster\'s ticket: no such monster, no ticket or a fight already open send nothing', async () => {
	syncedGame();
	store.setState({
		monsters: [
			{ id: 3, type: 'rat', level: 1, spawnLevel: 1, x: CASTLE_X + 2, y: CASTLE_Y, ageSec: 0, ticket: 7 },
			{ id: 4, type: 'rat', level: 1, spawnLevel: 1, x: CASTLE_X + 3, y: CASTLE_Y, ageSec: 0 },
		],
	});
	const calls = record();
	try {
		assert.equal(api().startFight(99), false, 'not on the map');
		assert.equal(api().startFight(4), false, 'a monster the server has no ticket for');
		assert.equal(api().startFight(3), true);
		openFight();
		assert.equal(api().startFight(3), false, 'a fight is already open');
		await flush();
		assert.equal(calls.length, 1);
		assert.equal(calls[0].path, '/api/fight');
		assert.equal(calls[0].body.action, 'use');
		assert.deepEqual(calls[0].body.command, { kind: 'fight', n: 7 });
		assert.match(String(calls[0].body.key), /^[A-Za-z0-9_-]{8,64}$/);
	} finally {
		closeFight();
		globalThis.fetch = realFetch;
	}
});

test('a click opens the combat window at once (maximized, loading) and the answer fills it in; a second click while it waits does nothing', async () => {
	syncedGame();
	store.setState({ monsters: [{ id: 3, type: 'rat', level: 4, spawnLevel: 4, x: CASTLE_X + 2, y: CASTLE_Y, ageSec: 0, ticket: 7 }] });
	useUiStore.getState().setPref('combatMinimized', true);
	const calls = record();
	try {
		assert.equal(api().combat.pending, null);
		assert.equal(api().startFight(3), true);
		assert.deepEqual(api().combat.pending, { type: 'rat', level: 4 }, 'the window is up before the server has answered');
		assert.equal(useUiStore.getState().combatMinimized, false, 'a minimized window opens for a click');
		assert.equal(api().startFight(3), false, 'one click at a time');
		// the server opens the fight: the loading state is over
		api().applyFightReply(reply(view({ eventNo: 0, fight: { n: 7, type: 'rat', level: 4, lucky: false, monsterHp: 100, monsterMaxHp: 100, stunLeft: 0, timeLeftSec: null, x: 1, y: 2 } })));
		assert.equal(api().combat.pending, null);
		assert.ok(api().combat.fight);
		await flush();
		assert.equal(calls.length, 1);
	} finally {
		closeFight();
		globalThis.fetch = realFetch;
	}
});

test('a click the server does not take (no fight in the answer) closes the loading window again', async () => {
	syncedGame();
	store.setState({ monsters: [{ id: 3, type: 'rat', level: 4, spawnLevel: 4, x: CASTLE_X + 2, y: CASTLE_Y, ageSec: 0, ticket: 7 }] });
	const calls = record();
	try {
		assert.equal(api().startFight(3), true);
		assert.ok(api().combat.pending);
		await flush();
		assert.equal(calls.length, 1);
		assert.equal(api().combat.pending, null, 'the answer had no fight: nothing waits any more');
	} finally {
		globalThis.fetch = realFetch;
	}
});

test('a won fight stays in the window as a result: the notice carries the monster and its loot until it is closed', () => {
	syncedGame();
	api().applyFightReply(reply(view({ eventNo: 1, events: [won(1, ratDrops(), { gold: 80, xp: 30 })] })));
	const notice = api().combat.notice;
	assert.ok(notice && notice.kind === 'won' && notice.summary);
	assert.equal(notice.type, 'rat');
	assert.equal(api().combat.fight, null, 'no fight is open, only the result');
	api().clearCombatNotice();
	assert.equal(api().combat.notice, null);
});

test('auto-battle starts switched off, in the browser as on the server', () => {
	freshGame();
	assert.equal(api().combat.autoBattle, false);
	assert.equal(api().combat.autoUse, true);
});

// ---------------------------------------------------------------------------------------------------- the clock between answers

const run = (seconds: number) => {
	for (let i = 0; i < seconds; i++) api().tick(1000);
};
const max = () => api().combat.maxHp || 101;

test('HP fills between answers only outside fights (in one the server\'s picture is the only one)', () => {
	freshGame();
	store.setState({ playerHp: 50 });
	run(10);
	assert.equal(api().playerHp, 60);
	run(1000);
	assert.equal(api().playerHp, 101);
	store.setState({ playerHp: 50 });
	openFight();
	run(5);
	assert.equal(api().playerHp, 50);
	closeFight();
});

test('cooldowns and the stun count down between answers, and never below 0', () => {
	freshGame();
	openFight({ stunLeft: 3 });
	store.setState((s) => ({ combat: { ...s.combat, cd: { heal: 5, stun: 2, potion: 1 } } }));
	run(2);
	assert.deepEqual(api().combat.cd, { heal: 3, stun: 0, potion: 0 });
	assert.equal(api().combat.fight?.stunLeft, 1);
	run(10);
	assert.deepEqual(api().combat.cd, { heal: 0, stun: 0, potion: 0 });
	assert.equal(api().combat.fight?.stunLeft, 0);
});

test('tick never moves the monsters: they age on the map and stay where the server put them', () => {
	freshGame();
	growTo(6);
	store.setState({ monsters: [{ id: 3, type: 'rat', level: 1, spawnLevel: 1, x: CASTLE_X + 2, y: CASTLE_Y, ageSec: 0, ticket: 3 }] });
	run(3600);
	assert.equal(api().monsters.length, 1, 'no local spawning, killing or removing');
	assert.deepEqual([api().monsters[0].x, api().monsters[0].y], [CASTLE_X + 2, CASTLE_Y]);
	assert.equal(api().monsters[0].level, 3, 'an hour old: two growth intervals');
});

test('no chest or monster appears from local timers: the server is the only source', () => {
	freshGame();
	growTo(30);
	for (let i = 0; i < 80; i++) api().tick(60_000);
	assert.equal(api().monsters.length, 0);
	assert.equal(api().activeChests, 0);
});

test('rebirth and resetGame clear the monsters and the combat picture; rebirth keeps the gear', () => {
	freshGame();
	growTo(REBIRTH.minTiles);
	store.setState((s) => ({ tiles: patchTile(s.tiles, CASTLE_X, CASTLE_Y, { level: REBIRTH.minCastleLevel }) }));
	store.setState({ monsters: [{ id: 3, type: 'rat', level: 1, spawnLevel: 1, x: CASTLE_X + 2, y: CASTLE_Y, ageSec: 0, ticket: 3 }] });
	openFight();
	const gear = { ...api().equipment };
	assert.equal(api().rebirth(), true);
	assert.deepEqual(api().monsters, []);
	assert.equal(api().combat.fight, null);
	assert.deepEqual(api().equipment, gear);
	openFight();
	api().resetGame();
	assert.equal(api().combat.fight, null);
	assert.deepEqual(api().monsters, []);
});

// ---- mana ------------------------------------------------------------------------------------------------------------------------

test('mana refills over time, and never above the maximum', () => {
	freshGame();
	assert.equal(api().playerMp, maxMana(api().characterStats, api().equipment));
	store.setState({ playerMp: 0 });
	run(10);
	assert.ok(Math.abs(api().playerMp - 7.5) < 0.01, `${api().playerMp}`); // 0.75 per second at the start
	run(500);
	assert.equal(api().playerMp, 40);
	store.setState({ playerMp: 10 });
	openFight();
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

test('a rebirth refills mana to the pool of the gear that survives', () => {
	freshGame();
	growTo(REBIRTH.minTiles);
	store.setState((s) => ({ tiles: patchTile(s.tiles, CASTLE_X, CASTLE_Y, { level: REBIRTH.minCastleLevel }), bag: [{ item: plainItem('apprentice_tome') }, ...emptyBag().slice(1)] }));
	api().equipItem(0);
	store.setState({ playerMp: 1 });
	assert.equal(api().rebirth(), true);
	assert.equal(api().playerMp, maxMana(api().characterStats, api().equipment));
	assert.equal(api().playerMp, 48);
	assert.ok(max() > 0 && COMBAT.regenPerSec > 0);
});

test('flee leaves the open fight at once, asks the server to retreat (auto-battle off) and shows no result', async () => {
	syncedGame();
	api().applyFightReply(reply(view({ eventNo: 0, autoBattle: true, fight: { n: 7, type: 'rat', level: 4, lucky: false, monsterHp: 60, monsterMaxHp: 100, stunLeft: 0, timeLeftSec: null, x: 1, y: 2 } })));
	assert.ok(api().combat.fight);
	const calls = record();
	try {
		api().flee();
		assert.equal(api().combat.fight, null, 'the window does not wait for the answer');
		assert.equal(api().combat.autoBattle, false, 'auto-battle would start the next fight at once');
		assert.equal(api().combat.notice, null);
		await flush();
		assert.equal(calls.length, 1);
		assert.equal(calls[0].body.action, 'auto');
		assert.equal(calls[0].body.autoBattle, false);
		api().flee();
		await flush();
		assert.equal(calls.length, 1, 'no fight, nothing to flee from: nothing is sent');
	} finally {
		globalThis.fetch = realFetch;
	}
});

test('a retreat the server reports clears an older result instead of showing it again', () => {
	syncedGame();
	api().applyFightReply(reply(view({ eventNo: 1, events: [won(1, ratDrops())] })));
	assert.equal(api().combat.notice?.kind, 'won');
	api().applyFightReply(reply(view({ eventNo: 2, events: [event(2, 'retreat', { n: 2, type: 'rat', level: 1 })] })));
	assert.equal(api().combat.notice, null);
});
