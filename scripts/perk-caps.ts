// Perk family cap sim (IDL-149): how the gear bucket of each family behaves against the set bonuses and a top legendary, for several cap candidates.
//   npm run perk-caps            print the tables
//   npm run perk-caps -- --md    also rewrite the generated block of docs/plan/perk-caps.md
// Analysis only: it reads the live set bonuses (catalog/sets.ts via setBonusStats), the live distance bands and monster spawn rules and the server's own
// fight engine, and changes nothing. The decided caps and tiers are the live ones (src/catalog/perkCaps.ts, applied by IDL-252); only the roomy and none columns are candidates.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setBonusStats } from '../src/catalog';
import { SET_DEFS } from '../src/catalog/sets';
import { LEGENDARY_PERK_TIERS, PERK_CAPS, WEAPON_LEGENDARY_DAMAGE_TOP } from '../src/catalog/perkCaps';
import { MONSTERS } from '../src/config/combatConfig';
import { DISTANCE_BANDS } from '../src/config/distanceBands';
import { kit, fullSet, simulateMany, spentCharacter } from '../src/lib/fightSim';
import { spawnLevelRange } from '../src/lib/monsters';
import type { Equipment, MonsterType } from '../src/types/game';

type Family = 'incomePct' | 'xpPct' | 'killRewardPct' | 'clickPct' | 'damagePct';
const FAMILIES: { key: Family; label: string }[] = [
	{ key: 'incomePct', label: 'Income' },
	{ key: 'xpPct', label: 'XP' },
	{ key: 'killRewardPct', label: 'Kill reward' },
	{ key: 'clickPct', label: 'Click gold' },
	{ key: 'damagePct', label: 'Damage' },
];

/** Legendary tier magnitudes in % (IDL-149 decision 1), read from the live data. */
const TIERS: Record<Family, { common: number; rare: number; top: number }> = LEGENDARY_PERK_TIERS;

/** Cap columns: the decided caps (live, `PERK_CAPS`), a roomy +10 points and no cap, to show what the decision costs. */
const CAPS: { id: string; caps: Record<Family, number> }[] = [
	{ id: 'decided', caps: PERK_CAPS },
	{ id: 'roomy', caps: { incomePct: 60, xpPct: 60, killRewardPct: 70, clickPct: 50, damagePct: 60 } },
	{ id: 'none', caps: { incomePct: Infinity, xpPct: Infinity, killRewardPct: Infinity, clickPct: Infinity, damagePct: Infinity } },
];
const decided = CAPS[0].caps;

/** Pieces a full set has: the highest threshold of its bonuses. A top legendary takes one slot, so a 14-piece set drops to 13 pieces (loses its 14 bonus). */
const fullPieces = (id: string): number => Math.max(...Object.keys(SET_DEFS.find((s) => s.id === id)!.bonuses).map(Number));
const withLegendary = (id: string): number => (fullPieces(id) >= 14 ? fullPieces(id) - 1 : fullPieces(id));
const setValue = (id: string, pieces: number, family: Family): number => setBonusStats({ [id]: pieces })[family] ?? 0;
const capText = (cap: number): string => (Number.isFinite(cap) ? `${cap}` : 'none');
const mult = (pct: number): string => `x${(1 + pct / 100).toFixed(2)}`;

const lines: string[] = [];
const out = (s = '') => lines.push(s);

// ---- 1. the tiers and the cap candidates ------------------------------------------------------------------------------------------
out('#### Legendary tiers and cap candidates');
out();
out(`| Family | Common | Rare | Top | ${CAPS.map((c) => `Cap: ${c.id}`).join(' | ')} |`);
out(`|---|---|---|---|${CAPS.map(() => '---').join('|')}|`);
for (const f of FAMILIES) {
	const t = TIERS[f.key];
	out(`| ${f.label} | ${t.common} | ${t.rare} | ${t.top} | ${CAPS.map((c) => capText(c.caps[f.key])).join(' | ')} |`);
}

// ---- 2. every set against every family ---------------------------------------------------------------------------------------------
out();
out('#### Set bonuses reached, with and without one top legendary');
out();
out(
	'Set only = the live bonuses at the full piece count. Set + legendary adds the Top tier of the family; the legendary takes a slot, so a 14-piece set is counted at 13 pieces (it loses its 14-piece bonus: S2 damage is 28 + 10 = 38 and not 38 + 10 = 48). Obsidian has 12 pieces and the legendary takes a 13th or 14th slot, so it keeps all 12. Cells: gear bucket % (multiplier after the decided cap); `>` marks a total over the decided cap.',
);
for (const f of FAMILIES) {
	out();
	out(`**${f.label}** (decided cap ${decided[f.key]}, top legendary +${TIERS[f.key].top})`);
	out();
	out('| Set | Pieces (alone / with legendary) | Set only | Set + top legendary | Legendary alone | Over the decided cap? |');
	out('|---|---|---|---|---|---|');
	for (const def of SET_DEFS) {
		const set = setValue(def.id, fullPieces(def.id), f.key);
		const both = setValue(def.id, withLegendary(def.id), f.key) + TIERS[f.key].top;
		const cell = (v: number) => `${v}${v > decided[f.key] ? ' >' : ''} (${mult(Math.min(v, decided[f.key]))})`;
		const limited = both > decided[f.key] ? `yes, ${both - decided[f.key]} points cut` : 'no';
		out(`| ${def.label} | ${fullPieces(def.id)} / ${withLegendary(def.id)} | ${cell(set)} | ${cell(both)} | ${cell(TIERS[f.key].top)} | ${limited} |`);
	}
}

// ---- 3. how much each candidate cuts ----------------------------------------------------------------------------------------------
out();
out('#### Points lost to each cap candidate (set + one top legendary)');
out();
out(`| Set | Family | Raw total | ${CAPS.map((c) => `Cut by ${c.id}`).join(' | ')} |`);
out(`|---|---|---|${CAPS.map(() => '---').join('|')}|`);
for (const def of SET_DEFS) {
	for (const f of FAMILIES) {
		const own = setValue(def.id, withLegendary(def.id), f.key);
		if (own === 0) continue;
		const raw = own + TIERS[f.key].top;
		out(`| ${def.label} | ${f.label} | ${raw} | ${CAPS.map((c) => (Number.isFinite(c.caps[f.key]) ? Math.max(0, raw - c.caps[f.key]) : 0)).join(' | ')} |`);
	}
}

// ---- 4. how many legendaries it takes to reach the cap -----------------------------------------------------------------------------
out();
out('#### Top legendaries that fill each cap');
out();
out('| Family | Top | Tight cap | Legendaries alone | With Obsidian 12 | Roomy cap | Legendaries alone | With Obsidian 12 |');
out('|---|---|---|---|---|---|---|---|');
for (const f of FAMILIES) {
	const top = TIERS[f.key].top;
	const obsidian = setValue('obsidian', 12, f.key);
	const need = (cap: number, base: number) => Math.max(0, Math.ceil((cap - base) / top));
	const [t, r] = [CAPS[0].caps[f.key], CAPS[1].caps[f.key]];
	out(`| ${f.label} | ${top} | ${t} | ${need(t, 0)} | ${need(t, obsidian)} | ${r} | ${need(r, 0)} | ${need(r, obsidian)} |`);
}

// ---- 4b. a stronger weapon legendary ----------------------------------------------------------------------------------------------
out();
out('#### Damage: what a stronger weapon legendary does to S2 / S3 (13 pieces plus the weapon)');
out();
const WEAPON_CAPS = [45, decided.damagePct, 55];
out(
	`| Weapon legendary damage | ${['ashen_warlord', 'blightbound'].map((id) => `${SET_DEFS.find((s) => s.id === id)!.label} total`).join(' | ')} | Cut at cap ${WEAPON_CAPS.join(' / ')} (S2, S3) |`,
);
out('|---|---|---|---|');
for (const top of [TIERS.damagePct.top, 15, WEAPON_LEGENDARY_DAMAGE_TOP, 25]) {
	const totals = ['ashen_warlord', 'blightbound'].map((id) => setValue(id, withLegendary(id), 'damagePct') + top);
	const cuts = totals.map((t) => WEAPON_CAPS.map((cap) => Math.max(0, t - cap)).join('/'));
	out(`| +${top} | ${totals.join(' | ')} | ${cuts.join(', ')} |`);
}

// ---- 5. damage in the real fight engine --------------------------------------------------------------------------------------------
const RUNS = 60;
const hero = spentCharacter({ strength: 12, vitality: 8, dexterity: 5 });
const BOSSES = (Object.keys(MONSTERS) as MonsterType[]).filter((t) => MONSTERS[t].grade === 'boss');
const winCell = (equipment: Equipment, type: MonsterType, level: number, seed: string): string => {
	const r = simulateMany({ equipment, monster: { type, level }, character: hero, level: 30, autoUse: true }, RUNS, seed);
	return `${Math.round(r.winRate * 100)}%${r.winRate > 0 ? ` (${r.meanTimeSec.toFixed(0)}s)` : ''}`;
};
const s2 = setValue('ashen_warlord', withLegendary('ashen_warlord'), 'damagePct');
const s3 = setValue('blightbound', withLegendary('blightbound'), 'damagePct');
const KITS: { name: string; equipment: Equipment }[] = [
	{ name: 'Obsidian 12 + maul (Damage +0 %)', equipment: fullSet('obsidian', 'obsidian_maul') },
	{ name: `Ashen Warlord (S2) 14 (Damage +${setValue('ashen_warlord', 14, 'damagePct')} %)`, equipment: kit('S2') },
	{ name: `Blightbound (S3) 14 (Damage +${setValue('blightbound', 14, 'damagePct')} %)`, equipment: kit('S3') },
];
out();
out('#### Damage against the fight engine');
out();
out(
	`Level 30 hero (25 points: 12 Strength, 8 Vitality, 5 Dexterity), Heal, Stun and potions by the fixed auto-use rules, ${RUNS} seeded fights per cell, win % (mean seconds). Each boss at the highest level its spawn window reaches at castle level 8. Gear at its authored level, so this shows the shape and not the final balance (the S1-S3 pieces are disabled placeholders today). With a top damage legendary (+${TIERS.damagePct.top}) S2 reaches ${s2 + TIERS.damagePct.top} and S3 ${s3 + TIERS.damagePct.top}: ${mult(s2 + TIERS.damagePct.top)} and ${mult(s3 + TIERS.damagePct.top)} per hit against the decided cap ${decided.damagePct} (${mult(decided.damagePct)}), so the cap bites only if more than one damage perk is stacked.`,
);
out();
out(`| Loadout | ${BOSSES.map((b) => `${b} L${spawnLevelRange(b, 8).max}`).join(' | ')} |`);
out(`|---|${BOSSES.map(() => '---').join('|')}|`);
for (const k of KITS) out(`| ${k.name} | ${BOSSES.map((b) => winCell(k.equipment, b, spawnLevelRange(b, 8).max, `perk-${k.name}`)).join(' | ')} |`);

// the same S2 kit with its damage bonus moved to a chosen total (the 3-piece bonus is shifted in place and put back), so the engine shows what each total, capped or not, does to a fight
const ashen = SET_DEFS.find((s) => s.id === 'ashen_warlord')!;
const s2Total = setValue('ashen_warlord', 14, 'damagePct');
const withDamage = <T>(total: number, run: () => T): T => {
	const bonus = ashen.bonuses[3];
	const before = bonus.damagePct ?? 0;
	bonus.damagePct = before + (total - s2Total);
	try {
		return run();
	} finally {
		bonus.damagePct = before;
	}
};
const TOTALS = [0, 28, 38, 48, decided.damagePct];
out();
out('#### Damage total sweep (Ashen Warlord kit)');
out();
out(
	`Same kit, same hero, only the set's damage total changes: 0 = none, 28 = S2 at 13 pieces, 38 = S2 at 14, 48 = S2 at 13 plus the +20 weapon legendary, ${decided.damagePct} = the decided cap. Win % (mean seconds), ${RUNS} seeded fights.`,
);
out();
out(`| Damage total | ${BOSSES.map((b) => `${b} L${spawnLevelRange(b, 8).max}`).join(' | ')} |`);
out(`|---|${BOSSES.map(() => '---').join('|')}|`);
for (const total of TOTALS) {
	const row = withDamage(total, () => BOSSES.map((b) => winCell(kit('S2'), b, spawnLevelRange(b, 8).max, `sweep-${total}`)));
	out(`| ${total} % | ${row.join(' | ')} |`);
}

// ---- 6. IDL-222: where the boss band should start ----------------------------------------------------------------------------------
out();
out('#### IDL-222: the boss band against the live spawn rules');
out();
out('| Band | From (castle distance) | Tiles in the ring at that distance |');
out('|---|---|---|');
for (const b of DISTANCE_BANDS) out(`| ${b.id} | ${b.from} | ${8 * b.from} |`);
out();
out('| Boss | Biomes | Spawn distance (min-max) | Spawn level at castle 1 | At castle 8 |');
out('|---|---|---|---|---|');
for (const b of BOSSES) {
	const s = MONSTERS[b].spawn;
	const a = spawnLevelRange(b, 1);
	const c = spawnLevelRange(b, 8);
	out(`| ${b} | ${s.biomes.join(', ')} | ${s.minCastleDistance}-${s.maxCastleDistance} | ${a.min}-${a.max} | ${c.min}-${c.max} |`);
}
const maxDistance = Math.max(...BOSSES.map((b) => MONSTERS[b].spawn.maxCastleDistance));
const bandFrom = (id: string): number => DISTANCE_BANDS.find((b) => b.id === id)!.from;
out();
out(
	`Live fact: no boss can stand farther than ${maxDistance} tiles from the castle, the outskirts start at ${bandFrom('outskirts')} and the frontier at ${bandFrom('frontier')}. A "13+" boss band is empty under today's spawn rules.`,
);

const text = lines.join('\n');
console.log(text);
if (process.argv.includes('--md')) {
	const file = resolve(__dirname, '../docs/plan/perk-caps.md');
	const start = '<!-- perk-caps:start -->';
	const end = '<!-- perk-caps:end -->';
	const doc = readFileSync(file, 'utf8');
	const a = doc.indexOf(start);
	const b = doc.indexOf(end);
	if (a < 0 || b < a) throw new Error('docs/plan/perk-caps.md has no generated block');
	writeFileSync(file, `${doc.slice(0, a + start.length)}\n\n${text}\n\n${doc.slice(b)}`);
	console.log('\nwrote docs/plan/perk-caps.md');
}
