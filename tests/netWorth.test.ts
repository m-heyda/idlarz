import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, store } from './helpers';
import { hasOwnedNeighbour, isOwnedAt, ownedBounds } from '../src/utils/world';
import { CASTLE_X, CASTLE_Y, LEGACY_GRID_SIZE } from '../src/config/gameConfig';
import { pickPersisted, type PersistedGame } from '../src/lib/sanitizeSave';
import { checkNetWorth, minimumSpend } from '../src/lib/cloudSave/netWorth';
import { summarize } from '../src/lib/cloudSave/summary';
import type { World } from '../src/utils/world';

const nextFrontier = (tiles: World): [number, number] | null => {
	const b = ownedBounds(tiles);
	if (!b) return null;
	let target: [number, number] | null = null;
	let best = Infinity;
	for (let y = Math.max(0, b.minY - 1); y <= Math.min(LEGACY_GRID_SIZE - 1, b.maxY + 1); y++) {
		for (let x = Math.max(0, b.minX - 1); x <= Math.min(LEGACY_GRID_SIZE - 1, b.maxX + 1); x++) {
			if (isOwnedAt(tiles, x, y) || !hasOwnedNeighbour(tiles, x, y)) continue;
			const d = Math.abs(x - CASTLE_X) + Math.abs(y - CASTLE_Y);
			if (d < best) {
				best = d;
				target = [x, y];
			}
		}
	}
	return target;
};

/** An honest game: a real new game, real ticks, every tile bought with the gold the game paid out (no free resources). */
const honestGame = (hours: number): PersistedGame => {
	api().resetGame();
	const stepMs = 30_000;
	for (let t = 0; t < (hours * 3600 * 1000) / stepMs; t++) {
		api().tick(stepMs);
		for (let buys = 0; buys < 5; buys++) {
			const target = nextFrontier(api().tiles);
			if (!target || !api().buyTile(target[0], target[1])) break;
		}
	}
	return structuredClone(pickPersisted(api()));
};

test('an honest game that spends everything on land stays far below the limit at every stage', () => {
	for (const hours of [0.25, 1, 4, 12, 24]) {
		const state = honestGame(hours);
		const check = checkNetWorth(state, summarize(state));
		console.log(`  honest ${hours} h: tiles ${summarize(state).tilesOwned}, ratio ${check.ratio.toFixed(3)}`);
		assert.ok(check.ratio < 0.5, `${hours} h: ratio ${check.ratio.toFixed(3)} (tiles ${summarize(state).tilesOwned})`);
	}
});

test('forged land is far over the limit however the rates look', () => {
	api().resetGame();
	growTo(3000); // the helper hands out the gold: like a console edit or an edited import
	store.setState({ playSeconds: 700 } as never);
	const state = structuredClone(pickPersisted(api()));
	const check = checkNetWorth(state, summarize(state));
	assert.equal(check.exceeds, true, `ratio ${check.ratio}`);
	assert.ok(minimumSpend(state) > 1e9, `the land alone costs ${minimumSpend(state)}`);
});

test('a forged balance is over the limit too, a modest one is not', () => {
	api().resetGame();
	store.setState({ playSeconds: 600, resources: { ...api().resources, gold: 1e15 } } as never);
	const rich = structuredClone(pickPersisted(api()));
	assert.equal(checkNetWorth(rich, summarize(rich)).exceeds, true);
	store.setState({ resources: { ...api().resources, gold: 500 } } as never);
	const modest = structuredClone(pickPersisted(api()));
	assert.equal(checkNetWorth(modest, summarize(modest)).exceeds, false);
});
