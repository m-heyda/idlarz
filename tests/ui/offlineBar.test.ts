import test from 'node:test';
import assert from 'node:assert/strict';
import { barDuration, cappedLine, offlineBar } from '../../src/lib/offlineBar';

const H = 3600;

test('the bar fills with the gap against the cap and says it in hours and minutes', () => {
	const bar = offlineBar({ gapSec: 6 * H + 20 * 60, capSec: 8 * H, efficiency: 0.5 });
	assert.equal(bar.label, '6 h 20 m of 8 h');
	assert.ok(Math.abs(bar.fraction - (6 * H + 1200) / (8 * H)) < 1e-9);
	assert.equal(bar.capped, false);
	assert.equal(bar.lostSec, 0);
	assert.equal(bar.efficiencyPct, 50);
	assert.equal(cappedLine(bar), null);
});

test('a gap past the cap fills the bar and reports the time that earned nothing', () => {
	const bar = offlineBar({ gapSec: 12 * H + 10 * 60, capSec: 8 * H, efficiency: 0.65 });
	assert.equal(bar.fraction, 1);
	assert.equal(bar.label, '8 h of 8 h');
	assert.equal(bar.capped, true);
	assert.equal(bar.lostSec, 4 * H + 600);
	assert.equal(bar.efficiencyPct, 65);
	assert.equal(cappedLine(bar), 'Capped: 4 h 10 m earned nothing');
});

test('a gap exactly at the cap is full but not capped', () => {
	const bar = offlineBar({ gapSec: 8 * H, capSec: 8 * H, efficiency: 0.5 });
	assert.equal(bar.fraction, 1);
	assert.equal(bar.capped, false);
});

test('durations drop the empty part and never go negative', () => {
	assert.equal(barDuration(8 * H), '8 h');
	assert.equal(barDuration(45 * 60 + 59), '45 m');
	assert.equal(barDuration(30), '0 m');
	assert.equal(barDuration(-5), '0 m');
	assert.equal(barDuration(Number.NaN), '0 m');
});

test('garbage input stays harmless', () => {
	const bar = offlineBar({ gapSec: Number.NaN, capSec: 0, efficiency: 7 });
	assert.equal(bar.fraction, 0);
	assert.equal(bar.capped, false);
	assert.equal(bar.efficiencyPct, 100);
});

test('the welcome-back count-down starts full, ends empty and never leaves 0..1', async () => {
	const { countdownLeft, AWAY_COUNT_MS } = await import('../../src/lib/offlineBar');
	assert.equal(countdownLeft(0), 1);
	assert.equal(countdownLeft(AWAY_COUNT_MS), 0);
	assert.equal(countdownLeft(AWAY_COUNT_MS * 5), 0);
	assert.equal(countdownLeft(-50), 1);
	assert.ok(countdownLeft(AWAY_COUNT_MS / 2) < 0.5, 'eased out');
});
