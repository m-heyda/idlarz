// Fight balance table: bot loadouts x click speeds x monsters, using the real combat rules (src/lib/fightSim.ts).
//   npm run fight-sim            print the tables
//   npm run fight-sim -- --md    also write docs/generated/fight-sim.md
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { MONSTERS } from '../src/config/combatConfig';
import { atItemLevel, fullSet, seeded, simulateMany, spentCharacter } from '../src/lib/fightSim';
import { monsterStats } from '../src/lib/monsters';
import { armorOf, damagePerClick, maxHp } from '../src/lib/combat';
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
	{ label: 'Rat level 1', monster: { type: 'rat', level: 1 } },
	{ label: 'Rat level 5', monster: { type: 'rat', level: 5 } },
	{ label: 'Rat level 9', monster: { type: 'rat', level: 9 } },
	{ label: `Rat King (${MONSTERS.ratKing.hp} HP, ${MONSTERS.ratKing.timeLimitSec} s)`, monster: { type: 'ratKing', level: 15 } },
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

// ---- attribute builds: what 25 spare points (about level 30) do against the King and a tier 5 rat -----------------------------------
const BUILDS = [
	{ name: 'no points spent', spend: {} },
	{ name: 'warrior: +25 Strength', spend: { strength: 25 } },
	{ name: 'mage: +25 Intelligence', spend: { intelligence: 25 } },
	{ name: 'tank: +15 Vitality, +10 Dexterity', spend: { vitality: 15, dexterity: 10 } },
	{ name: 'balanced: +5 each', spend: { strength: 5, dexterity: 5, intelligence: 5, vitality: 5, charisma: 5 } },
];
const BUILD_GEAR = [
	{ name: 'obsidian set + maul (physical)', equipment: fullSet('obsidian', 'obsidian_maul'), type: 'physical' },
	{ name: 'obsidian set + staff (magic)', equipment: fullSet('obsidian', 'obsidian_staff'), type: 'magic' },
];
out();
out('# Level 30 builds');
out();
out('The same bot with 25 spare attribute points spent as shown (bonuses count points above the starting 5). Win % (mean seconds).');
for (const { label, monster } of MONSTER_ROWS.filter((m) => m.monster.level === 9 || m.monster.type === 'ratKing')) {
	out();
	out(`## ${label}`);
	out();
	out(`| Build + gear | Damage/hit | Armor | ${[7, 10, 15].map((s) => `${s} cps`).join(' | ')} |`);
	out('|---|---|---|---|---|---|');
	for (const gear of BUILD_GEAR) {
		for (const build of BUILDS) {
			const hero = spentCharacter(build.spend);
			const cells = [7, 10, 15].map((cps) => {
				const r = simulateMany({ equipment: gear.equipment, monster: { ...monster }, cps, character: hero }, RUNS, seeded(2000 + cps));
				return `${Math.round(r.winRate * 100)}%${r.winRate > 0 ? ` (${r.meanTimeSec.toFixed(0)}s)` : ''}`;
			});
			out(`| ${build.name}, ${gear.name} | ${damagePerClick(gear.equipment, hero)} | ${Math.round(armorOf(gear.equipment, hero) * 10) / 10} | ${cells.join(' | ')} |`);
		}
	}
}

// ---- skills: the same bot casting Heal (under 50 % HP) and Stun (on cooldown) at level 30 ---------------------------------------------
const SKILL_SPEEDS = [7, 10, 12, 15, 25];
out();
out('# Skills (level 30)');
out();
out('The bot also casts Heal (under 50 % HP) and Stun (whenever it is ready); mana and cooldowns apply, no potions. Skills do no damage, so a fight the bot already wins takes as long as before: they only move the line where gear stops being enough. Cells: win % (mean seconds, mean HP left at the end).');
for (const { label, monster } of MONSTER_ROWS.filter((m) => m.monster.type === 'ratKing')) {
	out();
	out(`## ${label}`);
	out();
	out(`| Loadout | Skills | ${SKILL_SPEEDS.map((s) => `${s} cps`).join(' | ')} |`);
	out(`|---|---|${SKILL_SPEEDS.map(() => '---').join('|')}|`);
	for (const { name, equipment } of LOADOUTS.filter((l) => ['starter kit', 'woodland set + club', "knight's set + mace", 'obsidian set + maul', 'rattatui + titan maul'].includes(l.name))) {
		for (const skillLevel of [0, 30]) {
			const cells = SKILL_SPEEDS.map((cps) => {
				const r = simulateMany({ equipment, monster: { ...monster }, cps, skillLevel }, RUNS, seeded(3000 + cps));
				return `${Math.round(r.winRate * 100)}%${r.winRate > 0 ? ` (${r.meanTimeSec.toFixed(0)}s, ${Math.round(r.meanHpLeft * 100)}% HP)` : ''}`;
			});
			out(`| ${name} | ${skillLevel ? 'Heal + Stun' : 'none'} | ${cells.join(' | ')} |`);
		}
	}
}

// ---- the Rat King by level: his armor, crits and Stun resistance, against gear of his own level and gear that fell behind -----------
out();
out('# The Rat King by level');
out();
out('A boss: level 15 to 25 when he appears (higher with the castle), up to +10 as he grows, armor, 8 % crits, 20 % Stun resistance. HP, attack and armor follow the item level curve. Gear "at the level" is the same set at the item level of the King; "behind" is item level 15. Win % (mean seconds). No skills, no potions.');
const KING_LEVELS = [15, 25, 35];
const GEARS = [
	{ name: "knight's set + mace", equipment: fullSet('knight', 'steel_mace') },
	{ name: 'obsidian set + maul', equipment: fullSet('obsidian', 'obsidian_maul') },
	{ name: 'rattatui + titan maul', equipment: { ...fullSet('rattatui'), mainHand: plainItem('titan_maul') } },
];
out();
out(`| King level | Loadout | Gear | ${SPEEDS.map((c) => `${c} cps`).join(' | ')} |`);
out(`|---|---|---|${SPEEDS.map(() => '---').join('|')}|`);
for (const level of KING_LEVELS) {
	const stats = monsterStats('ratKing', level);
	for (const { name, equipment } of GEARS) {
		for (const gearLevel of level === 15 ? [15] : [level, 15]) {
			const cells = SPEEDS.map((cps) => {
				const r = simulateMany({ equipment: atItemLevel(equipment, gearLevel), monster: { type: 'ratKing', level }, cps }, 60, seeded(4000 + cps));
				return `${Math.round(r.winRate * 100)}%${r.winRate > 0 ? ` (${r.meanTimeSec.toFixed(0)}s)` : ''}`;
			});
			out(`| ${level} (${stats.maxHp} HP, armor ${Math.round(stats.armor)}) | ${name} | ${gearLevel === level ? 'at the level' : 'behind'} | ${cells.join(' | ')} |`);
		}
	}
}

if (process.argv.includes('--md')) {
	writeFileSync(resolve(__dirname, '..', 'docs', 'generated', 'fight-sim.md'), lines.join('\n') + '\n');
	console.log('wrote docs/generated/fight-sim.md');
}
