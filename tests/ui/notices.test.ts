import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notify } from '../../src/lib/notices';
import { useUiStore } from '../../src/stores/uiStore';

const toasts = () => useUiStore.getState().toasts;
const clear = () => toasts().forEach((t) => useUiStore.getState().dismissToast(t.id));

test('notify puts a notice up, error tone is kept, and the same text and tone in a row is one line with a counter', () => {
	clear();
	notify('Game saved');
	notify('You need 490 more gems', 'error');
	notify('You need 490 more gems', 'error');
	assert.deepEqual(
		toasts().map((t) => [t.text, t.tone, t.count]),
		[
			['Game saved', 'info', 1],
			['You need 490 more gems', 'error', 2],
		],
	);
	clear();
});

test('the same words with another tone are a new notice, not a counter', () => {
	clear();
	notify('Done');
	notify('Done', 'error');
	assert.equal(toasts().length, 2);
	clear();
});
