import test from 'node:test';
import assert from 'node:assert/strict';
import { createAvatarPicker, type AvatarSendResult } from '../../src/lib/avatarPick';

/** A fake client store and server: each `send` stays pending until the test settles it. */
const setup = (start: string | null = 'farmer') => {
	let shown: string | null = start;
	const sent: string[] = [];
	const settle: Array<(r: AvatarSendResult) => void> = [];
	const picker = createAvatarPicker({
		get: () => shown,
		set: (id) => {
			shown = id;
		},
		send: (id) => {
			sent.push(id);
			return new Promise<AvatarSendResult>((resolve) => settle.push(resolve));
		},
	});
	return { picker, sent, settle, shown: () => shown };
};

test('the picked avatar shows at once, before the server answers', async () => {
	const t = setup();
	const done = t.picker.pick('alchemist');
	assert.equal(t.shown(), 'alchemist');
	assert.deepEqual(t.sent, ['alchemist']);
	t.settle[0]({ ok: true, avatarId: 'alchemist' });
	assert.deepEqual(await done, { status: 'saved' });
	assert.equal(t.shown(), 'alchemist');
});

test('a refusal or a failed request goes back to the previous avatar with the reason', async () => {
	const t = setup();
	const done = t.picker.pick('knight');
	assert.equal(t.shown(), 'knight');
	t.settle[0]({ ok: false, message: 'That face is locked.' });
	assert.deepEqual(await done, { status: 'reverted', message: 'That face is locked.' });
	assert.equal(t.shown(), 'farmer');
});

test('a send that throws counts as a failure', async () => {
	let shown: string | null = 'farmer';
	const picker = createAvatarPicker({
		get: () => shown,
		set: (id) => {
			shown = id;
		},
		send: () => Promise.reject(new Error('boom')),
	});
	assert.equal((await picker.pick('knight')).status, 'reverted');
	assert.equal(shown, 'farmer');
});

test('picking the avatar that is already shown sends nothing (also while its request is in flight)', async () => {
	const t = setup();
	assert.deepEqual(await t.picker.pick('farmer'), { status: 'ignored' });
	const first = t.picker.pick('alchemist');
	assert.deepEqual(await t.picker.pick('alchemist'), { status: 'ignored' });
	assert.deepEqual(t.sent, ['alchemist']);
	t.settle[0]({ ok: true });
	await first;
});

test('rapid clicks: a late failure of an earlier pick never overwrites the newer selection', async () => {
	const t = setup();
	const a = t.picker.pick('alchemist');
	const b = t.picker.pick('bard');
	assert.equal(t.shown(), 'bard');
	t.settle[1]({ ok: true, avatarId: 'bard' });
	assert.equal((await b).status, 'saved');
	t.settle[0]({ ok: false, message: 'late failure' });
	assert.deepEqual(await a, { status: 'stale' });
	assert.equal(t.shown(), 'bard');
});

test('rapid clicks: an early success is ignored when the newer pick then fails, and the server-confirmed face is shown', async () => {
	const t = setup();
	const a = t.picker.pick('alchemist');
	const b = t.picker.pick('bard');
	t.settle[1]({ ok: false, message: 'refused' });
	assert.equal((await b).status, 'reverted');
	// the earlier pick is not confirmed yet, so the face goes back to the original
	assert.equal(t.shown(), 'farmer');
	t.settle[0]({ ok: true, avatarId: 'alchemist' });
	assert.deepEqual(await a, { status: 'stale' });
	assert.equal(t.shown(), 'alchemist');
});

test('rapid clicks: a failing newer pick reverts to the last confirmed avatar, not to the refused earlier one', async () => {
	const t = setup();
	const a = t.picker.pick('alchemist');
	const b = t.picker.pick('bard');
	t.settle[0]({ ok: false, message: 'refused' });
	assert.equal((await a).status, 'stale');
	t.settle[1]({ ok: false, message: 'refused too' });
	assert.equal((await b).status, 'reverted');
	assert.equal(t.shown(), 'farmer');
});

test("the server's value wins when it stored another avatar than the one asked for", async () => {
	const t = setup();
	const done = t.picker.pick('alchemist');
	t.settle[0]({ ok: true, avatarId: 'farmer' });
	assert.deepEqual(await done, { status: 'saved' });
	assert.equal(t.shown(), 'farmer');
});
