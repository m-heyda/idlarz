// Kill sim: how much of a player's income the monsters pay (docs/plan/20-monster-families-and-rewards.md sections 3 and 8, IDL-182).
//   npm run kill-sim            print the tables
//   npm run kill-sim -- --md    also write docs/generated/kill-sim.md
//   npm run kill-sim -- --set=thistleBoar.reward.gold.cap=400   try a number without editing the config (any field of MonsterDef; may be repeated)
// For each point of a run (castle level, hero level, gear tier, income per second) it takes every monster at the middle of its spawn window,
// asks the server's win estimate (the hero wears the gear tier at the monster's item level, like the monster ladder), and prices a kill with
// the real `killIncome`: seconds of income paid, and the share of the income of one spawn interval when the hero kills every monster he can beat.
// Spawns are weighted by the win chance like the server does since IDL-215 (offline/spawnWeights.ts). The target: all kills together about 15 % of
// the income, and the weakest monster below about 1 % of a 10-minute income by the middle of a run.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COMBAT, MONSTERS } from '../src/config/combatConfig';
import { STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { atItemLevel, fullSet, simSetup, spentCharacter } from '../src/lib/fightSim';
import { killIncome } from '../src/lib/loot/kill';
import { spawnLevelRange } from '../src/lib/monsters';
import { playerProfile } from '../src/lib/offline/profile';
import { expectedSpawnLevel, spawnWeight, winChanceAt } from '../src/lib/offline/spawnWeights';
import { totalStatPoints } from '../src/utils/game/character';
import type { Equipment, MonsterType } from '../src/types/game';

/**
 * Points of a run, read from the pacing sim's daily trace (`SIM_TRACE=1 npm run sim`, idle and casual profiles, first run; rounded, between the two
 * profiles): income per second and hero level when the castle reaches that level, and the gear tier a player of that stage wears (the tiers of
 * the monster ladder). Castle 1-3 come between the sim's first trace lines, so they are interpolated from the hourly milestones.
 */
interface Stage {
	label: string;
	castle: number;
	heroLevel: number;
	loadout: string;
	equipment: Equipment;
	goldPerSec: number;
	xpPerSec: number;
}
const STAGES: Stage[] = [
	{ label: 'castle 1', castle: 1, heroLevel: 4, loadout: 'starter', equipment: STARTER_EQUIPMENT, goldPerSec: 2, xpPerSec: 1.2 },
	{ label: 'castle 2', castle: 2, heroLevel: 9, loadout: 'woodland + club', equipment: fullSet('woodland', 'wooden_club'), goldPerSec: 12, xpPerSec: 3 },
	{ label: 'castle 3', castle: 3, heroLevel: 14, loadout: 'knight + mace', equipment: fullSet('knight', 'steel_mace'), goldPerSec: 40, xpPerSec: 6 },
	{ label: 'castle 4', castle: 4, heroLevel: 17, loadout: 'knight + mace', equipment: fullSet('knight', 'steel_mace'), goldPerSec: 100, xpPerSec: 12 },
	{ label: 'castle 5', castle: 5, heroLevel: 30, loadout: 'obsidian + maul', equipment: fullSet('obsidian', 'obsidian_maul'), goldPerSec: 300, xpPerSec: 20 },
	{
		label: 'castle 6',
		castle: 6,
		heroLevel: 42,
		loadout: 'obsidian + titan maul',
		equipment: fullSet('obsidian', 'titan_maul'),
		goldPerSec: 700,
		xpPerSec: 50,
	},
	{
		label: 'castle 7',
		castle: 7,
		heroLevel: 58,
		loadout: 'obsidian + titan maul',
		equipment: fullSet('obsidian', 'titan_maul'),
		goldPerSec: 1300,
		xpPerSec: 80,
	},
	{
		label: 'castle 8',
		castle: 8,
		heroLevel: 70,
		loadout: 'obsidian + titan maul',
		equipment: fullSet('obsidian', 'titan_maul'),
		goldPerSec: 2200,
		xpPerSec: 120,
	},
	{
		label: 'castle 9',
		castle: 9,
		heroLevel: 84,
		loadout: 'obsidian + titan maul',
		equipment: fullSet('obsidian', 'titan_maul'),
		goldPerSec: 3300,
		xpPerSec: 200,
	},
];

const argOf = (name: string) => process.argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
for (const spec of argOf('set')) {
	const [path, raw] = spec.split('=');
	const keys = path.split('.');
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let target: any = MONSTERS;
	for (let i = 0; i < keys.length - 1; i++) target = target[keys[i]];
	target[keys[keys.length - 1]] = Number(raw);
}

const lines: string[] = [];
const out = (s = '') => {
	console.log(s);
	lines.push(s);
};
const num = (x: number) => (x >= 1000 ? Math.round(x).toLocaleString('en-US') : x >= 10 ? x.toFixed(0) : x.toFixed(1));
const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)} %`;

const types = Object.keys(MONSTERS) as MonsterType[];
const normals = types.filter((t) => MONSTERS[t].grade === 'normal');
const bosses = types.filter((t) => MONSTERS[t].grade === 'boss');
const biomeOf = (t: MonsterType) => MONSTERS[t].spawn.biomes[0];
const BIOMES = ['plains', 'coast', 'forest', 'hills', 'swamp', 'lake', 'tundra'] as const;

const TARGET = 0.15;
const TEN_MIN = 600;

interface Row {
	type: MonsterType;
	level: number;
	win: number;
	weight: number;
	gold: number;
	xp: number;
	/** seconds of gold income one kill pays */
	seconds: number;
	/** the share of one interval's income a spawn of this type adds, weighted by how often it spawns and how often it is won */
	share: number;
	/** the same for XP */
	xpShare: number;
}

const rowsFor = (stage: Stage): { rows: Row[]; total: number; bossShare: number; xpTotal: number } => {
	const points = totalStatPoints(stage.heroLevel);
	const strength = Math.round(points * 0.6);
	const character = spentCharacter({ strength, vitality: points - strength });
	const profileAt = (level: number) =>
		playerProfile(
			simSetup({ equipment: atItemLevel(stage.equipment, level), character, level: stage.heroLevel, monsters: [], seed: 'kill-sim' }).stored.core as Record<
				string,
				unknown
			>,
		);
	const ctx = { goldPerSec: stage.goldPerSec, xpPerSec: stage.xpPerSec, luck: 0 };
	const make = (type: MonsterType): Row => {
		const level = expectedSpawnLevel(type, stage.castle);
		const win = winChanceAt(profileAt(level), type, level);
		const pay = killIncome({ type, level }, ctx);
		return {
			type,
			level,
			win,
			weight: spawnWeight(win),
			gold: pay.gold,
			xp: pay.xp,
			seconds: pay.gold / Math.max(1e-9, stage.goldPerSec),
			share: 0,
			xpShare: 0,
		};
	};
	const rows = [...normals, ...bosses].map(make);
	const normalRows = rows.filter((r) => MONSTERS[r.type].grade === 'normal');
	const weightSum = normalRows.reduce((s, r) => s + r.weight, 0);
	const interval = stage.goldPerSec * COMBAT.spawn.intervalSec;
	const xpInterval = stage.xpPerSec * COMBAT.spawn.intervalSec;
	for (const r of normalRows) {
		r.share = ((r.weight / weightSum) * r.win * r.gold) / interval;
		r.xpShare = ((r.weight / weightSum) * r.win * r.xp) / xpInterval;
	}
	// one boss at a time, one per boss interval, any of the seven biomes' (the average of them)
	const bossRows = rows.filter((r) => MONSTERS[r.type].grade === 'boss');
	const bossShare = bossRows.reduce((s, r) => s + (r.win * r.gold) / (stage.goldPerSec * COMBAT.spawn.bossIntervalSec), 0) / bossRows.length;
	for (const r of bossRows) {
		r.share = (r.win * r.gold) / (stage.goldPerSec * COMBAT.spawn.bossIntervalSec) / bossRows.length;
		r.xpShare = (r.win * r.xp) / (stage.xpPerSec * COMBAT.spawn.bossIntervalSec) / bossRows.length;
	}
	const total = normalRows.reduce((s, r) => s + r.share, 0) + bossShare;
	const xpTotal = rows.reduce((sum, r) => sum + r.xpShare, 0);
	return { rows, total, bossShare, xpTotal };
};

out('# Kill sim');
out();
out('Generated by `npm run kill-sim` (part of `npm run docs:gen`). Do not edit by hand.');
out();
out(
	`What the monsters pay against the income of a run (docs/plan/20-monster-families-and-rewards.md section 8). Per stage: castle level, hero level, gear tier and income per second come from the pacing sim (\`npm run sim\`, first run). Every monster is taken at the middle of its spawn window at that castle level; the hero wears the gear tier at the monster's item level and spends its points 60 % Strength, 40 % Vitality. A kill is priced with the real \`killIncome\` (cap, level multiplier; Luck, Gold Find and Kill Rewards % at 0). "Seconds" is the gold of one kill in seconds of the gold income. "Spawn share" is the gold a spawn of this type adds per spawn interval (${COMBAT.spawn.intervalSec} s; bosses per ${COMBAT.spawn.bossIntervalSec} s), as a share of the income of that interval, counting a monster only as often as the server spawns it (weighted by win chance, IDL-215) and as often as the hero wins. Target: all kills together about ${pct(TARGET, 0)} of the income; the weakest monster under about 1 % of a 10-minute income by the middle of the run.`,
);

const summary: { stage: Stage; total: number; bossShare: number; xpTotal: number; weakest: Row; weakestOfTen: number }[] = [];
for (const stage of STAGES) {
	const { rows, total, bossShare, xpTotal } = rowsFor(stage);
	out();
	out(`## ${stage.label}: hero level ${stage.heroLevel}, ${stage.loadout}, ${num(stage.goldPerSec)} gold/s, ${stage.xpPerSec.toFixed(2)} XP/s`);
	out();
	out('| Monster | Level | Win | Gold | XP | Seconds | % of 10 min | Spawn share |');
	out('|---|---|---|---|---|---|---|---|');
	for (const biome of BIOMES) {
		for (const r of rows.filter((x) => biomeOf(x.type) === biome)) {
			const tenMin = r.gold / (stage.goldPerSec * TEN_MIN);
			out(
				`| ${MONSTERS[r.type].label}${MONSTERS[r.type].grade === 'boss' ? ' (boss)' : ''} | ${r.level} | ${pct(r.win, 0)} | ${num(r.gold)} | ${num(r.xp)} | ${num(r.seconds)} s | ${pct(tenMin)} | ${pct(r.share, 2)} |`,
			);
		}
		const biomeRows = rows.filter((x) => biomeOf(x.type) === biome && MONSTERS[x.type].grade === 'normal');
		const w = biomeRows.reduce((s, r) => s + r.weight, 0);
		const mean = biomeRows.reduce((s, r) => s + r.weight * r.win * r.gold, 0) / w / (stage.goldPerSec * COMBAT.spawn.intervalSec);
		out(`| *${biome} total (if every spawn were here)* | | | | | | | *${pct(mean, 1)}* |`);
	}
	out(`| **All kills together** | | | | | | | **${pct(total, 1)}** (bosses ${pct(bossShare, 1)}; XP ${pct(xpTotal, 1)}) |`);
	const normalRows = rows.filter((r) => MONSTERS[r.type].grade === 'normal');
	const weakest = normalRows.reduce((a, b) => (b.gold < a.gold ? b : a));
	summary.push({ stage, total, bossShare, xpTotal, weakest, weakestOfTen: weakest.gold / (stage.goldPerSec * TEN_MIN) });
}

out();
out('## Summary');
out();
out('| Stage | Gold/s | All kills (target ~15 %) | Bosses | Normal monsters | XP, all kills | Weakest monster | Its kill, % of 10 min of income |');
out('|---|---|---|---|---|---|---|---|');
for (const s of summary) {
	out(
		`| ${s.stage.label} | ${num(s.stage.goldPerSec)} | ${pct(s.total)} | ${pct(s.bossShare)} | ${pct(s.total - s.bossShare)} | ${pct(s.xpTotal)} | ${MONSTERS[s.weakest.type].label} (level ${s.weakest.level}) | ${pct(s.weakestOfTen)} |`,
	);
}

// the levels a monster is met at, for reading the cap numbers
out();
out('## Caps');
out();
out(
	"Gold and XP caps at the monster's reference level and the multiplier per level (the pay of a level L monster is `min(rewardSec x income, cap) x levelMult^(L - refLevel)`):",
);
out();
out('| Monster | Spawn levels (castle 1 - 8) | rewardSec | Gold cap | XP cap | Level mult | Pay at the top level (gold cap x mult) |');
out('|---|---|---|---|---|---|---|');
for (const type of types) {
	const d = MONSTERS[type];
	const lo = spawnLevelRange(type, 1).min;
	const hi = spawnLevelRange(type, 8).max + 10;
	out(
		`| ${d.label} | ${lo} - ${hi} (grown) | ${d.reward.gold.rewardSec} | ${num(d.reward.gold.cap)} | ${num(d.reward.xp.cap)} | ${d.reward.levelMult} | ${num(d.reward.gold.cap * Math.pow(d.reward.levelMult, hi - d.refLevel))} |`,
	);
}

if (process.argv.includes('--md')) {
	const path = resolve(__dirname, '..', 'docs', 'generated', 'kill-sim.md');
	writeFileSync(path, lines.join('\n') + '\n');
	console.log(`wrote ${path}`);
}
