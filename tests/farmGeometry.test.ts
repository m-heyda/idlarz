import test from 'node:test';
import assert from 'node:assert/strict';
import { PERSONAL_SPACE, randomSpot, roomySpot, seeded, walkable } from '../src/components/game/overlays/farmGeometry';

// prop centres of the pasture (sprites_farm.py): the barn, the coop, a trough, a hay stack, a barrel, the pond
const PROPS: [number, number][] = [[8.5, 8.5], [-1, 11], [-3.3, 1.4], [-6, 7], [11.6, 5.6], [-12, -4]];

test('animals cannot stand on or right beside a building, trough, hay stack, barrel or the pond', () => {
	for (const [x, y] of PROPS) {
		assert.equal(walkable(x, y), false, `prop at ${x},${y}`);
		assert.equal(walkable(x + 1.2, y), false, `beside the prop at ${x},${y}`);
	}
	assert.equal(walkable(8.5, 5.9), false, 'in front of the barn door');
});

test('animals stay inside the fence, and random spots are always walkable', () => {
	assert.equal(walkable(17.5, 0), false);
	assert.equal(walkable(0, -17.5), false);
	const rnd = seeded(5);
	for (let i = 0; i < 2000; i++) {
		const s = randomSpot(rnd);
		assert.ok(walkable(s.x, s.y), `${s.x},${s.y}`);
		assert.ok(Math.hypot(s.x - 8.5, s.y - 8.5) > 2.5, 'never inside the barn');
	}
});

test('roomySpot picks the spot farthest from the others', () => {
	const others = [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: -5, y: 5 }];
	const rnd = seeded(9);
	const spot = roomySpot(others, 60, rnd);
	const room = (p: { x: number; y: number }) => Math.min(...others.map((o) => Math.hypot(o.x - p.x, o.y - p.y)));
	let typical = 0;
	for (let i = 0; i < 20; i++) typical += room(randomSpot(rnd));
	assert.ok(room(spot) > typical / 20, 'roomier than an average random spot');
	assert.ok(PERSONAL_SPACE > 0);
});
