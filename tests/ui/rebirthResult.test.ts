import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monstersUnlockedAt, rebirthRunSummary, rebirthUnlockIntro } from '../../src/utils/game/rebirthUnlocks';
import { emberIncomeBonus } from '../../src/utils/game/rebirth';
import { REBIRTH } from '../../src/config/rebirth';
import type { PrestigeState } from '../../src/types/game';

// The rebirth result screen: the Embers and income bonus a rebirth paid, what it unlocked (the new land and its monsters) and the run's numbers.

const prestige = (rebirths: number, legacyPoints: number, legacyEarned: number): PrestigeState => ({ rebirths, legacyPoints, legacyEarned, upgrades: {} });

test('the summary reads the Embers from the two prestige states and the income bonus from the Embers ever earned', () => {
	const run = rebirthRunSummary({
		ownedTiles: 436,
		castleLevel: 8,
		level: 34,
		playSeconds: 3600,
		rates: { gold: 61.4, wood: 22.8, stone: 19.1, food: 11.2, coal: 4.2, hide: 0 },
		kills: 12,
		before: prestige(1, 5, 40),
		after: prestige(2, 5 + 38, 78),
	});
	assert.equal(run.rebirths, 2);
	assert.equal(run.embersGained, 38);
	assert.equal(run.embersTotal, 43);
	assert.equal(run.embersEverEarned, 78);
	assert.equal(run.incomeBonusBefore, emberIncomeBonus(40));
	assert.equal(run.incomeBonusAfter, emberIncomeBonus(78));
	assert.ok(run.incomeBonusAfter > run.incomeBonusBefore);
	assert.deepEqual(
		run.topRates.map((r) => r.resource),
		['gold', 'wood', 'stone', 'food'],
		'the four best rates, highest first, zeros left out',
	);
	assert.equal(run.nextTilesNeeded, REBIRTH.tilesNeeded(2));
	assert.equal(run.kills, 12);
});

test('a rebirth that gave nothing reads as zero Embers, and unknown kills stay null', () => {
	const run = rebirthRunSummary({ ownedTiles: 1, castleLevel: 1, level: 1, playSeconds: 0, rates: {}, before: prestige(0, 3, 3), after: prestige(1, 3, 3) });
	assert.equal(run.embersGained, 0);
	assert.equal(run.kills, null);
	assert.deepEqual(run.topRates, []);
});

test('the first rebirth unlocks the jungle with its monsters; the monster count follows the roster', () => {
	const intro = rebirthUnlockIntro(1);
	assert.equal(intro?.biome, 'jungle');
	assert.deepEqual(intro?.monsters, { normal: 3, boss: 1 });
	assert.deepEqual(monstersUnlockedAt(1), { normal: 3, boss: 1 });
	assert.deepEqual(monstersUnlockedAt(0), { normal: 0, boss: 0 }, 'monsters with no rebirth gate are not an unlock');
	assert.equal(rebirthUnlockIntro(9), null, 'a late rebirth unlocks no land');
});
