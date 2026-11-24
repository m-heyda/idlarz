import test from 'node:test';
import assert from 'node:assert/strict';
import { formatHeaderAmount, formatNumber, parseAmount, setNumberNotation } from '../../src/utils/formatters';

// IDL-130: number notation. Suffixes reach Dc (1e33), and a setting switches the big numbers to scientific or engineering notation; nothing below a million changes.

test('suffix notation reaches Sp, Oc, No and Dc before it falls back to e-notation', () => {
	setNumberNotation('suffix');
	assert.equal(formatNumber(1.5e21), '1.5Sx');
	assert.equal(formatNumber(2.5e24), '2.5Sp');
	assert.equal(formatNumber(3e27), '3Oc');
	assert.equal(formatNumber(4e30), '4No');
	assert.equal(formatNumber(5e33), '5Dc');
	assert.equal(formatNumber(1e36), '1e36');
	assert.equal(formatHeaderAmount(2.5e24), '2.5Sp');
	assert.ok(Math.abs(parseAmount('2.5sp')! / 2.5e24 - 1) < 1e-12);
});

test('scientific and engineering notation change numbers from a million up and leave the small ones alone', () => {
	try {
		setNumberNotation('scientific');
		assert.equal(formatNumber(1_234_567), '1.23e6');
		assert.equal(formatHeaderAmount(2.5e9), '2.5e9');
		assert.equal(formatNumber(12_345), '12.35K', 'under a million: unchanged');
		assert.equal(formatNumber(999), '999');
		setNumberNotation('engineering');
		assert.equal(formatNumber(1_234_567), '1.23e6');
		assert.equal(formatNumber(12_345_678), '12.35e6');
		assert.equal(formatNumber(1.2e10), '12e9');
		assert.equal(formatHeaderAmount(123_456_789), '123.46e6');
		assert.equal(formatNumber(-3.2e7), '-32e6');
	} finally {
		setNumberNotation('suffix');
	}
	assert.equal(formatNumber(1_234_567), '1.23M');
});
