import test from 'node:test';
import assert from 'node:assert/strict';
import { formatHeaderAmount, formatInt, formatRateAuto, parseAmount, pickRateUnit, tidy } from '../../src/utils/formatters';
import { castleTimerLabel } from '../../src/lib/castleTimer';

test('header amounts below 1,000 are whole numbers, so they never grow decimals', () => {
	assert.equal(formatHeaderAmount(0), '0');
	assert.equal(formatHeaderAmount(0.4), '0');
	assert.equal(formatHeaderAmount(9.99), '9');
	assert.equal(formatHeaderAmount(99.99), '99');
	assert.equal(formatHeaderAmount(100), '100');
	assert.equal(formatHeaderAmount(999.9), '999');
});

test('header amounts from 1,000 use three significant digits and a suffix', () => {
	assert.equal(formatHeaderAmount(1000), '1K');
	assert.equal(formatHeaderAmount(1234), '1.23K');
	assert.equal(formatHeaderAmount(9999), '10K');
	assert.equal(formatHeaderAmount(12345), '12.3K');
	assert.equal(formatHeaderAmount(123456), '123K');
	assert.equal(formatHeaderAmount(1e6), '1M');
	assert.equal(formatHeaderAmount(2.39e6), '2.39M');
	assert.equal(formatHeaderAmount(4.06e9), '4.06B');
	assert.equal(formatHeaderAmount(5e12), '5T');
});

test('header amounts carry into the next suffix instead of printing 1000', () => {
	assert.equal(formatHeaderAmount(999_960), '1M');
	assert.equal(formatHeaderAmount(999_499), '999K');
	assert.equal(formatHeaderAmount(999_999_999), '1B');
});

test('header amounts stay short past the suffix table, and survive odd input', () => {
	assert.equal(formatHeaderAmount(1e24), '1e24');
	assert.equal(formatHeaderAmount(1.23e30), '1.2e30');
	assert.equal(formatHeaderAmount(Infinity), '∞');
	assert.equal(formatHeaderAmount(NaN), '0');
	assert.equal(formatHeaderAmount(undefined), '0');
	assert.equal(formatHeaderAmount(-1234), '-1.23K');
});

test('a number never carries a zero at the end of its decimals (1K, not 1.0K or 1.00K)', () => {
	for (let n = 1000; n < 9_999_999; n += 997) assert.doesNotMatch(formatHeaderAmount(n), /\.\d*0[A-Za-z]*$/, String(n));
	assert.equal(formatHeaderAmount(2000), '2K');
	assert.equal(formatHeaderAmount(2500), '2.5K');
	assert.equal(tidy('7.00'), '7');
	assert.equal(tidy('0.90'), '0.9');
	assert.equal(tidy('1.50K'), '1.5K');
	assert.equal(tidy('10.00M'), '10M');
	assert.equal(tidy('100'), '100');
	assert.equal(tidy('1,000'), '1,000');
});

test('the rate unit follows how much there is', () => {
	assert.deepEqual(pickRateUnit(2.5), { value: 2.5, unit: 's' });
	assert.deepEqual(pickRateUnit(1), { value: 1, unit: 's' });
	assert.equal(pickRateUnit(0.5)?.unit, 'min');
	assert.equal(pickRateUnit(0.5)?.value, 30);
	assert.equal(pickRateUnit(1 / 60)?.unit, 'min');
	assert.equal(pickRateUnit(0.001)?.unit, 'h');
	assert.ok(Math.abs((pickRateUnit(0.001)?.value ?? 0) - 3.6) < 1e-9);
	assert.equal(pickRateUnit(0), null);
	assert.equal(pickRateUnit(1e-9), null);
	assert.equal(pickRateUnit(NaN), null);
	assert.equal(pickRateUnit(undefined), null);
});

test('rate text names its unit and sign', () => {
	assert.equal(formatRateAuto(0.1), '+6/min');
	assert.equal(formatRateAuto(12.5), '+12.5/s');
	assert.equal(formatRateAuto(0.001), '+3.6/h');
	assert.equal(formatRateAuto(0), null);
});

test('parseAmount reads typed amounts with suffixes', () => {
	assert.equal(parseAmount('250'), 250);
	assert.equal(parseAmount('1,500'), 1500);
	assert.equal(parseAmount('1.5k'), 1500);
	assert.equal(parseAmount(' 2M '), 2_000_000);
	assert.equal(parseAmount('3b'), 3_000_000_000);
	assert.equal(parseAmount('1.1k'), 1100);
	assert.equal(parseAmount('2qa'), 2e15);
});

test('parseAmount rejects anything that is not a whole amount of at least 1', () => {
	for (const text of ['', ' ', '0', '0.5', '-5', 'abc', '1x', 'k', '1e3', '1..2', '1k2']) assert.equal(parseAmount(text), null, text);
});

test('the castle timer text: nothing without an upgrade, never below one second, the two largest units otherwise', () => {
	assert.equal(castleTimerLabel(null), null);
	assert.equal(castleTimerLabel({ remainingSec: 0 }), '1s');
	assert.equal(castleTimerLabel({ remainingSec: 0.2 }), '1s');
	assert.equal(castleTimerLabel({ remainingSec: 59.4 }), '1m 0s');
	assert.equal(castleTimerLabel({ remainingSec: 4 * 3600 + 5 * 60 }), '4h 5m');
	assert.equal(castleTimerLabel({ remainingSec: 3 * 86400 + 7200 }), '3d 2h');
});

test('formatInt prints whole numbers without decimals and shortens from 10,000', () => {
	assert.equal(formatInt(7), '7');
	assert.equal(formatInt(73), '73');
	assert.equal(formatInt(62.4), '62');
	assert.equal(formatInt(9999), '9,999');
	assert.equal(formatInt(18130), '18.1K');
	assert.equal(formatInt(undefined), '0');
});
