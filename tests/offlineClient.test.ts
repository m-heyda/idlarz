import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, setResources } from './helpers';
import { CASTLE_X, CASTLE_Y } from '../src/config/gameConfig';
import { COMBAT } from '../src/config/combatConfig';
import { mulberry32 } from '../src/lib/rng';
import { reconcileTickets } from '../src/lib/offline/reconcile';
import { sanitizeSave } from '../src/lib/sanitizeSave';
import { computeOfflineGrant, zeroGrant } from '../src/lib/offline/grant';
import type { ClaimResult, PublicTickets } from '../src/lib/offline/types';
import { rawSnapshot } from './helpers';
import { castleUpgradeDuration } from '../src/utils/gameUtils';
import { tileAt } from './helpers';
import type { Monster } from '../src/types/game';

const NOW = 1_800_000_000;
const tickets = (over: Partial<PublicTickets> = {}): PublicTickets => ({ chests: 0, rats: [], king: null, ...over });
const state = () => {
	const s = api();
	return { tiles: s.tiles, monsters: s.monsters, activeChests: s.activeChests, nextMonsterId: s.nextMonsterId, fightingId: null as number | null };
};
const rat = (id: number, over: Partial<Monster> = {}): Monster => ({ id, type: 'rat', level: 1, spawnLevel: 1, x: CASTLE_X + 1, y: CASTLE_Y, ageSec: 0, ...over });

test('tickets without monsters become monsters on free tiles, aged as the server says', () => {
	freshGame();
	growTo(30);
	const out = reconcileTickets(state(), tickets({ rats: [{ n: 1, at: NOW - 3600, lucky: false }, { n: 2, at: NOW - 100, lucky: true }] }), NOW, mulberry32(3));
	assert.equal(out.monsters.length, 2);
	assert.deepEqual(out.monsters.map((m) => m.ticket), [1, 2]);
	assert.equal(out.monsters[0].ageSec, 3600);
	assert.ok(out.monsters[0].level >= out.monsters[0].spawnLevel + 2, 'an hour old: two growth intervals');
	assert.equal(out.monsters[1].lucky, true);
	assert.equal(out.monsters[0].lucky, undefined);
	assert.equal(out.placed.monsters, 2);
	assert.equal(out.placed.strongestLevel, Math.max(...out.monsters.map((m) => m.level)));
	assert.equal(new Set(out.monsters.map((m) => `${m.x},${m.y}`)).size, 2, 'one monster per tile');
	assert.equal(out.nextMonsterId, state().nextMonsterId + 2);
});

test('the King ticket becomes the King', () => {
	freshGame();
	growTo(30);
	const out = reconcileTickets(state(), tickets({ king: { n: 5, at: NOW - 10 } }), NOW, mulberry32(1));
	assert.equal(out.monsters[0].type, 'ratKing');
	assert.equal(out.monsters[0].ticket, 5);
});

test('a monster without a ticket number takes the oldest ticket of its kind; one without any ticket to take is removed', () => {
	freshGame();
	growTo(30);
	const base = { ...state(), monsters: [rat(1), rat(2, { x: CASTLE_X - 1 }), rat(3, { y: CASTLE_Y + 1 })], nextMonsterId: 4 };
	const out = reconcileTickets(base, tickets({ rats: [{ n: 7, at: NOW, lucky: true }, { n: 9, at: NOW, lucky: false }] }), NOW, mulberry32(1));
	assert.deepEqual(out.monsters.map((m) => [m.id, m.ticket]), [[1, 7], [2, 9]]);
	assert.equal(out.monsters[0].lucky, true);
	assert.equal(out.removed.monsters, 1, 'a monster the server never made is not kept');
	assert.equal(out.placed.monsters, 0);
});

test('a monster whose ticket was spent is removed, except the one being fought', () => {
	freshGame();
	growTo(30);
	const base = { ...state(), monsters: [rat(1, { ticket: 4 }), rat(2, { ticket: 5, x: CASTLE_X - 1 })], nextMonsterId: 3 };
	const out = reconcileTickets({ ...base, fightingId: 1 }, tickets({ rats: [] }), NOW, mulberry32(1));
	assert.deepEqual(out.monsters.map((m) => m.id), [1], 'the fight goes on');
	assert.equal(out.removed.monsters, 1);
});

test('chests match the server count: missing ones are placed, extra ones taken off', () => {
	freshGame();
	growTo(30);
	const placed = reconcileTickets(state(), tickets({ chests: 3 }), NOW, mulberry32(2));
	assert.equal(placed.activeChests, 3);
	assert.equal(placed.tiles.stats.chests, 3);
	assert.equal(placed.placed.chests, 3);
	const trimmed = reconcileTickets({ ...state(), tiles: placed.tiles, activeChests: 3 }, tickets({ chests: 1 }), NOW, mulberry32(2));
	assert.equal(trimmed.activeChests, 1);
	assert.equal(trimmed.tiles.stats.chests, 1);
	assert.equal(trimmed.removed.chests, 2);
});

test('with no room the ticket keeps waiting instead of failing', () => {
	freshGame(); // just the castle: nowhere to stand
	const out = reconcileTickets(state(), tickets({ rats: [{ n: 1, at: NOW, lucky: false }] }), NOW, mulberry32(1));
	assert.equal(out.monsters.length, 0);
	assert.equal(out.placed.monsters, 0);
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
		claimResult({ grant, reason: 'paid', gems: 1037, tickets: tickets({ chests: 2, rats: [{ n: 1, at: NOW - 3 * 3600, lucky: false }] }) })
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
	const report = api().applyOfflineClaim(claimResult({ gems: 1200, tickets: tickets({ chests: 1 }) }));
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
