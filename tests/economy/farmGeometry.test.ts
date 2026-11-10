import test from 'node:test';
import assert from 'node:assert/strict';
import { PERSONAL_SPACE, randomSpot, roomySpot, walkable } from '../../src/components/game/overlays/farmGeometry';
import { mulberry32 } from '../../src/lib/rng';

// prop centres of the pasture (sprites_farm.py): the barn, the coop, a trough, a hay stack, a barrel, the pond
const PROPS: [number, number][] = [
	[8.5, 8.5],
	[-1, 11],
	[-3.3, 1.4],
	[-6, 7],
	[11.6, 5.6],
	[-12, -4],
];

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
	const rnd = mulberry32(5);
	for (let i = 0; i < 2000; i++) {
		const s = randomSpot(rnd);
		assert.ok(walkable(s.x, s.y), `${s.x},${s.y}`);
		assert.ok(Math.hypot(s.x - 8.5, s.y - 8.5) > 2.5, 'never inside the barn');
	}
});

test('roomySpot picks the spot farthest from the others', () => {
	const others = [
		{ x: 0, y: 0 },
		{ x: 5, y: 5 },
		{ x: -5, y: 5 },
	];
	const rnd = mulberry32(9);
	const spot = roomySpot(others, 60, rnd);
	const room = (p: { x: number; y: number }) => Math.min(...others.map((o) => Math.hypot(o.x - p.x, o.y - p.y)));
	let typical = 0;
	for (let i = 0; i < 20; i++) typical += room(randomSpot(rnd));
	assert.ok(room(spot) > typical / 20, 'roomier than an average random spot');
	assert.ok(PERSONAL_SPACE > 0);
});

test('the pen zoom is a whole number that grows with the window, 4 only when both sides are big', async () => {
	const { penZoom } = await import('../../src/components/game/overlays/farmGeometry');
	assert.equal(penZoom(1120, 760), 3);
	assert.equal(penZoom(1800, 900), 3, 'wide but short: the pen would be cropped to a strip');
	assert.equal(penZoom(1800, 1000), 4);
	assert.equal(penZoom(600, 800), 2);
	assert.equal(penZoom(400, 800), 1);
});

test('the farm parts: every prop uses a rendered part, the fence is closed but for the gate, and a bigger window only adds apron props', async () => {
	const { penProps, apronProps, apronReach, propPlace } = await import('../../src/components/game/overlays/farmLayout');
	const { existsSync } = await import('node:fs');
	const pen = penProps();
	const apron = apronProps(40);
	for (const prop of [...pen, ...apron]) {
		assert.ok(existsSync(`public/pixel/farm/${prop.part}.png`), `${prop.key}: ${prop.part}.png`);
		const place = propPlace(prop);
		assert.ok(place.w > 0 && place.h > 0, prop.key);
	}
	assert.equal(new Set(pen.map((p) => p.key)).size, pen.length, 'unique keys in the pen');
	assert.ok(pen.some((p) => p.part === 'gate'));
	// no fence part stands inside the gate opening of the near-right fence
	assert.equal(pen.filter((p) => p.key.startsWith('fence-x-18-') && p.part !== 'fence_post' && p.x > -4.2 && p.x < -2).length, 0, 'the gate is open');
	const bigger = new Set(apronProps(80).map((p) => p.key));
	assert.ok(
		apron.every((p) => bigger.has(p.key)),
		'a larger reach keeps every prop of a smaller one',
	);
	assert.ok(bigger.size > apron.length);
	assert.ok(
		apron.every((p) => Math.max(Math.abs(p.x), Math.abs(p.y)) > 18),
		'nothing in the apron stands inside the fence',
	);
	assert.ok(apronReach(3840, 2160, 4) > apronReach(1120, 760, 3), 'a bigger window reaches further');
});
