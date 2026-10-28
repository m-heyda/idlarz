import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT } from '../src/config/combatConfig';
import { STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { fullSet, simSetup, simulateMany, spentCharacter } from '../src/lib/fightSim';
import { combatView, runCombat } from '../src/lib/offline/fight';
import { playerProfile } from '../src/lib/offline/profile';
import { estimateWin } from '../src/lib/offline/winChance';
import type { Equipment, MonsterType } from '../src/types/game';

// The closed-form "can I win this?" of auto-battle (offline/winChance.ts) against the real fight engine (lib/fightSim.ts).

const LOADOUTS: { name: string; equipment: Equipment }[] = [
	{ name: 'starter kit', equipment: STARTER_EQUIPMENT },
	{ name: 'woodland + club', equipment: fullSet('woodland', 'wooden_club') },
	{ name: "knight's + mace", equipment: fullSet('knight', 'steel_mace') },
	{ name: 'obsidian + maul', equipment: fullSet('obsidian', 'obsidian_maul') },
	{ name: 'rattatui + fang blade', equipment: fullSet('rattatui') },
];
const MONSTERS: { type: MonsterType; level: number }[] = [
	{ type: 'rat', level: 1 },
	{ type: 'rat', level: 5 },
	{ type: 'rat', level: 9 },
	{ type: 'ratKing', level: 15 },
];

const estimate = (equipment: Equipment, monster: { type: MonsterType; level: number }) => {
	const s = simSetup({ equipment, monsters: [monster], seed: 'estimate' });
	const profile = playerProfile(s.stored.core);
	return estimateWin(profile, profile.maxHp, monster.type, monster.level).chance;
};

test('the estimate agrees with the real fights: a clear win is above the gate, a clear loss below it, and the rest is in between', () => {
	const rows: string[] = [];
	for (const { name, equipment } of LOADOUTS) {
		for (const monster of MONSTERS) {
			const chance = estimate(equipment, monster);
			const real = simulateMany({ equipment, monster, autoUse: false }, 20).winRate;
			rows.push(`${name} vs ${monster.type} ${monster.level}: estimate ${chance.toFixed(2)}, fights ${real.toFixed(2)}`);
			if (real >= 0.9) assert.ok(chance >= COMBAT.auto.minWinChance, `a sure win is not skipped: ${rows[rows.length - 1]}`);
			if (real <= 0.1) assert.ok(chance < COMBAT.auto.minWinChance, `a sure loss is skipped: ${rows[rows.length - 1]}`);
			assert.ok(Math.abs(chance - real) <= 0.45, `within reach of the real rate: ${rows[rows.length - 1]}`);
		}
	}
	if (process.env.WIN_CHANCE_TABLE) console.log(rows.join('\n'));
});

test('potions and regeneration make a fight easier to survive, a monster that cannot be killed in time is a sure loss', () => {
	const s = simSetup({ equipment: STARTER_EQUIPMENT, monsters: [{ type: 'rat', level: 9 }], seed: 'potions' });
	const profile = playerProfile(s.stored.core);
	const bare = estimateWin(profile, profile.maxHp, 'rat', 9);
	const potions = estimateWin(profile, profile.maxHp, 'rat', 9, [{ healHp: 90, count: 5 }]);
	assert.ok(potions.chance >= bare.chance && potions.surviveSec > bare.surviveSec);
	assert.ok(estimateWin(profile, profile.maxHp, 'rat', 9, [{ healHp: 90, count: 5 }]).chance > 0.6, 'five greater potions carry the starter kit past a level 9 rat');
	assert.equal(estimateWin(profile, profile.maxHp, 'ratKing', 15).chance, 0, 'the starter kit cannot kill the King inside his clock');
	const weak = estimateWin({ ...profile, hit: 1 }, profile.maxHp, 'rat', 9);
	assert.ok(weak.chance < 0.05, 'one damage a swing against a level 9 rat is hopeless');
	const none = estimateWin(profile, 0, 'rat', 1);
	assert.ok(none.chance < estimateWin(profile, profile.maxHp, 'rat', 1).chance, 'less HP, less chance');
});

test('auto-battle skips the monster it expects to lose to and fights the one it expects to beat; a click fights anyway', () => {
	const base = { equipment: STARTER_EQUIPMENT, monsters: [{ type: 'rat' as const, level: 9 }, { type: 'rat' as const, level: 1 }], seed: 'gate' };
	const s = simSetup(base);
	const started = runCombat(s.ledger, s.env(s.start)).ledger.combat!;
	assert.equal(started.fight?.level, 1, 'the level 9 rat is beyond the starter kit: the level 1 rat is the one engaged');

	const only = simSetup({ ...base, monsters: [{ type: 'rat' as const, level: 9 }] });
	const idle = runCombat(only.ledger, only.env(only.start)).ledger.combat!;
	assert.equal(idle.fight, null, 'nothing winnable waits: auto-battle does not start a fight');

	const view = combatView(runCombat(only.ledger, only.env(only.start)).ledger, only.env(only.start), 0, false, null);
	assert.equal(view.autoNote, 'no_winnable', 'the window can say why auto-battle waits');
	assert.equal(combatView(started.fight ? runCombat(s.ledger, s.env(s.start)).ledger : s.ledger, s.env(s.start), 0, false, null).autoNote, null, 'a fight is open: nothing to explain');

	const clicked = runCombat(only.ledger, only.env(only.start), { commands: [{ kind: 'fight', n: 1 }] }).ledger.combat!;
	assert.equal(clicked.fight?.level, 9, 'a click on the monster fights it whatever the odds');
});

test('a stronger character is let loose on what a weaker one is kept away from', () => {
	const weak = estimate(STARTER_EQUIPMENT, { type: 'rat', level: 9 });
	const strong = estimate(fullSet('obsidian', 'obsidian_maul'), { type: 'rat', level: 9 });
	assert.ok(weak < COMBAT.auto.minWinChance && strong >= COMBAT.auto.minWinChance);
	// Strength is gear-independent damage: the same starter kit with 25 spare points crosses the line it could not cross before
	const trained = simSetup({ equipment: STARTER_EQUIPMENT, character: spentCharacter({ strength: 25, vitality: 25 }), monsters: [{ type: 'rat', level: 9 }], seed: 'x' });
	const profile = playerProfile(trained.stored.core);
	assert.ok(estimateWin(profile, profile.maxHp, 'rat', 9).chance > weak);
});
