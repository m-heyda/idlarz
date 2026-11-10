import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lootSecretProblem } from '../../src/lib/offline/secret';

// IDL-75: every deployment has its own LOOT_SECRET; the repo is public, so no real value may be committed.

test('a missing, short or fine secret is told apart, and a fresh random one is fine', () => {
	assert.equal(lootSecretProblem(''), 'missing');
	assert.equal(lootSecretProblem('short'), 'too_short');
	assert.equal(lootSecretProblem('0123456789abcdef'), null);
	assert.equal(lootSecretProblem('a-long-enough-secret-of-this-deployment'), null);
});

test('.env.example carries only an empty LOOT_SECRET placeholder, never a real value', () => {
	const line = readFileSync(resolve(__dirname, '..', '..', '.env.example'), 'utf8')
		.split(/\r?\n/)
		.find((l) => l.startsWith('LOOT_SECRET='));
	assert.equal(line, 'LOOT_SECRET=');
});
