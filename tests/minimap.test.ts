import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers';
import { BIOME_COLORS } from '../src/config/biomePalette';
import { CASTLE_X, CASTLE_Y } from '../src/config/gameConfig';
import { CASTLE_MARKER_COLOR, MINIMAP_MARGIN, MINIMAP_MAX_SCALE, WORKSHOP_COLOR, minimapLayout, minimapToTile, paintMinimap, tileToMinimap, viewRectangle } from '../src/lib/minimap';
import { createInitialWorld } from '../src/utils/gameUtils';
import { COORD_LIMIT, EMPTY_WORLD, ownedBounds, ownedEntries, setTile, worldFromRows } from '../src/utils/world';
import { syntheticWorld } from '../src/utils/worldGen';
import type { Tile } from '../src/types/game';

const BOX = { w: 176, h: 132 };
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const pixel = (data: Uint8ClampedArray, w: number, x: number, y: number) => [...data.slice((y * w + x) * 4, (y * w + x) * 4 + 3)];
const image = (l: ReturnType<typeof minimapLayout>) => new Uint8ClampedArray(l.width * l.height * 4);

test('layout: a small map is shown big (whole pixels per tile, capped), centred, with a margin around the land', () => {
	const l = minimapLayout({ minX: 24, maxX: 26, minY: 24, maxY: 26 }, BOX);
	assert.equal(l.scale, MINIMAP_MAX_SCALE);
	assert.equal(l.x0, 24 - MINIMAP_MARGIN);
	assert.equal(l.y0, 24 - MINIMAP_MARGIN);
	const tilesW = 3 + 2 * MINIMAP_MARGIN;
	assert.equal(l.offsetX, Math.floor((BOX.w - tilesW * l.scale) / 2));
	assert.ok(l.offsetX >= 0 && l.offsetY >= 0);
});

test('layout: a bigger map gets a smaller whole scale, a huge one a fraction; the land always fits the box', () => {
	let last = Infinity;
	for (const size of [20, 40, 80, 150, 400, 2000, 30_000]) {
		const l = minimapLayout({ minX: -size / 2, maxX: size / 2, minY: -size / 4, maxY: size / 4 }, BOX);
		assert.ok(l.scale > 0 && l.scale <= last, `scale falls with size ${size}`);
		last = l.scale;
		const tilesW = size + 1 + 2 * MINIMAP_MARGIN;
		assert.ok(tilesW * l.scale <= BOX.w + 1e-6, `${size}: ${tilesW * l.scale} px wide`);
		if (l.scale >= 1) assert.equal(l.scale, Math.floor(l.scale), 'whole pixels while they fit');
		assert.ok(l.offsetX >= 0 && l.offsetY >= 0);
	}
	assert.ok(last < 1, 'a 30,000 tile map needs a fraction of a pixel per tile');
	const edge = minimapLayout({ minX: -COORD_LIMIT, maxX: COORD_LIMIT, minY: -COORD_LIMIT, maxY: COORD_LIMIT }, BOX);
	assert.ok(edge.scale > 0 && Number.isFinite(edge.offsetX));
});

test('layout without land centres on the castle; tile <-> box maths are inverses', () => {
	const none = minimapLayout(null, BOX);
	assert.equal(none.x0, CASTLE_X - MINIMAP_MARGIN);
	const l = minimapLayout({ minX: -60, maxX: 110, minY: 3, maxY: 90 }, BOX);
	for (const [tx, ty] of [[-60, 3], [0, 0], [110, 90], [25.5, 25.5]]) {
		const p = tileToMinimap(l, tx, ty);
		const t = minimapToTile(l, p.x, p.y);
		assert.ok(Math.abs(t.x - tx) < 1e-9 && Math.abs(t.y - ty) < 1e-9);
	}
});

test('painting: every explored tile gets its biome colour, the rest stays background, negative coordinates included', () => {
	const w = worldFromRows([
		[{ biome: 'forest', isOwned: true }, { biome: 'lake', isOwned: true }] as Tile[],
		[{ biome: 'plains', isOwned: true }, { biome: 'empty', isOwned: false }] as Tile[],
	]);
	// shift the map into negative coordinates
	let neg = EMPTY_WORLD;
	for (const { x, y, tile } of ownedEntries(w)) neg = setTile(neg, x - 10, y - 20, tile);
	const l = minimapLayout(ownedBounds(neg), BOX);
	const data = image(l);
	paintMinimap(data, neg, l);
	const at = (tx: number, ty: number) => {
		const p = tileToMinimap(l, tx, ty);
		return pixel(data, l.width, Math.floor(p.x), Math.floor(p.y));
	};
	assert.deepEqual(at(-10, -20), rgb(BIOME_COLORS.forest));
	assert.deepEqual(at(-9, -20), rgb(BIOME_COLORS.lake));
	assert.deepEqual(at(-10, -19), rgb(BIOME_COLORS.plains));
	assert.notDeepEqual(at(-9, -19), rgb(BIOME_COLORS.plains), 'the unowned tile is background');
	assert.deepEqual(pixel(data, l.width, 0, 0), [10, 14, 28], 'the corner is background');
	// each tile is a square of `scale` pixels
	const p = tileToMinimap(l, -10, -20);
	for (let dy = 0; dy < l.scale; dy++) for (let dx = 0; dx < l.scale; dx++) assert.deepEqual(pixel(data, l.width, Math.floor(p.x) + dx, Math.floor(p.y) + dy), rgb(BIOME_COLORS.forest));
});

test('markers: the castle is gold and a workshop is purple with a dark outline, on top of the biome colour', () => {
	let w = createInitialWorld(() => 0.5);
	w = setTile(w, CASTLE_X + 1, CASTLE_Y, { biome: 'forest', isOwned: true, building: 'workshop' });
	const l = minimapLayout(ownedBounds(w), BOX);
	const data = image(l);
	paintMinimap(data, w, l);
	const centre = (tx: number, ty: number) => {
		const p = tileToMinimap(l, tx, ty);
		const size = Math.max(Math.ceil(l.scale), 3);
		return pixel(data, l.width, Math.floor(p.x) + Math.floor(size / 2) - 1, Math.floor(p.y) + Math.floor(size / 2) - 1);
	};
	assert.deepEqual(centre(CASTLE_X, CASTLE_Y), rgb(CASTLE_MARKER_COLOR));
	assert.deepEqual(centre(CASTLE_X + 1, CASTLE_Y), rgb(WORKSHOP_COLOR));
	// a plain tile has no marker
	const plain = tileToMinimap(l, CASTLE_X, CASTLE_Y - 1);
	assert.deepEqual(pixel(data, l.width, Math.floor(plain.x) + 1, Math.floor(plain.y) + 1), rgb(BIOME_COLORS[ownedEntries(w).find((e) => e.x === CASTLE_X && e.y === CASTLE_Y - 1)!.tile.biome]));
});

test('a workshop is found among thousands of tiles, even at a fraction of a pixel per tile', () => {
	let w = syntheticWorld(40_000, 6);
	const target = ownedEntries(w).find((e) => e.tile.biome === 'plains' || e.tile.biome === 'forest')!;
	w = setTile(w, target.x, target.y, { ...target.tile, building: 'workshop' });
	const l = minimapLayout(ownedBounds(w), BOX);
	assert.ok(l.scale < 6);
	const data = image(l);
	const t0 = performance.now();
	paintMinimap(data, w, l);
	const ms = performance.now() - t0;
	assert.ok(ms < 150, `${ms.toFixed(0)} ms for 40,000 tiles`);
	const [wr, wg, wb] = rgb(WORKSHOP_COLOR);
	let purple = 0;
	for (let i = 0; i < data.length; i += 4) if (data[i] === wr && data[i + 1] === wg && data[i + 2] === wb) purple++;
	assert.ok(purple >= 9, `${purple} purple pixels: a 3x3 dot`);
	const painted = new Set<string>();
	for (let i = 0; i < data.length; i += 4) if (!(data[i] === 10 && data[i + 1] === 14 && data[i + 2] === 28)) painted.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
	assert.ok(painted.size >= 5, 'several biome colours appear');
});

test('the view rectangle follows the tiles on screen', () => {
	const l = minimapLayout({ minX: 0, maxX: 99, minY: 0, maxY: 99 }, BOX);
	const r = viewRectangle(l, { minX: 10, maxX: 30, minY: 40, maxY: 52 });
	assert.ok(Math.abs(r.width - 20 * l.scale) < 1e-9 && Math.abs(r.height - 12 * l.scale) < 1e-9);
	const origin = tileToMinimap(l, 10, 40);
	assert.ok(Math.abs(r.left - origin.x) < 1e-9 && Math.abs(r.top - origin.y) < 1e-9);
});
