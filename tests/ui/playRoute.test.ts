import test from 'node:test';
import assert from 'node:assert/strict';
import { isPlayPath, loginRedirectPath, safeNextPath } from '../../src/lib/playRoute';

test('safeNextPath keeps a path on this site', () => {
	assert.equal(safeNextPath('/play'), '/play');
	assert.equal(safeNextPath('/play/sub?a=1'), '/play/sub?a=1');
});

test('safeNextPath refuses anything that could leave the site', () => {
	for (const bad of [
		'//evil.example',
		'/\\evil.example',
		'https://evil.example',
		'javascript:alert(1)',
		'play',
		'',
		'/pl\nay',
		'/a\\b',
		'/' + 'x'.repeat(300),
	]) {
		assert.equal(safeNextPath(bad), '/play', JSON.stringify(bad));
	}
	assert.equal(safeNextPath(null), '/play');
	assert.equal(safeNextPath(undefined), '/play');
});

test('the guest redirect opens the login window and remembers the way back', () => {
	assert.equal(loginRedirectPath(), '/?login=1&next=%2Fplay');
	assert.equal(loginRedirectPath('//evil.example'), '/?login=1&next=%2Fplay');
	assert.equal(decodeURIComponent(loginRedirectPath('/play/x?y=1').split('next=')[1]), '/play/x?y=1');
});

test('isPlayPath matches /play and below, not look-alikes', () => {
	assert.equal(isPlayPath('/play'), true);
	assert.equal(isPlayPath('/play/x'), true);
	assert.equal(isPlayPath('/playground'), false);
	assert.equal(isPlayPath('/'), false);
});
