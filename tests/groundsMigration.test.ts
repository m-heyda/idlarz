import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { convertGroundsBody, convertGroundsGrid } from '../src/lib/groundsMigration';
import { decodeSave, sealWire, packBody } from '../src/lib/saveFormat';
import { pickPersisted } from '../src/lib/sanitizeSave';
import { api, freshGame, growTo } from './helpers';
import { getTile } from '../src/utils/world';

const body = (land: [number, number, string][], extra: unknown[] = []) => ({ land, extra, other: 1 });
const letters = (b: { land: unknown }) => (b.land as [number, number, string][]).map((r) => r[2]);

test('a Grounds tile becomes the land biome most common among its 8 neighbours', () => {
	// hills x5, forest x3 around the middle g
	const b = convertGroundsBody(body([[0, 0, 'hhh'], [1, 0, 'hgf'], [2, 0, 'hff']]) as never) as ReturnType<typeof body>;
	assert.deepEqual(letters(b), ['hhh', 'hhf', 'hff']);
});

test('a lake counts as coast, ties go to the earlier entry (hills, forest, tundra, swamp, plains, coast), no land around means plains', () => {
	assert.deepEqual(letters(convertGroundsBody(body([[0, 0, 'lll'], [1, 0, 'lgl'], [2, 0, 'lll']])) as never), ['lll', 'lcl', 'lll'], 'lake -> coast');
	// 2 hills, 2 forest, 2 plains around it (the castle letters are no land): hills come first
	assert.deepEqual(letters(convertGroundsBody(body([[0, 0, 'hfp'], [1, 0, 'KgK'], [2, 0, 'hfp']])) as never), ['hfp', 'KhK', 'hfp']);
	// 2 forest, 2 plains: forest comes first; 2 swamp, 2 coast: swamp
	assert.deepEqual(letters(convertGroundsBody(body([[0, 0, 'fpK'], [1, 0, 'KgK'], [2, 0, 'fpK']])) as never), ['fpK', 'KfK', 'fpK']);
	assert.deepEqual(letters(convertGroundsBody(body([[0, 0, 'scK'], [1, 0, 'KgK'], [2, 0, 'scK']])) as never), ['scK', 'KsK', 'scK']);
	assert.deepEqual(letters(convertGroundsBody(body([[0, 0, 'g']])) as never), ['p'], 'alone: plains');
	assert.deepEqual(letters(convertGroundsBody(body([[0, 0, 'Kg'], [1, 0, 'gK']])) as never), ['Kp', 'pK'], 'the castle and other Grounds tiles are not land');
});

test('the result does not depend on the order tiles are visited: neighbours are read from the original map', () => {
	// two adjacent Grounds tiles between hills and forest: the first sees only the hills, the second only the forest.
	// (Reading the already converted first tile, the second would have tied and become hills.)
	const b = convertGroundsBody(body([[0, 0, 'hggf']]) as never) as ReturnType<typeof body>;
	assert.deepEqual(letters(b), ['hhff']);
});

test('the building and the chest stay, the level 2 marker goes, an extra with nothing left is dropped', () => {
	const b = convertGroundsBody(
		body([[0, 0, 'hhhh'], [1, 0, 'hgg g'.replace(' ', '')]], [
			[1, 1, { building: 'tavern', level: 2 }],
			[2, 1, { chest: true }],
			[3, 1, { level: 2 }],
			[0, 0, { building: 'farm' }], // not a Grounds tile: untouched
		]) as never
	) as ReturnType<typeof body>;
	assert.deepEqual(b.extra, [[1, 1, { building: 'tavern' }], [2, 1, { chest: true }], [0, 0, { building: 'farm' }]]);
	assert.equal(b.other, 1);
});

test('a body without Grounds, or not in the packed layout, is returned untouched', () => {
	const plain = body([[0, 0, 'hhh']]);
	assert.equal(convertGroundsBody(plain as never), plain);
	const odd = { land: 'nonsense', extra: 5 };
	assert.equal(convertGroundsBody(odd), odd);
	const broken = { land: [[0, 0, 'g'], 'x'] };
	assert.equal(convertGroundsBody(broken), broken);
	assert.equal(convertGroundsBody({}).land, undefined);
});

test('the 50x50 grid of the old formats converts the same way (and keeps what is not Grounds)', () => {
	const t = (biome: string, extra: Record<string, unknown> = {}) => ({ biome, isOwned: true, ...extra });
	const empty = { biome: 'empty', isOwned: false };
	const grid = [
		[t('forest'), t('forest'), empty],
		[t('forest'), t('grounds', { building: 'farm', level: 2 }), t('lake')],
		[empty, t('hills', { hasChest: true }), empty],
	];
	const out = convertGroundsGrid(grid) as Record<string, unknown>[][];
	assert.deepEqual(out[1][1], { biome: 'forest', isOwned: true, building: 'farm' }, '3 forest vs 1 hills vs 1 coast(lake)');
	assert.deepEqual(out[2][1], grid[2][1]);
	assert.equal(grid[1][1].biome, 'grounds', 'the input is not mutated');
	assert.equal(convertGroundsGrid(grid.map((r) => r.map((c) => (c.biome === 'grounds' ? t('forest') : c)))) !== undefined, true);
	const noGrounds = [[t('forest')]];
	assert.equal(convertGroundsGrid(noGrounds), noGrounds);
	assert.equal(convertGroundsGrid('x'), 'x');
});

test('a schema 3 save with Grounds tiles loads, as land, with its building and chest', () => {
	const text = readFileSync(new URL('./fixtures/saves/v3-grounds.sav', import.meta.url), 'utf8').trim();
	const r = decodeSave(text);
	assert.equal(r.ok, true, r.ok ? '' : r.reason);
	if (!r.ok) return;
	assert.equal(r.schema, 3);
	const tavern = getTile(r.state.tiles, 25, 23);
	assert.ok(tavern && tavern.building === 'tavern' && tavern.level === undefined, 'the built lot keeps its tavern and loses the level');
	assert.ok(tavern!.biome !== ('grounds' as string) && tavern!.biome !== 'lake');
	assert.equal(getTile(r.state.tiles, 27, 25)!.hasChest, true, 'the chest stays');
	assert.ok(getTile(r.state.tiles, 25, 27)!.isOwned);
	for (const [x, y] of [[25, 23], [27, 25], [25, 27]]) assert.notEqual(getTile(r.state.tiles, x, y)!.biome, 'grounds');
});

test('a current (schema 4) save that still names Grounds is refused', () => {
	freshGame();
	growTo(10);
	const b = packBody(pickPersisted(api())) as { land: [number, number, string][] };
	const [y, x0, row] = b.land.find(([, , l]) => l.length > 2 && !l.includes('K'))!;
	const forged = { ...b, land: b.land.map((r) => (r[0] === y && r[1] === x0 ? [y, x0, 'g' + row.slice(1)] : r)) };
	const r = decodeSave(sealWire({ v: 4, t: 1, s: forged }));
	assert.equal(r.ok, false);
	if (!r.ok) assert.match(r.reason, /tile biome/);
});
