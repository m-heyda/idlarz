import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, setResources } from './helpers';
import { CASTLE_X, CASTLE_Y, MAX_CATCHUP_SEC } from '../src/config/gameConfig';
import { COMBAT, MONSTERS } from '../src/config/combatConfig';
import { castleDistance, dangerBonus, maxSpawnLevel, newMonster, rollSpawnLevel, spawnLevelRange } from '../src/lib/monsters';
import { generateLoot } from '../src/lib/loot/generate';
import { rollKillLoot } from '../src/lib/loot';
import { mulberry32 } from '../src/lib/rng';
import { patchTileAt } from './helpers';
import type { ChestReward, KillReward } from '../src/lib/offline/types';

const realFetch = globalThis.fetch;
const mockFetch = (handler: (path: string, body: Record<string, unknown>) => { status: number; body: unknown }) => {
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const out = handler(String(input), JSON.parse(String(init?.body ?? '{}')));
		return new Response(JSON.stringify(out.body), { status: out.status, headers: { 'Content-Type': 'application/json' } });
	}) as typeof fetch;
};
const restore = () => {
	globalThis.fetch = realFetch;
	api().setServerSpawns(false);
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 20));
const tickets = { chests: 0, rats: [], king: null };

// ---------------------------------------------------------------------------------------------------- the local timers stand still

test('with server spawns on, no chest or monster appears from the local timers; guests keep them', () => {
	freshGame();
	growTo(30);
	api().setServerSpawns(true);
	for (let i = 0; i < 80; i++) api().tick(MAX_CATCHUP_SEC * 1000); // 6.7 hours of local time
	assert.equal(api().monsters.length, 0);
	assert.equal(api().activeChests, 0);
	api().setServerSpawns(false);
	for (let i = 0; i < 20; i++) api().tick(MAX_CATCHUP_SEC * 1000);
	assert.ok(api().monsters.length > 0 || api().activeChests > 0, 'a guest still gets the local spawns');
});

// ---------------------------------------------------------------------------------------------------- opening a chest on the server

test('a chest opens through the server: the reward is the server\'s, the gems are its balance', async () => {
	freshGame();
	growTo(30);
	api().setServerSpawns(true);
	patchTileAt(CASTLE_X + 1, CASTLE_Y, { hasChest: true });
	const before = api().resources.gold;
	const reward: ChestReward = { ok: true, loot: { kind: 'gold', gold: 777, minutes: 10, goldRate: 1 }, gems: 12, gemsTotal: 1012, tickets, serverNowSec: 1 };
	let sentBody: Record<string, unknown> = {};
	mockFetch((path, body) => {
		sentBody = body;
		assert.equal(path, '/api/chest');
		return { status: 200, body: reward };
	});
	try {
		assert.equal(api().collectChest(CASTLE_X + 1, CASTLE_Y), true);
		assert.equal(api().activeChests, 0, 'the chest leaves the map at once');
		assert.equal(api().collectChest(CASTLE_X + 1, CASTLE_Y), false, 'a second click on the empty tile does nothing');
		await flush();
		assert.equal(api().resources.gold, before + 777);
		assert.equal(api().gems, 1012);
		assert.equal(api().lastChestLoot?.gems, 12);
		assert.deepEqual(Object.keys(sentBody), ['key'], 'the request names no amount and no chest');
	} finally {
		restore();
	}
});

test('a chest the server does not know crumbles and pays nothing', async () => {
	freshGame();
	growTo(30);
	api().setServerSpawns(true);
	patchTileAt(CASTLE_X + 1, CASTLE_Y, { hasChest: true });
	const before = api().resources.gold;
	mockFetch(() => ({ status: 200, body: { ok: false, reason: 'no_ticket', tickets, serverNowSec: 1, gemsTotal: 1000 } satisfies ChestReward }));
	try {
		api().collectChest(CASTLE_X + 1, CASTLE_Y);
		await flush();
		assert.equal(api().resources.gold, before);
		assert.equal(api().lastChestLoot, null);
	} finally {
		restore();
	}
});

test('when the server cannot be reached the chest is put back, nothing is lost', async () => {
	freshGame();
	growTo(30);
	api().setServerSpawns(true);
	patchTileAt(CASTLE_X + 1, CASTLE_Y, { hasChest: true });
	const before = api().resources.gold;
	mockFetch(() => ({ status: 503, body: {} }));
	try {
		api().collectChest(CASTLE_X + 1, CASTLE_Y);
		await flush();
		assert.equal(api().resources.gold, before);
		assert.equal(api().tiles.stats.chests, 1, 'the chest is back on its tile');
	} finally {
		restore();
	}
});

// ---------------------------------------------------------------------------------------------------- killing on the server

test('a kill is paid with what the server rolled, and the monster leaves the map', async () => {
	freshGame();
	growTo(30);
	setResources({ gold: 0 });
	api().setServerSpawns(true);
	const placed = api().applyServerTickets({ tickets: { chests: 0, rats: [{ n: 4, at: 0, lucky: true }], king: null }, serverNowSec: 0, gemsTotal: 1000, nextInSec: null });
	assert.equal(placed.monsters, 1);
	const monster = api().monsters[0];
	assert.equal(monster.ticket, 4);
	assert.equal(monster.lucky, true);

	const reward: KillReward = { ok: true, dismissed: false, level: monster.level, lucky: true, gold: 5000, xp: 90, items: [], pity: { 'p:t': 2 }, tickets, serverNowSec: 1, gemsTotal: 1000 };
	let sent: Record<string, unknown> = {};
	mockFetch((path, body) => {
		sent = body;
		assert.equal(path, '/api/kill');
		return { status: 200, body: reward };
	});
	try {
		assert.equal(api().startFight(monster.id), true);
		let guard = 0;
		let eventId = 1;
		while (api().fight?.phase === 'active' && guard++ < 5000) api().hitMonster({ eventId: eventId++, now: eventId * 1000, trusted: true });
		assert.equal(api().fight?.phase, 'won');
		assert.equal(api().fight?.summary, null, 'nothing is paid before the server answers');
		assert.equal(api().monsters.length, 1, 'the monster stays until then');
		await flush();
		assert.equal(api().monsters.length, 0);
		assert.equal(api().resources.gold, 5000);
		assert.equal(api().fight?.summary?.lucky, true);
		assert.deepEqual(api().lootPity, { 'p:t': 2 });
		assert.equal(sent.n, 4);
		assert.equal(sent.level, monster.level);
		assert.equal('gold' in sent, false, 'the request names no reward');
	} finally {
		restore();
	}
});

test('a monster without a ticket pays nothing and is gone', async () => {
	freshGame();
	growTo(30);
	api().setServerSpawns(true);
	setResources({ gold: 0 });
	api().applyServerTickets({ tickets: { chests: 0, rats: [{ n: 1, at: 0, lucky: false }], king: null }, serverNowSec: 0, gemsTotal: 1000, nextInSec: null });
	const monster = api().monsters[0];
	// the server forgets the ticket (spent elsewhere): the answer is "no ticket"
	mockFetch(() => ({ status: 200, body: { ok: false, reason: 'no_ticket', tickets, serverNowSec: 1, gemsTotal: 1000 } satisfies KillReward }));
	try {
		api().startFight(monster.id);
		let guard = 0;
		let eventId = 1;
		while (api().fight?.phase === 'active' && guard++ < 5000) api().hitMonster({ eventId: eventId++, now: eventId * 1000, trusted: true });
		await flush();
		assert.equal(api().resources.gold, 0);
		assert.equal(api().monsters.length, 0);
	} finally {
		restore();
	}
});

test('dismissing a monster tells the server so the ticket does not bring it back', async () => {
	freshGame();
	growTo(30);
	api().setServerSpawns(true);
	api().applyServerTickets({ tickets: { chests: 0, rats: [{ n: 3, at: 0, lucky: false }], king: null }, serverNowSec: 0, gemsTotal: 1000, nextInSec: null });
	const monster = api().monsters[0];
	let sent: Record<string, unknown> = {};
	mockFetch((_path, body) => {
		sent = body;
		return { status: 200, body: { ok: true, dismissed: true, tickets, serverNowSec: 1, gemsTotal: 1000 } satisfies KillReward };
	});
	try {
		assert.equal(api().dismissMonster(monster.id), true);
		await flush();
		assert.equal(sent.dismiss, true);
		assert.equal(sent.n, 3);
	} finally {
		restore();
	}
});

// ---------------------------------------------------------------------------------------------------- Luck in the loot

test('Luck raises the chance of gear from a monster and moves the odds toward rare', () => {
	const count = (luck: number) => {
		let gear = 0;
		let rare = 0;
		for (let seed = 1; seed <= 4000; seed++) {
			const result = generateLoot({ sourceId: 'rat', level: 6, luck }, mulberry32(seed));
			for (const drop of result.drops) {
				if (drop.kind !== 'gear') continue;
				gear++;
				if (['rare', 'epic', 'legendary'].includes(drop.item.rarity)) rare++;
			}
		}
		return { gear, rare };
	};
	const none = count(0);
	const lucky = count(120);
	assert.ok(lucky.gear > none.gear, `${lucky.gear} > ${none.gear}`);
	assert.ok(lucky.rare / lucky.gear > none.rare / none.gear, 'a bigger share of what drops is rare or better');
});

test('Luck 0 leaves the loot exactly as it was', () => {
	for (let seed = 1; seed <= 200; seed++) {
		assert.deepEqual(generateLoot({ sourceId: 'rat', level: 5 }, mulberry32(seed)), generateLoot({ sourceId: 'rat', level: 5, luck: 0 }, mulberry32(seed)));
	}
});

test('a lucky monster pays three times the gold and XP and adds a gear roll', () => {
	const ctx = { goldPerSec: 10, xpPerSec: 2, luck: 0 };
	const plain = rollKillLoot({ type: 'rat', level: 3 }, ctx, mulberry32(5));
	const lucky = rollKillLoot({ type: 'rat', level: 3 }, { ...ctx, lucky: true }, mulberry32(5));
	assert.equal(lucky.gold, plain.gold * 3);
	assert.equal(lucky.xp, plain.xp * 3);
	let more = 0;
	for (let seed = 1; seed <= 300; seed++) {
		const a = rollKillLoot({ type: 'rat', level: 3 }, ctx, mulberry32(seed)).items.filter((d) => d.kind === 'gear').length;
		const b = rollKillLoot({ type: 'rat', level: 3 }, { ...ctx, lucky: true }, mulberry32(seed)).items.filter((d) => d.kind === 'gear').length;
		assert.ok(b >= a + 1, 'always at least one more piece');
		more += b - a;
	}
	assert.ok(more >= 300);
});

// ---------------------------------------------------------------------------------------------------- danger scaling

test('monsters spawn a level higher for every 8 tiles from the castle, never above the cap', () => {
	assert.equal(dangerBonus(0), 0);
	assert.equal(dangerBonus(7), 0);
	assert.equal(dangerBonus(8), 1);
	assert.equal(dangerBonus(33), 4);
	assert.equal(dangerBonus(NaN), 0);
	const near = rollSpawnLevel('rat', 1, 11, 0);
	const far = rollSpawnLevel('rat', 1, 11, 24);
	assert.equal(far, Math.min(MONSTERS.rat.spawnWindow.cap, near + 3), 'the same id rolls the same offset into a window three levels higher');
	assert.equal(rollSpawnLevel('rat', 10, 11, 10_000), MONSTERS.rat.spawnWindow.cap);
	const spot = { x: CASTLE_X + 16, y: CASTLE_Y };
	assert.equal(castleDistance(spot), 16);
	assert.equal(newMonster('rat', 5, spot, 1).spawnLevel, rollSpawnLevel('rat', 1, 5, 16));
	assert.ok(spawnLevelRange('rat', 1).min <= newMonster('rat', 5, spot, 1).spawnLevel);
});

test('the highest level the server will pay for grows with the land but stays under the cap', () => {
	assert.ok(maxSpawnLevel('rat', 1, 400) > maxSpawnLevel('rat', 1, 20));
	assert.ok(maxSpawnLevel('rat', 10, 1e9) <= MONSTERS.rat.spawnWindow.cap);
	assert.ok(COMBAT.spawn.dangerStep > 0);
});
