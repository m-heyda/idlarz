import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { hmacSha256, sha256Hex, toHex, utf8 } from '../../src/lib/sha256';
import { sealedRng } from '../../src/lib/offline/seal';

// The engine hashes with a plain TypeScript SHA-256 so it can run in the browser (guest mode). It must give exactly what node gives: every sealed roll and world hash depends on it.

const SAMPLES = [
	'',
	'a',
	'abc',
	'x'.repeat(55),
	'x'.repeat(56),
	'x'.repeat(63),
	'x'.repeat(64),
	'x'.repeat(65),
	'héllo wörld ✓',
	JSON.stringify({ land: 'x'.repeat(5000) }),
];

test('sha256 matches node on edge-length and non-ASCII inputs', () => {
	for (const text of SAMPLES) assert.equal(sha256Hex(text), createHash('sha256').update(text).digest('hex'), `length ${text.length}`);
});

test('hmac-sha256 matches node, including keys longer than a block', () => {
	for (const key of ['k', 'test-secret-test-secret', 'k'.repeat(64), 'k'.repeat(65), 'k'.repeat(200)])
		for (const text of SAMPLES)
			assert.equal(toHex(hmacSha256(utf8(key), utf8(text))), createHmac('sha256', key).update(text).digest('hex'), `key ${key.length}, message ${text.length}`);
});

test('sealedRng draws what the node implementation drew', () => {
	const secret = 'test-secret-test-secret';
	const rng = sealedRng(secret, 'user-1', 3, 'chest', 7);
	for (let draw = 0; draw < 25; draw++) {
		const digest = createHmac('sha256', secret).update(`user-1|3|chest|7|${draw}`).digest();
		assert.equal(rng(), digest.readUIntBE(0, 6) / 2 ** 48);
	}
});
