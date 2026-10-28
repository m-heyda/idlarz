import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, patchTileAt } from './helpers';
import { CASTLE_X, CASTLE_Y } from '../src/config/gameConfig';
import { MONSTERS } from '../src/config/combatConfig';
import { castleDistance, dangerBonus, rollSpawnLevel, spawnLevelRange } from '../src/lib/monsters';
import { generateLoot } from '../src/lib/loot/generate';
import { rollKillLoot } from '../src/lib/loot';
import { mulberry32 } from '../src/lib/rng';
import type { ChestReward } from '../src/lib/offline/types';

// Spawns and chests are the server's: the browser puts what the server lists on the map, opens a chest by asking, and rolls nothing.

const realFetch = globalThis.fetch;
const mockFetch = (handler: (path: string, body: Record<string, unknown>) => { status: number; body: unknown }) => {
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const out = handler(String(input), JSON.parse(String(init?.body ?? '{}')));
		return new Response(JSON.stringify(out.body), { status: out.status, headers: { 'Content-Type': 'application/json' } });
	}) as typeof fetch;
};
const restore = () => {
	globalThis.fetch = realFetch;
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 20));
const tickets = { chests: 0, rats: [], king: null };

// ---------------------------------------------------------------------------------------------------- opening a chest on the server

test('a chest opens through the server: the reward is the server\'s, the gems are its balance', async () => {
	freshGame();
	growTo(30);
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

// ---------------------------------------------------------------------------------------------------- the monsters on the map

test('the monsters on the map are the server list, where the server put them', () => {
	freshGame();
	growTo(30);
	const sync = {
		tickets: { chests: 0, rats: [{ n: 4, at: 1000 - 100, lucky: true, x: CASTLE_X + 3, y: CASTLE_Y, spawnLevel: 2 }], king: { n: 9, at: 1000, x: CASTLE_X, y: CASTLE_Y - 4, spawnLevel: 16 } },
		serverNowSec: 1000,
		gemsTotal: 1100,
		nextInSec: 30,
		combat: { hp: 90, mp: 30, maxHp: 101, maxMp: 40, cd: { heal: 0, stun: 0, potion: 0 }, fight: null, autoBattle: true, autoUse: true, retrySec: 0, at: 1, eventNo: 0, events: [], behind: false, nextPollSec: 8 },
	};
	const placed = api().applyServerTickets(sync);
	assert.equal(placed.monsters, 2);
	assert.deepEqual(api().monsters.map((m) => [m.id, m.type, m.x, m.y, m.level, m.ticket]), [[4, 'rat', CASTLE_X + 3, CASTLE_Y, 2, 4], [9, 'ratKing', CASTLE_X, CASTLE_Y - 4, 16, 9]]);
	assert.equal(api().monsters[0].lucky, true);
	assert.equal(api().gems, 1100);
	// the next answer lists only the King: the rat is gone from the map
	api().applyServerTickets({ ...sync, tickets: { ...sync.tickets, rats: [] }, combat: { ...sync.combat, at: 2 } });
	assert.deepEqual(api().monsters.map((m) => m.id), [9]);
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
	assert.equal(castleDistance({ x: CASTLE_X + 16, y: CASTLE_Y }), 16);
	assert.ok(spawnLevelRange('rat', 1).min <= rollSpawnLevel('rat', 1, 5, 16));
});
