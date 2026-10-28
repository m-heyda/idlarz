// Fight balance table: loadouts x monsters, run through the server's own fight engine (src/lib/fightSim.ts -> src/lib/offline/fight.ts).
//   npm run fight-sim            print the tables
//   npm run fight-sim -- --md    also write docs/generated/fight-sim.md
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { COMBAT, MONSTERS } from '../src/config/combatConfig';
import { atItemLevel, freshCharacter, fullSet, simulateMany, spentCharacter } from '../src/lib/fightSim';
import { monsterStats } from '../src/lib/monsters';
import { armorOf, attacksPerSecond, damagePerHit, damagePerSecond, maxHp } from '../src/lib/combat';
import { aggregateStats } from '../src/lib/inventory';
import { plainItem } from '../src/lib/itemInstance';
import type { Equipment } from '../src/types/game';

const RUNS = 60;

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
const cell = (r: ReturnType<typeof simulateMany>, withHp = false) =>
	`${Math.round(r.winRate * 100)}%${r.winRate > 0 ? ` (${r.meanTimeSec.toFixed(0)}s${withHp ? `, ${Math.round(r.meanHpLeft * 100)}% HP` : ''})` : ''}`;

const character = freshCharacter();
out('# Fight simulation');
out();
out(`The server's own fight engine (a tick of ${COMBAT.tickSec} s): the player swings at the weapon's attack speed, the monster at its own (rat ${MONSTERS.rat.attackSpeed}/s, Rat King ${MONSTERS.ratKing.attackSpeed.toFixed(2)}/s), ${RUNS} fights per cell.`);
out('Cells: win % (mean seconds to win). The streams are seeded, so the table is reproducible. Nobody clicks: gear, attributes, potions and skills decide.');
out();
out('| Loadout | Damage/hit | Swings/s | DPS | Armor | Max HP | Crit % | Super % |');
out('|---|---|---|---|---|---|---|---|');
for (const { name, equipment } of LOADOUTS) {
	const a = aggregateStats(equipment);
	out(`| ${name} | ${damagePerHit(equipment, character)} | ${attacksPerSecond(equipment, character)} | ${damagePerSecond(equipment, character)} | ${armorOf(equipment, character)} | ${maxHp(character, equipment)} | ${(character.critChance + a.critChance).toFixed(1)} | ${(5 + a.superCrit).toFixed(0)} |`);
}
out();
out('# No potions, no skills');
out();
out(`| Loadout | ${MONSTER_ROWS.map((m) => m.label).join(' | ')} |`);
out(`|---|${MONSTER_ROWS.map(() => '---').join('|')}|`);
for (const { name, equipment } of LOADOUTS) {
	out(`| ${name} | ${MONSTER_ROWS.map(({ monster }) => cell(simulateMany({ equipment, monster: { ...monster }, autoUse: false }, RUNS, `plain-${name}`))).join(' | ')} |`);
}

// ---- attribute builds: what 25 spare points (about level 30) do ------------------------------------------------------------------
const BUILDS = [
	{ name: 'no points spent', spend: {} },
	{ name: 'warrior: +25 Strength', spend: { strength: 25 } },
	{ name: 'mage: +25 Intelligence', spend: { intelligence: 25 } },
	{ name: 'tank: +15 Vitality, +10 Dexterity', spend: { vitality: 15, dexterity: 10 } },
	{ name: 'balanced: +5 each', spend: { strength: 5, dexterity: 5, intelligence: 5, vitality: 5, charisma: 5 } },
];
const BUILD_GEAR = [
	{ name: 'obsidian set + maul (physical)', equipment: fullSet('obsidian', 'obsidian_maul') },
	{ name: 'obsidian set + staff (magic)', equipment: fullSet('obsidian', 'obsidian_staff') },
];
out();
out('# Level 30 builds');
out();
out('The same fight with 25 spare attribute points spent as shown (bonuses count points above the starting 5). No potions, no skills. Win % (mean seconds).');
out();
out('| Build + gear | Damage/hit | Swings/s | Armor | Rat level 9 | Rat King |');
out('|---|---|---|---|---|---|');
for (const gear of BUILD_GEAR) {
	for (const build of BUILDS) {
		const hero = spentCharacter(build.spend);
		const rat = simulateMany({ equipment: gear.equipment, monster: { type: 'rat', level: 9 }, character: hero, autoUse: false }, RUNS, `b1-${build.name}`);
		const king = simulateMany({ equipment: gear.equipment, monster: { type: 'ratKing', level: 15 }, character: hero, autoUse: false }, RUNS, `b2-${build.name}`);
		out(`| ${build.name}, ${gear.name} | ${damagePerHit(gear.equipment, hero)} | ${attacksPerSecond(gear.equipment, hero)} | ${Math.round(armorOf(gear.equipment, hero) * 10) / 10} | ${cell(rat)} | ${cell(king)} |`);
	}
}

// ---- auto-use: potions, Heal and Stun by the fixed rules ----------------------------------------------------------------------
out();
out('# Auto-use (level 30)');
out();
out(`Auto-use drinks a potion below ${COMBAT.auto.potionBelowHpPct}% HP, casts Heal below ${COMBAT.auto.healBelowHpPct}% and Stun whenever it is ready; mana, cooldowns and the potion cooldown apply. Skills do no damage: they only move the line where gear stops being enough. Cells: win % (mean seconds, mean HP left at the end).`);
out();
out('| Loadout | Kit | Rat level 9 | Rat King |');
out('|---|---|---|---|');
for (const { name, equipment } of LOADOUTS.filter((l) => ['starter kit', 'woodland set + club', "knight's set + mace", 'obsidian set + maul', 'rattatui + titan maul'].includes(l.name))) {
	for (const kit of [
		{ label: 'nothing', level: 1, potions: [] as { id: string; qty: number }[], autoUse: false },
		{ label: 'Heal + Stun', level: 30, potions: [], autoUse: true },
		{ label: 'Heal + Stun + 5 greater potions', level: 30, potions: [{ id: 'potion_greater', qty: 5 }], autoUse: true },
	]) {
		const r = (monster: { type: 'rat' | 'ratKing'; level: number }) => cell(simulateMany({ equipment, monster, level: kit.level, potions: kit.potions, autoUse: kit.autoUse }, RUNS, `k-${name}-${kit.label}`), true);
		out(`| ${name} | ${kit.label} | ${r({ type: 'rat', level: 9 })} | ${r({ type: 'ratKing', level: 15 })} |`);
	}
}

// ---- the Rat King by level -------------------------------------------------------------------------------------------------------
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
out('| King level | Loadout | Gear | Result |');
out('|---|---|---|---|');
for (const level of KING_LEVELS) {
	const stats = monsterStats('ratKing', level);
	for (const { name, equipment } of GEARS) {
		for (const gearLevel of level === 15 ? [15] : [level, 15]) {
			const r = simulateMany({ equipment: atItemLevel(equipment, gearLevel), monster: { type: 'ratKing', level }, autoUse: false }, RUNS, `king-${name}-${level}`);
			out(`| ${level} (${stats.maxHp} HP, armor ${Math.round(stats.armor)}) | ${name} | ${gearLevel === level ? 'at the level' : 'behind'} | ${cell(r)} |`);
		}
	}
}

if (process.argv.includes('--md')) {
	writeFileSync(resolve(__dirname, '..', 'docs', 'generated', 'fight-sim.md'), lines.join('\n') + '\n');
	console.log('wrote docs/generated/fight-sim.md');
}
