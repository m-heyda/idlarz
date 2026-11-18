import test from 'node:test';
import assert from 'node:assert/strict';
import '../helpers';
import { createClickLimiter } from '../../src/lib/clickLimiter';
import { CLICK_LIMIT } from '../../src/config/economy';

const make = () => createClickLimiter({ ...CLICK_LIMIT });

test('a burst up to the bucket size is paid, then clicks stop paying', () => {
	const l = make();
	let paid = 0;
	for (let i = 0; i < 20; i++) if (l.take({ eventId: i, now: 1000, trusted: true })) paid++;
	assert.equal(paid, CLICK_LIMIT.capacity);
});

test('the bucket refills at refillPerSec', () => {
	const l = make();
	for (let i = 0; i < CLICK_LIMIT.capacity; i++) l.take({ eventId: i, now: 0, trusted: true });
	assert.equal(l.take({ eventId: 100, now: 0, trusted: true }), false);
	let paid = 0;
	for (let i = 0; i < 20; i++) if (l.take({ eventId: 200 + i, now: 1000, trusted: true })) paid++;
	assert.equal(paid, CLICK_LIMIT.refillPerSec);
});

test('a 20 clicks/s auto-clicker earns about as much as a 5 clicks/s player over 10 s', () => {
	const fast = make();
	const auto = make();
	let id = 0;
	let fastPaid = 0;
	let autoPaid = 0;
	for (let i = 0; i < 20 * 10; i++) {
		if (auto.take({ eventId: ++id, now: i * 50, trusted: true })) autoPaid++;
	}
	for (let i = 0; i < 5 * 10; i++) {
		if (fast.take({ eventId: ++id, now: i * 200, trusted: true })) fastPaid++;
	}
	assert.equal(fastPaid, 50); // never limited
	assert.ok(autoPaid <= fastPaid + CLICK_LIMIT.capacity + 2, `auto-clicker paid ${autoPaid}`);
});

test('a very fast human (burst of 8 within a second, then a pause) is never limited', () => {
	const l = make();
	let id = 0;
	let paid = 0;
	let total = 0;
	for (let burst = 0; burst < 30; burst++) {
		for (let k = 0; k < 8; k++) {
			total++;
			if (l.take({ eventId: ++id, now: burst * 10_000 + k * 120, trusted: true })) paid++;
		}
	}
	assert.equal(paid, total);
});

test('stamina caps a 24 h auto-clicker near the long-run allowance', () => {
	const l = make();
	let id = 0;
	let paid = 0;
	const seconds = 24 * 3600;
	for (let s = 0; s < seconds; s++) {
		for (let k = 0; k < 20; k++) {
			if (l.take({ eventId: ++id, now: s * 1000 + k * 50, trusted: true })) paid++;
		}
	}
	const allowance = CLICK_LIMIT.staminaCapacity + CLICK_LIMIT.staminaRefillPerSec * seconds;
	assert.ok(paid <= allowance + 5, `paid ${paid} > allowance ${allowance}`);
	assert.ok(paid >= allowance * 0.97, `paid ${paid} far below allowance ${allowance}`);
});

test('untrusted (script-dispatched) clicks never pay and do not consume tokens', () => {
	const l = make();
	for (let i = 0; i < 100; i++) assert.equal(l.take({ eventId: i, now: 0, trusted: false }), false);
	let paid = 0;
	for (let i = 0; i < 20; i++) if (l.take({ eventId: 1000 + i, now: 0, trusted: true })) paid++;
	assert.equal(paid, CLICK_LIMIT.capacity);
});

test('all handlers of one event share one token and one verdict', () => {
	const l = make();
	for (let i = 0; i < CLICK_LIMIT.capacity - 1; i++) l.take({ eventId: i, now: 0, trusted: true });
	const a = l.take({ eventId: 500, now: 0, trusted: true });
	const b = l.take({ eventId: 500, now: 0, trusted: true });
	const c = l.take({ eventId: 500, now: 0, trusted: true });
	assert.deepEqual([a, b, c], [true, true, true]);
	assert.equal(l.take({ eventId: 501, now: 0, trusted: true }), false); // that was the last token
});

test('time going backwards never refills', () => {
	const l = make();
	for (let i = 0; i < CLICK_LIMIT.capacity; i++) l.take({ eventId: i, now: 10_000, trusted: true });
	assert.equal(l.take({ eventId: 99, now: 0, trusted: true }), false);
});

test('a click made at exactly the sustained rate is not refused for float rounding', () => {
	const limiter = createClickLimiter({ ...CLICK_LIMIT, capacity: 1 });
	let now = 0;
	// one click every 200 ms is the refill rate of 5 per second: every one of them is a person clicking at the sustained pace
	let paid = 0;
	for (let i = 0; i < 200; i++) {
		if (limiter.take({ eventId: i + 1, now, trusted: true })) paid++;
		now += 1000 / CLICK_LIMIT.refillPerSec;
	}
	assert.equal(paid, 200);
});
