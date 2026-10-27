// Fight balance table: bot loadouts x click speeds x monsters, using the real combat rules (src/lib/fightSim.ts).
//   npm run fight-sim            print the tables
//   npm run fight-sim -- --md    also write docs/generated/fight-sim.md
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { MONSTERS } from '../src/config/combatConfig';
import { fullSet, seeded, simulateMany } from '../src/lib/fightSim';
import { maxHp } from '../src/lib/combat';
import { aggregateStats } from '../src/lib/inventory';
import { plainItem } from '../src/lib/itemInstance';
import { freshCharacter } from '../src/lib/fightSim';
import type { Equipment } from '../src/types/game';

const RUNS = 300;
const SPEEDS = [4, 7, 10, 15, 25];

export const LOADOUTS: { name: string; equipment: Equipment }[] = [
	{ name: 'starter kit', equipment: STARTER_EQUIPMENT },
	{ name: 'woodland set + club', equipment: fullSet('woodland', 'wooden_club') },
	{ name: 'apprentice set + wand', equipment: fullSet('apprentice', 'apprentice_wand') },
	{ name: "knight's set + mace", equipment: fullSet('knight', 'steel_mace') },
	{ name: "knight's set + recurve bow", equipment: fullSet('knight', 'recurve_bow') },
	{ name: 'obsidian set + maul', equipment: fullSet('obsidian', 'obsidian_maul') },
	{ name: 'obsidian set + longbow', equipment: fullSet('obsidian', 'obsidian_longbow') },
	{ name: 'rattatui set (fang blade)', equipment: fullSet('rattatui') },
	{ name: 'rattatui + titan maul', equipment: { ...fullSet('rattatui'), mainHand: plainItem('titan_maul') } },
	{ name: 'rattatui + starfall bow', equipment: { ...fullSet('rattatui'), mainHand: plainItem('starfall_bow') } },
];

const MONSTER_ROWS = [
	{ label: 'Rat tier 1', monster: { type: 'rat', tier: 1 } },
	{ label: 'Rat tier 3', monster: { type: 'rat', tier: 3 } },
	{ label: 'Rat tier 5', monster: { type: 'rat', tier: 5 } },
	{ label: `Rat King (${MONSTERS.ratKing.hp} HP, ${MONSTERS.ratKing.timeLimitSec} s)`, monster: { type: 'ratKing', tier: 1 } },
] as const;

const lines: string[] = [];
const out = (s = '') => {
	console.log(s);
	lines.push(s);
};

const character = freshCharacter();
out('# Fight simulation');
out();
out(`Real combat rules (rollHit, stepFight, mitigate) against a bot clicking at a steady speed (gaps jittered +-30 %), ${RUNS} fights per cell, no potions.`);
out('Cells: win % (mean seconds to win). Seed is fixed, so the table is reproducible.');
out();
out('| Loadout | Damage | Armor | Max HP | Crit % | Super % |');
out('|---|---|---|---|---|---|');
for (const { name, equipment } of LOADOUTS) {
	const a = aggregateStats(equipment);
	out(`| ${name} | ${a.damage} | ${a.armor} | ${maxHp(character, equipment)} | ${(character.critChance + a.critChance).toFixed(1)} | ${(5 + a.superCrit).toFixed(0)} |`);
}
for (const { label, monster } of MONSTER_ROWS) {
	out();
	out(`## ${label}`);
	out();
	out(`| Loadout | ${SPEEDS.map((s) => `${s} cps`).join(' | ')} |`);
	out(`|---|${SPEEDS.map(() => '---').join('|')}|`);
	for (const { name, equipment } of LOADOUTS) {
		const cells = SPEEDS.map((cps) => {
			const r = simulateMany({ equipment, monster: { ...monster }, cps }, RUNS, seeded(1000 + cps));
			return `${Math.round(r.winRate * 100)}%${r.winRate > 0 ? ` (${r.meanTimeSec.toFixed(0)}s)` : ''}`;
		});
		out(`| ${name} | ${cells.join(' | ')} |`);
	}
}

if (process.argv.includes('--md')) {
	writeFileSync(resolve(__dirname, '..', 'docs', 'generated', 'fight-sim.md'), lines.join('\n') + '\n');
	console.log('wrote docs/generated/fight-sim.md');
}
