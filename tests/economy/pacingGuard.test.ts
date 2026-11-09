import test from 'node:test';
import assert from 'node:assert/strict';
import { PACING_MAX_DRIFT_DAYS, comparePacing, formatSummary, formatViolations, type PacingBaseline } from '../../scripts/pacingCompare';

const baseline = (hardcore: Record<string, number | null>): PacingBaseline => ({ profiles: { hardcore } });

test('identical baselines pass', () => {
	const b = baseline({ finished: 3, castle6: 2.3, castle10: 11.8, level80: 7.6, level90: null });
	assert.deepEqual(comparePacing(b, b), []);
});

test('a guarded milestone inside ±15 % passes, outside fails (both directions)', () => {
	const base = baseline({ finished: 4 });
	assert.deepEqual(comparePacing(base, baseline({ finished: 4.5 })), []); // +12.5 %
	assert.deepEqual(comparePacing(base, baseline({ finished: 3.5 })), []); // -12.5 %
	const slower = comparePacing(base, baseline({ finished: 4.7 })); // +17.5 %
	assert.equal(slower.length, 1);
	assert.equal(slower[0].milestone, 'finished');
	assert.equal(comparePacing(base, baseline({ finished: 3.2 })).length, 1); // -20 %
});

test('only the guarded milestones count, so a tiles25 shift does not fail the PR', () => {
	assert.deepEqual(comparePacing(baseline({ tiles25: 0.4, click1: 8 }), baseline({ tiles25: 0.9, click1: 2 })), []);
});

test('milestones that become reached or unreachable fail', () => {
	assert.equal(comparePacing(baseline({ level90: 12.4 }), baseline({ level90: null })).length, 1);
	assert.equal(comparePacing(baseline({ level90: null }), baseline({ level90: 12.4 })).length, 1);
	assert.deepEqual(comparePacing(baseline({ level90: null }), baseline({ level90: null })), []);
});

test('a guarded key the base never wrote counts as never reached (union of both sides)', () => {
	const violations = comparePacing(baseline({ finished: 3 }), baseline({ finished: 3, level90: 12.4 }));
	assert.equal(violations.length, 1);
	assert.equal(violations[0].milestone, 'level90');
	assert.equal(violations[0].base, null);
	assert.equal(comparePacing(baseline({ finished: 3, level90: 12.4 }), baseline({ finished: 3 })).length, 1);
});

test('a missing profile fails, a new profile is fine, tiny values are noise', () => {
	assert.equal(comparePacing({ profiles: { hardcore: { finished: 3 }, casual: { finished: 4 } } }, baseline({ finished: 3 })).length, 1);
	assert.deepEqual(comparePacing(baseline({ finished: 3 }), { profiles: { hardcore: { finished: 3 }, extra: { finished: 9 } } }), []);
	assert.deepEqual(comparePacing(baseline({ tiles100: 0.01 }), baseline({ tiles100: 0.04 })), []);
});

test('the report names the profile, the milestone and the change', () => {
	const text = formatViolations(comparePacing(baseline({ castle10: 10 }), baseline({ castle10: 13 })));
	assert.match(text, /hardcore castle10: 10\.00 d -> 13\.00 d \(\+30\.0 %/);
});

test('a late milestone fails on the absolute day cap even inside 15 %', () => {
	const base = baseline({ level90: 220 });
	assert.deepEqual(comparePacing(base, baseline({ level90: 220 + PACING_MAX_DRIFT_DAYS })), []); // +2.3 %, exactly at the cap
	const drifted = comparePacing(base, baseline({ level90: 220 + PACING_MAX_DRIFT_DAYS + 1 })); // +2.7 %, 6 days
	assert.equal(drifted.length, 1);
	assert.equal(drifted[0].milestone, 'level90');
	assert.equal(comparePacing(base, baseline({ level90: 220 - PACING_MAX_DRIFT_DAYS - 1 })).length, 1); // earlier counts too
	assert.match(formatViolations(drifted), /\+6\.00 d; allowed ±15 % and ±5 d/);
});

test('the summary table lists each profile with its moved count and largest moves', () => {
	const base: PacingBaseline = { profiles: { hardcore: { finished: 4, castle10: 10, click1: 1 }, casual: { finished: 6 } } };
	const current: PacingBaseline = { profiles: { hardcore: { finished: 4, castle10: 11, click1: 9 }, casual: { finished: 6 } } };
	const lines = formatSummary(base, current).split('\n');
	assert.equal(lines.length, 3);
	assert.match(lines[0], /^profile\s+guarded\s+moved\s+largest %\s+largest days$/);
	assert.match(lines[1], /^hardcore\s+2\s+1\s+\+10\.0 % \(castle10\)\s+\+1\.00 d \(castle10\)$/); // click1 is not guarded
	assert.match(lines[2], /^casual\s+1\s+0\s+0\s+0$/);
	assert.match(formatSummary(base, { profiles: {} }), /hardcore\s+-\s+-\s+profile missing/);
});
