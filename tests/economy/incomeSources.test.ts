import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo } from '../helpers';
import { calculateResourceBreakdown, incomeSources } from '../../src/utils/game/income';
import { gearIncomePct } from '../../src/lib/gearEconomy';

// IDL-314: the per-source income lines of the header tooltips add up to the total the header shows.

test('the sources of every resource add up to its total, with and without bonuses', () => {
	api().resetGame();
	growTo(40);
	for (const merchantUpgrades of [undefined, { foreman: 5 }]) {
		const s = api();
		const breakdown = calculateResourceBreakdown(
			s.tiles,
			s.characterStats,
			s.farmLevels,
			s.prestige,
			s.farmUpgrades,
			merchantUpgrades,
			gearIncomePct(s.equipment),
		);
		for (const key of Object.keys(breakdown) as (keyof typeof breakdown)[]) {
			const { sources } = incomeSources(breakdown[key]);
			const sum = sources.reduce((a, b) => a + b.value, 0);
			assert.ok(Math.abs(sum - breakdown[key].total) < 1e-6 * Math.max(1, breakdown[key].total), `${key}: ${sum} vs ${breakdown[key].total}`);
		}
	}
});

test('the bonus lines list the Foreman and leave out what is zero', () => {
	api().resetGame();
	growTo(10);
	const s = api();
	const withForeman = calculateResourceBreakdown(s.tiles, s.characterStats, s.farmLevels, s.prestige, s.farmUpgrades, { foreman: 3 }, 0);
	const bonuses = incomeSources(withForeman.wood).bonuses;
	assert.ok(bonuses.some((b) => b.id === 'foreman' && b.pct > 0.02));
	assert.ok(!bonuses.some((b) => b.id === 'gear'));
	assert.ok(!incomeSources(withForeman.xp).bonuses.some((b) => b.id === 'foreman'), 'never on XP');
});
