import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, setResources } from './helpers';
import { CASTLE_X, CASTLE_Y } from '../src/config/gameConfig';
import { COMBAT } from '../src/config/combatConfig';
import { ownedRowMajor } from '../src/utils/world';
import { reconcileTickets } from '../src/lib/offline/reconcile';
import { sanitizeSave } from '../src/lib/sanitizeSave';
import { computeOfflineGrant, zeroGrant } from '../src/lib/offline/grant';
import type { ClaimResult, PublicTickets } from '../src/lib/offline/types';
import { rawSnapshot } from './helpers';
import { castleUpgradeDuration } from '../src/utils/gameUtils';
import { tileAt } from './helpers';
import type { Monster } from '../src/types/game';

const NOW = 1_800_000_000;
const tickets = (over: Partial<PublicTickets> = {}): PublicTickets => ({ chests: [], rats: [], king: null, ...over });
const state = () => {
	const s = api();
	return { tiles: s.tiles, monsters: s.monsters, activeChests: s.activeChests };
};
/** `n` chests the server has put on owned tiles (not the castle): they are listed with the tile they stand on. */
const chestList = (n: number) =>
	ownedRowMajor(api().tiles)
		.filter(({ tile }) => tile.biome !== 'castle')
		.slice(0, n)
		.map(({ x, y }, i) => ({ n: 100 + i, x, y }));
/** A monster ticket the server has placed: its tile and the level it appeared at come from the server. */
const placed = (n: number, at: number, over: { lucky?: boolean; x?: number; y?: number; spawnLevel?: number } = {}) => ({ n, at, lucky: false, x: CASTLE_X + 2, y: CASTLE_Y, spawnLevel: 1, ...over });

test('placed tickets become monsters exactly where the server put them, aged as the server says', () => {
	freshGame();
	growTo(30);
	const out = reconcileTickets(
		state(),
		tickets({ rats: [placed(1, NOW - 3600, { x: CASTLE_X + 2, y: CASTLE_Y, spawnLevel: 2 }), placed(2, NOW - 100, { lucky: true, x: CASTLE_X, y: CASTLE_Y + 3, spawnLevel: 1 })] }),
		NOW);
	assert.equal(out.monsters.length, 2);
	assert.deepEqual(out.monsters.map((m) => [m.id, m.ticket, m.x, m.y]), [[1, 1, CASTLE_X + 2, CASTLE_Y], [2, 2, CASTLE_X, CASTLE_Y + 3]]);
	assert.equal(out.monsters[0].ageSec, 3600);
	assert.equal(out.monsters[0].level, out.monsters[0].spawnLevel + 2, 'an hour old: two growth intervals');
	assert.equal(out.monsters[1].lucky, true);
	assert.equal(out.monsters[0].lucky, undefined);
	assert.equal(out.placed.monsters, 2);
	assert.equal(out.placed.strongestLevel, Math.max(...out.monsters.map((m) => m.level)));
});

test('the King ticket becomes the King', () => {
	freshGame();
	growTo(30);
	const out = reconcileTickets(state(), tickets({ king: { n: 5, at: NOW - 10, x: CASTLE_X + 3, y: CASTLE_Y, spawnLevel: 15 } }), NOW);
	assert.equal(out.monsters[0].type, 'ratKing');
	assert.equal(out.monsters[0].ticket, 5);
	assert.equal(out.monsters[0].level, 15);
});

test('a monster the server does not list is removed, one it lists stays; nothing is placed twice', () => {
	freshGame();
	growTo(30);
	const standing: Monster[] = [
		{ id: 4, type: 'rat', level: 1, spawnLevel: 1, x: CASTLE_X + 2, y: CASTLE_Y, ageSec: 0, ticket: 4 },
		{ id: 5, type: 'rat', level: 1, spawnLevel: 1, x: CASTLE_X - 2, y: CASTLE_Y, ageSec: 0, ticket: 5 },
	];
	const out = reconcileTickets({ ...state(), monsters: standing }, tickets({ rats: [placed(4, NOW, { x: CASTLE_X + 2 })] }), NOW);
	assert.deepEqual(out.monsters.map((m) => m.id), [4]);
	assert.equal(out.removed.monsters, 1);
	assert.equal(out.placed.monsters, 0);
});

test('chests stand on the tiles the server lists: missing ones are put on, extra ones taken off', () => {
	freshGame();
	growTo(30);
	const three = chestList(3);
	const put = reconcileTickets(state(), tickets({ chests: three }), NOW);
	assert.equal(put.activeChests, 3);
	assert.equal(put.tiles.stats.chests, 3);
	assert.equal(put.placed.chests, 3);
	for (const { x, y } of three) assert.equal(tileAt(put.tiles, x, y).hasChest, true);
	const trimmed = reconcileTickets({ ...state(), tiles: put.tiles, activeChests: 3 }, tickets({ chests: three.slice(0, 1) }), NOW);
	assert.equal(trimmed.activeChests, 1);
	assert.equal(trimmed.tiles.stats.chests, 1);
	assert.equal(trimmed.removed.chests, 2);
	assert.equal(tileAt(trimmed.tiles, three[0].x, three[0].y).hasChest, true);
});

test('a chest the server moved is taken off its old tile and drawn on the new one; an answer that may be old puts no chest back', () => {
	freshGame();
	growTo(30);
	const [a, b] = chestList(2);
	const first = reconcileTickets(state(), tickets({ chests: [a] }), NOW);
	const moved = reconcileTickets({ ...state(), tiles: first.tiles, activeChests: first.activeChests }, tickets({ chests: [{ ...a, x: b.x, y: b.y }] }), NOW);
	assert.ok(!tileAt(moved.tiles, a.x, a.y).hasChest);
	assert.equal(tileAt(moved.tiles, b.x, b.y).hasChest, true);
	assert.equal(moved.activeChests, 1);
	const held = reconcileTickets(state(), tickets({ chests: [a] }), NOW, {}, { placeChests: false });
	assert.equal(held.activeChests, 0, 'the player may just have opened it');
});

// ---------------------------------------------------------------------------------------------------- the store action

const claimResult = (over: Partial<ClaimResult> = {}): ClaimResult => ({ grant: null, reason: 'short', tickets: tickets(), serverNowSec: NOW, gems: 1000, ...over });

test('applyOfflineClaim pays the grant, places the tickets, takes the server gem balance and leaves a valid save', () => {
	freshGame();
	growTo(30);
	api().tick(1000);
	setResources({ gold: 100 });
	const before = api();
	const grant = computeOfflineGrant({ rates: { ...zeroGrant(), gold: 7, xp: 2 }, ratesAfterCastle: null, castleUpgrade: null, xpGainPct: 0, gapSec: 4 * 3600, capSec: 8 * 3600, efficiency: 0.5, minGapSec: 300 })!;
	const report = api().applyOfflineClaim(
		claimResult({ grant, reason: 'paid', gems: 1037, tickets: tickets({ chests: chestList(2), rats: [placed(1, NOW - 3 * 3600, { spawnLevel: 2 })] }) })
	);
	const after = api();
	assert.equal(after.resources.gold, before.resources.gold + 7 * 4 * 3600 * 0.5);
	assert.equal(after.gems, 1037, 'the balance is the server');
	assert.equal(after.activeChests, 2);
	assert.equal(after.monsters.length, 1);
	assert.ok(after.monsters[0].level >= after.monsters[0].spawnLevel + 6);
	assert.equal(report?.chestsPlaced, 2);
	assert.equal(report?.monstersPlaced, 1);
	assert.equal(report?.grant, grant);
	const saved = sanitizeSave(rawSnapshot());
	assert.equal(saved.ok, true, saved.ok ? '' : saved.reason);
});

test('applyOfflineClaim with nothing due still brings the map and gems in line, and reports nothing', () => {
	freshGame();
	growTo(30);
	const report = api().applyOfflineClaim(claimResult({ gems: 1200, tickets: tickets({ chests: chestList(1) }) }));
	assert.equal(report, null);
	assert.equal(api().gems, 1200);
	assert.equal(api().activeChests, 1);
});

test('a castle upgrade started before closing the game is finished by a long absence, and the rates follow', () => {
	freshGame();
	growTo(30);
	api().tick(1000);
	const cost = tileAt(api().tiles, CASTLE_X, CASTLE_Y).upgradeCost!;
	setResources({ ...(cost as Record<string, number>) });
	assert.equal(api().upgradeCastle(), true);
	const upgrade = api().castleUpgrade!;
	const grant = computeOfflineGrant({
		rates: api().resourceRates.total,
		ratesAfterCastle: api().resourceRates.total,
		castleUpgrade: upgrade,
		xpGainPct: 0,
		gapSec: castleUpgradeDuration(1) + 100,
		capSec: 8 * 3600,
		efficiency: 0.5,
		minGapSec: 300,
	})!;
	const report = api().applyOfflineClaim(claimResult({ grant, reason: 'paid' }));
	assert.equal(api().castleUpgrade, null);
	assert.equal(tileAt(api().tiles, CASTLE_X, CASTLE_Y).level, 2);
	assert.equal(report?.castleReached, 2);
	assert.ok(api().monsters.length === 0 || api().monsters.every((m) => m.level >= 1));
	assert.ok(COMBAT.spawn.firstSec > 0);
});
