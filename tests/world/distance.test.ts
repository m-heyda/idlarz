import test from 'node:test';
import assert from 'node:assert/strict';
import { CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import { DISTANCE_BANDS } from '../../src/config/distanceBands';
import { bandOf, castleDistance } from '../../src/lib/distance';

test('castleDistance is the Chebyshev distance to the castle', () => {
	assert.equal(castleDistance({ x: CASTLE_X, y: CASTLE_Y }), 0);
	assert.equal(castleDistance({ x: CASTLE_X + 16, y: CASTLE_Y }), 16);
	assert.equal(castleDistance({ x: CASTLE_X - 3, y: CASTLE_Y + 7 }), 7);
	assert.equal(castleDistance({ x: CASTLE_X + 5, y: CASTLE_Y - 5 }), 5);
});

test('the distance bands are home 1-6, outskirts 7-12, frontier 13-21, wilds 22+', () => {
	const edges: [number, string][] = [
		[0, 'home'],
		[1, 'home'],
		[6, 'home'],
		[7, 'outskirts'],
		[12, 'outskirts'],
		[13, 'frontier'],
		[21, 'frontier'],
		[22, 'wilds'],
		[500, 'wilds'],
	];
	for (const [distance, id] of edges) assert.equal(bandOf(distance).id, id, `distance ${distance}`);
});

test('bandOf falls back to the first band for NaN and negative distances', () => {
	assert.equal(bandOf(NaN).id, 'home');
	assert.equal(bandOf(-4).id, 'home');
});

test('the bands are listed in ascending order; the danger offset rises toward the wilds (0, 0, +1, +2)', () => {
	for (let i = 1; i < DISTANCE_BANDS.length; i++) assert.ok(DISTANCE_BANDS[i].from > DISTANCE_BANDS[i - 1].from);
	assert.deepEqual(
		DISTANCE_BANDS.map((band) => band.dangerOffset),
		[0, 0, 1, 2],
	);
	for (let distance = 1; distance <= 60; distance++)
		assert.ok(bandOf(distance).dangerOffset >= bandOf(distance - 1).dangerOffset, 'never falls with the distance');
});
