import test from 'node:test';
import assert from 'node:assert/strict';
import { formatHeaderAmount, formatRateAuto, parseAmount, pickRateUnit } from '../src/utils/formatters';

test('header amounts below 1,000 are whole numbers, so they never grow decimals', () => {
	assert.equal(formatHeaderAmount(0), '0');
	assert.equal(formatHeaderAmount(0.4), '0');
	assert.equal(formatHeaderAmount(9.99), '9');
	assert.equal(formatHeaderAmount(99.99), '99');
	assert.equal(formatHeaderAmount(100), '100');
	assert.equal(formatHeaderAmount(999.9), '999');
});

test('header amounts from 1,000 use three significant digits and a suffix', () => {
	assert.equal(formatHeaderAmount(1000), '1.00K');
	assert.equal(formatHeaderAmount(1234), '1.23K');
	assert.equal(formatHeaderAmount(9999), '10.0K');
	assert.equal(formatHeaderAmount(12345), '12.3K');
	assert.equal(formatHeaderAmount(123456), '123K');
	assert.equal(formatHeaderAmount(1e6), '1.00M');
	assert.equal(formatHeaderAmount(2.39e6), '2.39M');
	assert.equal(formatHeaderAmount(4.06e9), '4.06B');
	assert.equal(formatHeaderAmount(5e12), '5.00T');
});

test('header amounts carry into the next suffix instead of printing 1000', () => {
	assert.equal(formatHeaderAmount(999_960), '1.00M');
	assert.equal(formatHeaderAmount(999_499), '999K');
	assert.equal(formatHeaderAmount(999_999_999), '1.00B');
});

test('header amounts stay short past the suffix table, and survive odd input', () => {
	assert.equal(formatHeaderAmount(1e24), '1.0e24');
	assert.equal(formatHeaderAmount(1.23e30), '1.2e30');
	assert.equal(formatHeaderAmount(Infinity), '∞');
	assert.equal(formatHeaderAmount(NaN), '0');
	assert.equal(formatHeaderAmount(undefined), '0');
	assert.equal(formatHeaderAmount(-1234), '-1.23K');
});

test('a ticking counter keeps its length inside one suffix step', () => {
	const lengths = new Set<number>();
	for (let n = 1000; n < 9990; n += 7) lengths.add(formatHeaderAmount(n).length);
	assert.deepEqual([...lengths], [5]); // 1.00K .. 9.99K
	const wide = new Set<number>();
	for (let n = 100_000; n < 999_000; n += 997) wide.add(formatHeaderAmount(n).length);
	assert.deepEqual([...wide], [4]); // 100K .. 998K
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
	assert.equal(formatRateAuto(0.1), '+6.00/min');
	assert.equal(formatRateAuto(12.5), '+12.50/s');
	assert.equal(formatRateAuto(0.001), '+3.60/h');
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
