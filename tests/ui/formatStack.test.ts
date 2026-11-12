import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatStack } from '@/utils/formatters';

test('stack counts are plain below 1,000 and short in lower case from 1k', () => {
	assert.equal(formatStack(1), '1');
	assert.equal(formatStack(999), '999');
	assert.equal(formatStack(1000), '1k');
	assert.equal(formatStack(1500), '1.5k');
	assert.equal(formatStack(100_000), '100k');
	assert.equal(formatStack(2_500_000), '2.5m');
});
