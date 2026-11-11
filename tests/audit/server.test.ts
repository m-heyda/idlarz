// Stat audit, part 3: what the server does with cheating saves.
//
// Each case below pins what the server does TODAY. Where a hole is open, the test says so ("EXPLOIT n"): when the hole is
// closed, that assertion fails on purpose and is changed to the new verdict ('rejected' or 'clamped').
import test from 'node:test';
import assert from 'node:assert/strict';
import { runCheats, type CheatRow } from './cheats';
import { near, oracle } from './helpers';
import { ENFORCEMENT, FLAG_POLICY, VERIFY } from '../../src/lib/cloudSave/verify';

let rows: Record<string, CheatRow>;
test('setup: run every cheating save through acceptSave', async () => {
	rows = Object.fromEntries((await runCheats()).map((r) => [r.id, r]));
	assert.equal(Object.keys(rows).length, 15);
});

const get = (id: string) => {
	assert.ok(rows, 'setup must have run');
	return rows[id];
};

test('structural forgery: an unpaid Ember shop is refused; extra attribute points and a click level beyond the ladder are repaired to what the rules allow (a save is never refused for a changed rule)', () => {
	assert.equal(get('ember-shop-unpaid').verdict, 'rejected');
	assert.match(get('ember-shop-unpaid').reason!, /embers do not add up/);
	// the claim buys nothing: the points go back to unspent (a free respec), the click level is cut to the top of the ladder (the net-worth check prices it like any claimed level)
	for (const id of ['stat-points', 'click-level']) assert.notEqual(get(id).verdict, 'rejected', id);
});

test("XP is the server's to bound: a save with more XP than the game could have paid is clamped and flagged", () => {
	const row = get('xp-inflated');
	assert.equal(row.verdict, 'clamped');
	assert.ok(row.flags.includes('xp_jump'));
});

test('FLAGGED ONLY (shadow mode): the flag costs the account its ranking; enforcement (IDL-112) refuses these only once ENFORCEMENT.enabled is switched on', () => {
	const expected: Record<string, 'gold_jump' | 'playtime_fast'> = {
		'gold-over-allowance': 'gold_jump',
		'playtime-fast': 'playtime_fast',
	};
	for (const [id, flag] of Object.entries(expected)) {
		assert.equal(get(id).verdict, 'flagged', id);
		assert.ok(get(id).flags.includes(flag), `${id} should raise ${flag}, raised ${get(id).flags}`);
		assert.equal(FLAG_POLICY[flag], 'reject', `${flag} refuses the save once enforcement is on`);
		assert.ok(ENFORCEMENT.reject.has(flag), `${flag} is on the enforcement list`);
	}
	assert.equal(ENFORCEMENT.enabled, false, 'shadow mode is the default until the live flags have been reviewed');
});

test('CLOSED (IDL-167): a save whose economy cannot be believed is stored flagged, but the server pays it from the last trusted economy (rate factor ~1)', () => {
	const expected: Record<string, 'castle_jump' | 'networth_exceeds'> = {
		'castle-skip': 'castle_jump',
		'tiles-unpaid': 'networth_exceeds',
		'resources-huge': 'networth_exceeds',
		'gold-huge': 'networth_exceeds',
	};
	for (const [id, flag] of Object.entries(expected)) {
		assert.equal(get(id).verdict, 'clamped', id);
		assert.ok(get(id).flags.includes(flag), `${id} should raise ${flag}, raised ${get(id).flags}`);
		assert.ok(get(id).rateFactor < 1.05, `${id} pays ${get(id).rateFactor.toFixed(2)}x the income on the server`);
		assert.equal(FLAG_POLICY[flag], 'clamp', `${flag} is a clamp flag`);
	}
});

test('the gold check has no flat 10,000 blind spot any more: a 1,000 floor + 2 % of the balance + income, and a burst that follows the time that really passed', () => {
	assert.equal(get('gold-inside-allowance').verdict, 'silent', '+1,500 in 300 s is allowed');
	assert.equal(get('gold-over-allowance').verdict, 'flagged', '+20,000 in 300 s is not');
	// the flat floor is what a client can add at every upload for nothing; at the 5-minute heartbeat that used to be ~2.9 million gold a day
	assert.equal(VERIFY.goldFloor, 1_000);
	const perDay = (VERIFY.goldFloor * 86_400) / 300;
	assert.ok(perDay < 300_000, `up to ${perDay.toLocaleString()} gold a day from the floor`);
});

test('EXPLOIT 1 (closed, IDL-166): Embers and rebirths are bounded by what the previous save could have paid. Clamped and flagged `ember_jump`', () => {
	for (const id of ['embers-later-save', 'embers-first-save', 'rebirths-jump']) {
		const row = get(id);
		assert.equal(row.verdict, 'clamped', `${id} is clamped`);
		assert.ok(row.flags.includes('ember_jump'), `${id} raises ember_jump, raised ${row.flags}`);
		// ... so the server no longer pays out on it: its stored income rate has no inflated Ember multiplier
		assert.ok(row.rateFactor < 2, `${id}: the server's gold rate is ${row.rateFactor.toFixed(1)}x an honest player's`);
	}
	// the ceiling that sanitizeSave does enforce (1,000,000 Embers) is worth this much extra income on every resource but XP
	near(oracle.ember(1_000_000), 1 + 0.1 * 1_000_000 ** 0.6, 'multiplier at the Ember ceiling');
	assert.ok(oracle.ember(1_000_000) > 399 && oracle.ember(1_000_000) < 400);
	// what an honest first rebirth pays, for scale (castle 6, 400 tiles)
	assert.equal(oracle.emberGain(6, 400, 0, 0), 18);
});

test('EXPLOIT 2 (closed, IDL-168): merchant levels are paid for in the net-worth floor. Foreman, Haggler, Tithe and Bulk at the maximum are flagged and clamped', () => {
	const row = get('merchant-unpaid');
	assert.equal(row.verdict, 'clamped');
	assert.ok(row.flags.includes('networth_exceeds'), `raised ${row.flags}`);
	assert.ok(row.rateFactor < 1.05, `Foreman 10 would pay 10% more income, the server pays ${row.rateFactor.toFixed(2)}x`);
});
