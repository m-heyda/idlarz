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
	return { tiles: s.tiles, monsters: s.monsters, activeChests: s.activeChests };
};
/** A monster ticket the server has placed: its tile and the level it appeared at come from the server. */
const placed = (n: number, at: number, over: { lucky?: boolean; x?: number; y?: number; spawnLevel?: number } = {}) => ({ n, at, lucky: false, x: CASTLE_X + 2, y: CASTLE_Y, spawnLevel: 1, ...over });

test('placed tickets become monsters exactly where the server put them, aged as the server says', () => {
	freshGame();
	growTo(30);
	const out = reconcileTickets(
		state(),
		tickets({ rats: [placed(1, NOW - 3600, { x: CASTLE_X + 2, y: CASTLE_Y, spawnLevel: 2 }), placed(2, NOW - 100, { lucky: true, x: CASTLE_X, y: CASTLE_Y + 3, spawnLevel: 1 })] }),
		NOW,
		mulberry32(3)
	);
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
	const out = reconcileTickets(state(), tickets({ king: { n: 5, at: NOW - 10, x: CASTLE_X + 3, y: CASTLE_Y, spawnLevel: 15 } }), NOW, mulberry32(1));
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
	const out = reconcileTickets({ ...state(), monsters: standing }, tickets({ rats: [placed(4, NOW, { x: CASTLE_X + 2 })] }), NOW, mulberry32(1));
	assert.deepEqual(out.monsters.map((m) => m.id), [4]);
	assert.equal(out.removed.monsters, 1);
	assert.equal(out.placed.monsters, 0);
});

test('chests match the server count: missing ones are placed, extra ones taken off', () => {
	freshGame();
	growTo(30);
	const put = reconcileTickets(state(), tickets({ chests: 3 }), NOW, mulberry32(2));
	assert.equal(put.activeChests, 3);
	assert.equal(put.tiles.stats.chests, 3);
	assert.equal(put.placed.chests, 3);
	const trimmed = reconcileTickets({ ...state(), tiles: put.tiles, activeChests: 3 }, tickets({ chests: 1 }), NOW, mulberry32(2));
	assert.equal(trimmed.activeChests, 1);
	assert.equal(trimmed.tiles.stats.chests, 1);
	assert.equal(trimmed.removed.chests, 2);
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
		claimResult({ grant, reason: 'paid', gems: 1037, tickets: tickets({ chests: 2, rats: [placed(1, NOW - 3 * 3600, { spawnLevel: 2 })] }) })
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
