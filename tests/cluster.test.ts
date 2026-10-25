import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import './helpers';
import { BIOMES } from '../src/config/gameConfig';
import { BIOME_COLORS, HIGHLIGHT_COLORS, MIST_COLOR, YARD_COLOR, biomeColor, highlightColor } from '../src/config/biomePalette';
import { HIGHLIGHT_MS, useUiStore } from '../src/stores/uiStore';
import { connectedCluster } from '../src/utils/cluster';
import { getTile, keyX, keyY, ownedBounds, ownedEntries, tileKey, worldFromRows } from '../src/utils/world';
import { syntheticWorld } from '../src/utils/worldGen';
import type { BiomeType, Tile } from '../src/types/game';

// "Highlight" tints the connected area of a biome around the clicked tile, not every tile of that biome on the map.

const NAMES: Record<string, BiomeType> = { F: 'forest', P: 'plains', C: 'castle', L: 'lake' };
const rows = (lines: string[]): Tile[][] =>
	lines.map((l) => [...l].map((c): Tile => (NAMES[c] ? { biome: NAMES[c], isOwned: true } : { biome: 'empty', isOwned: false })));
const labelOf = (cells: ReadonlySet<number>) => [...cells].map((k) => `${keyX(k)},${keyY(k)}`).sort();

const NEIGHBOURS = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1],
];

test('the cluster is exactly the connected same-biome area: maximal and nothing else (random maps)', () => {
	for (const seed of [1, 2, 3, 4]) {
		const world = syntheticWorld(1500, seed);
		let checked = 0;
		for (const { x, y, tile } of ownedEntries(world).filter((_, i) => i % 97 === 0)) {
			const cells = connectedCluster(world, x, y);
			if (tile.biome === 'castle') {
				assert.equal(cells.size, 0);
				continue;
			}
			assert.ok(cells.has(tileKey(x, y)), 'the clicked tile is in it');
			for (const key of cells) {
				const t = getTile(world, keyX(key), keyY(key));
				assert.equal(t?.biome, tile.biome, 'only that biome');
				for (const [dx, dy] of NEIGHBOURS) {
					const n = getTile(world, keyX(key) + dx, keyY(key) + dy);
					if (n && n.biome === tile.biome) assert.ok(cells.has(tileKey(keyX(key) + dx, keyY(key) + dy)), 'maximal: no same-biome neighbour is left out');
				}
			}
			checked++;
		}
		assert.ok(checked > 5);
	}
});

test('a biome that appears in two separate places is two areas', () => {
	const w = worldFromRows(rows(['FF.FF', 'FF.FF', '..C..', 'PPPPP']));
	assert.deepEqual(labelOf(connectedCluster(w, 0, 0)), ['0,0', '0,1', '1,0', '1,1']);
	assert.deepEqual(labelOf(connectedCluster(w, 4, 1)), ['3,0', '3,1', '4,0', '4,1']);
	assert.equal(connectedCluster(w, 0, 3).size, 5, 'the plains row is one area');
});

test('a big area is found quickly and without recursion limits', () => {
	const lines = Array.from({ length: 300 }, () => 'P'.repeat(300));
	const w = worldFromRows(rows(lines));
	const t0 = performance.now();
	const cells = connectedCluster(w, 150, 150);
	const ms = performance.now() - t0;
	assert.equal(cells.size, 90_000);
	assert.ok(ms < 400, `${ms.toFixed(0)} ms`);
	assert.deepEqual(ownedBounds(w), { minX: 0, maxX: 299, minY: 0, maxY: 299 });
});

test('the highlight store: the area of the clicked tile, replaced by the next click, gone after the time', () => {
	mock.timers.enable({ apis: ['setTimeout'] });
	try {
		const w = worldFromRows(rows(['FF.PP', 'FF.PP', '..C..']));
		const ui = useUiStore.getState();
		ui.flashCluster(w, 0, 0);
		assert.equal(useUiStore.getState().highlight?.biome, 'forest');
		assert.deepEqual(labelOf(useUiStore.getState().highlight!.cells), ['0,0', '0,1', '1,0', '1,1']);
		mock.timers.tick(HIGHLIGHT_MS - 100);
		assert.ok(useUiStore.getState().highlight, 'still tinted just before the end');
		ui.flashCluster(w, 3, 0); // a second click restarts it on the other area
		mock.timers.tick(HIGHLIGHT_MS - 100);
		assert.equal(useUiStore.getState().highlight?.biome, 'plains', 'the first timer did not clear the second highlight');
		mock.timers.tick(200);
		assert.equal(useUiStore.getState().highlight, null);
		ui.flashCluster(w, 2, 2); // the castle has no area
		assert.equal(useUiStore.getState().highlight, null);
		ui.flashCluster(w, 40, 40); // nothing explored
		assert.equal(useUiStore.getState().highlight, null);
	} finally {
		mock.timers.reset();
	}
});

// ---- colours -------------------------------------------------------------------------------------------------------------

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const dist = (a: string, b: string) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));

test('every biome has its own map colour and a highlight tint that stands out from it', () => {
	const biomes = Object.keys(BIOMES).filter((b) => b !== 'empty');
	for (const b of biomes) {
		assert.match(biomeColor(b), /^#[0-9a-f]{6}$/i, `${b} map colour`);
		assert.equal(BIOMES[b].baseColor, BIOME_COLORS[b], `${b}: the biome table uses the palette`);
	}
	const map = biomes.map(biomeColor);
	assert.equal(new Set(map).size, map.length, 'no two biomes share a map colour');
	for (const c of [MIST_COLOR, YARD_COLOR]) assert.ok(!map.includes(c));

	const tinted = biomes.filter((b) => b !== 'castle');
	for (const b of tinted) {
		assert.match(HIGHLIGHT_COLORS[b], /^#[0-9a-f]{6}$/i, `${b} highlight`);
		assert.ok(dist(highlightColor(b), biomeColor(b)) > 110, `${b}: the tint differs from the ground (${dist(highlightColor(b), biomeColor(b)).toFixed(0)})`);
		const channels = rgb(highlightColor(b));
		assert.ok(Math.max(...channels) - Math.min(...channels) >= 120, `${b}: the tint is a saturated colour`);
	}
	const tints = tinted.map(highlightColor);
	assert.equal(new Set(tints).size, tints.length, 'each biome has its own tint');
	assert.equal(highlightColor('nonsense'), '#ffffff');
});
