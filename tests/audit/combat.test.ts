// Stat audit, part 2: items, sets and combat numbers, one modifier at a time, against independent oracles.
//
// Strict environment: a fixed starter character (every attribute 5) and plain items (authored level, neutral quality, no affixes), so
// the flat part is a known constant and every test adds exactly one modifier on top of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { character, clamp, combatOracle as o, near, round1, round2 } from './helpers';
import {
	AFFIX_CATALOG,
	AFFIXES,
	ITEMS,
	ITEM_CATALOG,
	RARITIES,
	SETS,
	setBonusStats,
	setCounts,
	EQUIPMENT_LAYOUT,
	WEAPON_ATTACK_SPEED,
} from '../../src/catalog';
import { STAT_DEFS, type StatKey } from '../../src/catalog/stats';
import { aggregateStats } from '../../src/lib/inventory';
import { baseStatsAt, plainItem, resolveItem } from '../../src/lib/itemInstance';
import {
	armorOf,
	armorReduction,
	attacksPerSecond,
	critOdds,
	damagePerHit,
	damagePerSecond,
	dodgeChance,
	lifeLeechPercent,
	manaRegenPerSec,
	maxHp,
	maxMana,
	mitigate,
	type CombatBonus,
} from '../../src/lib/combat';
import { effectiveStats } from '../../src/lib/effectiveStats';
import { healAmount } from '../../src/lib/skills';
import { merchantCombat } from '../../src/utils/game/merchant';
import { playerProfile } from '../../src/lib/offline/profile';
import { fullSet, simSetup } from '../../scripts/fightSim';
import { runCombat } from '../../src/lib/offline/fight';
import { weaponDps } from '../../src/catalog/weapons';
import type { CharacterStats, Equipment, EquipmentSlot, ItemInstance } from '../../src/types/game';

type Attrs = Partial<Pick<CharacterStats, 'strength' | 'dexterity' | 'intelligence' | 'vitality' | 'charisma'>>;

// ---------------------------------------------------------------------------
// Independent item oracle

const LEVEL_SHARE: Record<string, number> = {
	critChance: 0.3,
	superCrit: 0.3,
	dodge: 0.3,
	lifeLeech: 0.3,
	regen: 0.6,
	luck: 0.5,
	goldFind: 0.5,
	manaRegen: 0.5,
	maxMana: 0.7,
	spellPower: 0.4,
};
const INTEGER_STATS = new Set(['damage', 'armor', 'maxHp', 'luck', 'maxMana']);
const TIER1: Record<string, number> = {
	damage: 6,
	armor: 1,
	maxHp: 3,
	critChance: 1,
	superCrit: 0.5,
	regen: 0.2,
	luck: 1,
	goldFind: 2,
	dodge: 1,
	maxMana: 8,
	manaRegen: 0.2,
	spellPower: 4,
	lifeLeech: 0.5,
};
const roundStat = (key: string, v: number) => (!v ? 0 : INTEGER_STATS.has(key) ? Math.max(1, Math.round(v)) : round2(v));
const factor = (key: string, ratio: number) => 1 + (ratio - 1) * (LEVEL_SHARE[key] ?? 1);

const gearItems = ITEMS.filter((i) => i.slot);
const levelsFor = (min: number, max: number) => [...new Set([min, 1, 10, 50, 100].map((l) => clamp(l, min, max)))];

test('item stats: every gear base at several levels and qualities matches 1 + 0.07 x (level - 1), the stat level shares and the quality spread', () => {
	let checked = 0;
	for (const def of gearItems) {
		const min = def.minItemLevel ?? 1;
		const rarityId = def.fixedRarity ?? def.allowedRarities?.[0] ?? 'common';
		for (const level of levelsFor(min, def.maxItemLevel ?? 100))
			for (const quality of [0, 25, 50, 75, 100]) {
				const inst: ItemInstance = { base: def.id, level, rarity: rarityId, quality, affixes: [] };
				const got = resolveItem(inst)!.stats;
				const ratio = o.levelScale(level) / o.levelScale(min);
				for (const [key, authored] of Object.entries(def.stats ?? {})) {
					const want = roundStat(key, (authored as number) * factor(key, ratio) * o.quality(quality));
					assert.equal((got as Record<string, number>)[key], want, `${def.id} L${level} q${quality} ${key}`);
					checked++;
				}
			}
	}
	assert.ok(checked > 1000, `only ${checked} stat values were checked`);
});

test('item stats: an item at its authored level and quality 50 returns its authored numbers exactly, and every rarity multiplier is 1', () => {
	const noisy: string[] = [];
	for (const def of gearItems) {
		const got = resolveItem(plainItem(def.id))!.stats as Record<string, number>;
		for (const [key, authored] of Object.entries(def.stats ?? {})) {
			assert.equal(got[key], round2(authored as number), `${def.id} ${key}`);
			if (round2(authored as number) !== authored) noisy.push(`${def.id}:${key}=${authored}`);
		}
	}
	// FINDING (cosmetic): one authored value carries floating point noise (0.1 + 0.2 style). The resolved item is clean (rounded to 2 places),
	// but the catalog literal is not. This list pins it so a new one is noticed.
	assert.deepEqual(noisy, ['apprentice_tome:manaRegen=0.30000000000000004']);
	for (const rarity of Object.values(RARITIES)) assert.equal(rarity.statMultiplier, 1, `${rarity.id} must not scale base stats`);
});

test('affixes: each affix at levels 1..100 and rolls 0..100 = tier-1 base x level factor x power x roll range', () => {
	for (const affix of AFFIXES) {
		for (const level of [1, 5, 10, 25, 50, 100])
			for (const roll of [0, 25, 50, 75, 100]) {
				const inst: ItemInstance = { base: 'wooden_sword', level, rarity: 'rare', quality: 50, affixes: [{ id: affix.id, roll }] };
				const resolved = resolveItem(inst)!;
				const lo = affix.roll[0];
				const hi = affix.roll[1];
				const want = roundStat(affix.stat, TIER1[affix.stat] * factor(affix.stat, o.levelScale(level)) * affix.power * (lo + (hi - lo) * (roll / 100)));
				assert.equal(resolved.affixes[0].value, want, `${affix.id} L${level} roll ${roll}`);
				// the stat on the item is the base's own plus the affix, rounded to 2 places
				const base = baseStatsAt(ITEM_CATALOG.wooden_sword, level, 50, RARITIES.rare);
				near(resolved.stats[affix.stat as StatKey] ?? 0, round2((base[affix.stat as StatKey] ?? 0) + want), `${affix.id} sum`);
			}
	}
	assert.equal(AFFIX_CATALOG.damage_prefix.stat, 'damage');
});

test("MISMATCH 5 (design question): affixes grow with the ABSOLUTE item level, base stats with level relative to the base's own minimum", () => {
	const high = gearItems.find((d) => (d.minItemLevel ?? 1) >= 20);
	if (!high) return; // no such base in the catalog: nothing to compare
	const min = high.minItemLevel ?? 1;
	const inst: ItemInstance = { ...plainItem(high.id), rarity: 'rare', affixes: [{ id: 'maxHp_prefix', roll: 50 }] };
	const affix = resolveItem(inst)!.affixes[0].value;
	// the same affix on a level-1 item of that stat is worth much less than on this base: the affix does NOT divide by levelScale(min)
	const atOne = resolveItem({ ...inst, level: 1, base: 'wooden_sword' })!.affixes[0].value;
	assert.ok(affix > atOne * (o.levelScale(min) * 0.9), `affix on a level ${min} base (${affix}) vs level 1 (${atOne})`);
});

// ---------------------------------------------------------------------------
// Sets

const SET_TOTALS: Record<string, Partial<Record<StatKey, number>>> = {
	obsidian: {
		incomePct: 26,
		maxHp: 60,
		xpPct: 25,
		goldFind: 30,
		armor: 16,
		killRewardPct: 37,
		damage: 5,
		luck: 3,
		offlineEff: 15,
		clickPct: 10,
		offlineCapHours: 3,
		superCrit: 6,
	},
	rattatui: {
		maxHp: 25,
		armor: 3,
		damagePct: 35,
		critChance: 4,
		maxHpPct: 25,
		lifeLeech: 3,
		goldFind: 10,
		superCrit: 8,
		regen: 2,
		luck: 5,
		killRewardPct: 10,
		xpPct: 10,
	},
};

test('sets: every threshold applies and adds up (2 / 4 / 6 / 9 / 12-13 pieces), checked at every possible piece count', () => {
	for (const set of Object.values(SETS)) {
		for (let count = 0; count <= set.size + 1; count++) {
			const want: Record<string, number> = {};
			for (const [threshold, bonus] of Object.entries(set.bonuses)) {
				if (count >= Number(threshold)) for (const [k, v] of Object.entries(bonus)) want[k] = (want[k] ?? 0) + (v as number);
			}
			const got = setBonusStats({ [set.id]: count }) as Record<string, number>;
			for (const key of Object.keys(STAT_DEFS)) near(got[key], want[key] ?? 0, `${set.id} x${count} ${key}`);
		}
	}
});

test('sets: the full-set totals are the ones in the design, and both rings count', () => {
	assert.equal(SETS.obsidian.size, 12);
	assert.equal(SETS.rattatui.size, 13);
	assert.deepEqual(Object.keys(SETS).sort(), ['obsidian', 'rattatui'].sort());
	for (const id of Object.keys(SET_TOTALS)) {
		const eq = fullSet(id);
		assert.equal(setCounts(eq)[id], SETS[id].size, `${id}: both rings must count`);
		const bonus = setBonusStats(setCounts(eq)) as Record<string, number>;
		for (const [key, value] of Object.entries(SET_TOTALS[id])) near(bonus[key], value!, `${id} ${key}`);
	}
});

test('aggregateStats = sum of every worn item + the set bonus (no rounding, no double count), for a full set and a half set', () => {
	for (const id of Object.keys(SET_TOTALS)) {
		const full = fullSet(id);
		const half: Equipment = Object.fromEntries(Object.entries(full).slice(0, 6)) as Equipment;
		for (const eq of [full, half]) {
			const want: Record<string, number> = {};
			for (const item of Object.values(eq)) for (const [k, v] of Object.entries(ITEM_CATALOG[item!.base].stats ?? {})) want[k] = (want[k] ?? 0) + (v as number);
			for (const [k, v] of Object.entries(setBonusStats(setCounts(eq)))) want[k] = (want[k] ?? 0) + v;
			const got = aggregateStats(eq) as unknown as Record<string, number>;
			for (const key of Object.keys(STAT_DEFS)) near(got[key], want[key] ?? 0, `${id} ${key}`);
		}
	}
});

// ---------------------------------------------------------------------------
// Strict combat environment

const PLAIN: Equipment = { mainHand: plainItem('wooden_sword'), offHand: plainItem('wooden_shield') };
const flat = (eq: Equipment, key: StatKey) =>
	Object.values(eq).reduce((sum, item) => sum + ((ITEM_CATALOG[item!.base].stats as Record<string, number> | undefined)?.[key] ?? 0), 0);
const NO_BONUS: CombatBonus = { atkSpeedPct: 0, critPct: 0, superCritPct: 0, physPct: 0, magicPct: 0, leechPct: 0, regen: 0 };
const ATTRS: Attrs[] = [
	{},
	{ strength: 20 },
	{ dexterity: 30 },
	{ intelligence: 40 },
	{ vitality: 25 },
	{ charisma: 35 },
	{ strength: 50, dexterity: 50, intelligence: 50, vitality: 50, charisma: 50 },
];

test('strict start: a fresh character with the starter kit has 101 HP, 1.25 s-ish swings and no attribute bonus', () => {
	const c = character();
	assert.equal(maxHp(c, PLAIN), Math.round(85 + 5 * 3 + 5 * 0.25 + flat(PLAIN, 'maxHp')));
	assert.equal(maxHp(c, PLAIN), 101);
	assert.equal(damagePerHit(PLAIN, c), round1(flat(PLAIN, 'damage')));
	assert.equal(attacksPerSecond(PLAIN, c), 1.2, 'wooden sword = a sword: 1.2 attacks per second');
	assert.equal(attacksPerSecond({}, c), 1, 'bare hands swing at 1');
	assert.equal(damagePerHit({}, c), 1, 'bare hands never do less than 1');
});

test('damage: flat gear damage x (1 + attribute% + merchant%) x (1 + set damage %), rounded to 1 decimal; Str for melee, Int for staff/wand', () => {
	for (const attrs of ATTRS)
		for (const might of [0, 3, 8]) {
			const c = character(attrs);
			const bonus: CombatBonus = { ...NO_BONUS, physPct: might * 2 };
			const want = Math.max(1, round1(flat(PLAIN, 'damage') * (1 + (o.physicalPct(c.strength) + might * 2) / 100)));
			assert.equal(damagePerHit(PLAIN, c, bonus), want, `${JSON.stringify(attrs)} Might ${might}`);
		}
	const staff = ITEMS.find((i) => i.weaponType === 'staff' && i.slot === 'mainHand')!;
	const wand = ITEMS.find((i) => i.weaponType === 'wand' && i.slot === 'mainHand')!;
	for (const weapon of [staff, wand])
		for (const attrs of ATTRS) {
			const c = character(attrs);
			const eq: Equipment = { mainHand: plainItem(weapon.id) };
			const want = Math.max(1, round1(flat(eq, 'damage') * (1 + (o.magicPct(c.intelligence) + 6) / 100)));
			assert.equal(damagePerHit(eq, c, { ...NO_BONUS, magicPct: 6 }), want, `${weapon.id} ${JSON.stringify(attrs)}`);
			assert.equal(
				damagePerHit(eq, c, { ...NO_BONUS, physPct: 99 }),
				Math.max(1, round1(flat(eq, 'damage') * (1 + o.magicPct(c.intelligence) / 100))),
				'Might never boosts a magic weapon',
			);
		}
	// the set's percent damage is its own multiplicative bucket
	// the full Rattatui set includes its own weapon: swapping it for another weapon drops the piece count to 12 and the 13-piece bonus with it
	const rat = fullSet('rattatui');
	const c = character({ strength: 15 });
	const gear = aggregateStats(rat);
	assert.equal(setCounts(rat).rattatui, 13);
	assert.equal(gear.damagePct, 35);
	assert.equal(aggregateStats(fullSet('rattatui', 'wooden_sword')).damagePct, 20, 'replacing the set weapon loses the 13-piece damage bonus');
	assert.equal(damagePerHit(rat, c), Math.max(1, round1(gear.damage * (1 + o.physicalPct(15) / 100) * 1.35)));
});

test('attack speed: weapon speed table x (1 + Dex% + Swift%), rounded to 2 places; gear, level and quality never change it', () => {
	const table: Record<string, number> = { ...WEAPON_ATTACK_SPEED };
	assert.deepEqual({ ...table }, { dagger: 1.6, wand: 1.3, sword: 1.2, spear: 1.1, bow: 1, axe: 1, staff: 0.9, crossbow: 0.8, mace: 0.8, maul: 0.6 });
	const weapons = ITEMS.filter((i) => i.slot === 'mainHand' && i.weaponType && table[i.weaponType]);
	assert.ok(weapons.length >= 10);
	for (const w of weapons)
		for (const dex of [5, 15, 40])
			for (const swift of [0, 4, 16]) {
				const c = character({ dexterity: dex });
				const eq: Equipment = { mainHand: { ...plainItem(w.id), level: 60, quality: 100 } };
				assert.equal(
					attacksPerSecond(eq, c, { ...NO_BONUS, atkSpeedPct: swift }),
					round2(table[w.weaponType!] * (1 + (o.atkSpeedPct(dex) + swift) / 100)),
					`${w.id} dex ${dex} swift ${swift}`,
				);
			}
	const c = character({ dexterity: 20 });
	assert.equal(damagePerSecond(PLAIN, c), round2(damagePerHit(PLAIN, c) * attacksPerSecond(PLAIN, c)));
});

test('crit: (Dex x 0.25 + Cha x 0.5, FULL values) + gear + Keen, capped at 75 %; super crit 5 % + gear + Deadly, capped at 50 %', () => {
	for (const attrs of ATTRS)
		for (const keen of [0, 4, 8, 40])
			for (const deadly of [0, 4, 8, 60]) {
				const c = character(attrs);
				const odds = critOdds(c, PLAIN, { ...NO_BONUS, critPct: keen, superCritPct: deadly });
				near(
					odds.crit,
					clamp(c.dexterity * 0.25 + c.charisma * 0.5 + flat(PLAIN, 'critChance') + keen, 0, 75) / 100,
					`crit ${JSON.stringify(attrs)} keen ${keen}`,
				);
				near(odds.superCrit, clamp(5 + flat(PLAIN, 'superCrit') + deadly, 0, 50) / 100, `super ${deadly}`);
			}
	near(critOdds(character(), {}).crit, 0.0375, 'a fresh character crits 3.75 % (the attributes count in full, not above 5)');
});

test('armor: gear + 0.5 per Dex and Vit above 5 + 0.25 per Str above 5; reduction a/(a+40) up to 50 %, then half as steep (asymptote 75 %)', () => {
	for (const attrs of ATTRS) {
		const c = character(attrs);
		const want = flat(PLAIN, 'armor') + o.attrArmor({ dex: c.dexterity, vit: c.vitality, str: c.strength });
		near(armorOf(PLAIN, c), want, `armor ${JSON.stringify(attrs)}`);
	}
	for (const armor of [-5, 0, 1, 10, 40, 41, 80, 200, 1000, 100000]) {
		near(armorReduction(armor), o.armorReduction(armor), `reduction at ${armor}`);
		for (const raw of [1, 7, 100, 1234])
			assert.equal(mitigate(raw, armor), Math.max(1, Math.round(raw * (1 - o.armorReduction(armor)))), `mitigate ${raw} at ${armor}`);
	}
	assert.ok(armorReduction(1e9) < 0.75 && armorReduction(1e9) > 0.7499);
	assert.equal(armorReduction(40), 0.5, 'armor 40 = exactly the soft cap');
});

/** Fills all 13 slots with a base that fits it, each carrying the same affix at item level 100 and roll 100. */
const stacked = (affixId: string): Equipment => {
	const eq: Equipment = {};
	const slots = [...EQUIPMENT_LAYOUT.left, ...EQUIPMENT_LAYOUT.right, ...EQUIPMENT_LAYOUT.bottom];
	for (const slot of slots) {
		const def = ITEMS.find((i) => i.slot === (slot === 'ring1' || slot === 'ring2' ? 'ring' : slot) && !i.set)!;
		eq[slot as EquipmentSlot] = { base: def.id, level: 100, rarity: def.fixedRarity ?? 'rare', quality: 50, affixes: [{ id: affixId, roll: 100 }] };
	}
	return eq;
};

test('caps: Dodge 40 %, Life Leech 15 %, Crit 75 %, Super Crit 50 % hold however much gear stacks', () => {
	const c = character();
	const dodge = stacked('dodge_prefix');
	assert.ok(aggregateStats(dodge).dodge > 40, 'the test gear must overshoot the cap');
	assert.equal(dodgeChance(dodge), 0.4);
	const leech = stacked('lifeLeech_prefix');
	assert.ok(aggregateStats(leech).lifeLeech > 15);
	assert.equal(lifeLeechPercent(leech), 15);
	assert.equal(lifeLeechPercent(leech, { ...NO_BONUS, leechPct: 3 }), 15, 'Fang cannot lift it past the cap either');
	const crit = stacked('critChance_prefix');
	assert.ok(aggregateStats(crit).critChance > 75);
	assert.equal(critOdds(c, crit).crit, 0.75);
	// FINDING: 13 slots of level-100 Deadly affixes reach only ~33 % (5 base + 28 gear), so the 50 % super crit cap is out of reach for
	// gear alone; it can only be passed with the merchant's Deadly (+8) and the sets (+6, +8) on top. The clamp itself still holds:
	const sup = stacked('superCrit_prefix');
	assert.ok(aggregateStats(sup).superCrit + 5 < 50, 'gear alone stays under the super crit cap');
	assert.equal(critOdds(c, sup, { ...NO_BONUS, superCritPct: 60 }).superCrit, 0.5, 'but the clamp holds when something does overshoot');
	assert.equal(dodgeChance({}), 0);
});

test('max HP: (85 + 3 per Vit + 0.25 per Cha + gear) x (1 + set Max HP %), rounded once at the end', () => {
	for (const attrs of ATTRS) {
		const c = character(attrs);
		assert.equal(maxHp(c, PLAIN), Math.round(85 + c.vitality * 3 + c.charisma * 0.25 + flat(PLAIN, 'maxHp')), JSON.stringify(attrs));
	}
	const rat = fullSet('rattatui');
	const gear = aggregateStats(rat);
	assert.equal(gear.maxHpPct, 25);
	const c = character({ vitality: 40 });
	assert.equal(maxHp(c, rat), Math.round((85 + 40 * 3 + 1.25 + gear.maxHp) * 1.25));
});

test('mana and regen: 20 + 4 per Int and 0.5 + 0.05 per Int (FULL Int), plus gear; Heal = 25 % of max HP x (1 + magic %) x (1 + Spell Power %)', () => {
	for (const attrs of ATTRS) {
		const c = character(attrs);
		assert.equal(maxMana(c, PLAIN), Math.round(o.attrMana(c.intelligence) + flat(PLAIN, 'maxMana')));
		near(manaRegenPerSec(c, PLAIN), o.attrManaRegen(c.intelligence) + flat(PLAIN, 'manaRegen'), 'mana regen');
		const gear = aggregateStats(PLAIN);
		assert.equal(
			healAmount(c, PLAIN),
			Math.max(1, Math.round(maxHp(c, PLAIN) * 0.25 * (1 + o.magicPct(c.intelligence) / 100) * (1 + gear.spellPower / 100))),
			'heal',
		);
	}
});

// ---------------------------------------------------------------------------
// Display versus engine

const merchantSets: Record<string, number>[] = [{}, { might: 8, swift: 8, keen: 8, deadly: 8, fang: 6, wind: 6 }, { arcana: 8, swift: 3 }];

test('display parity: the character window (effectiveStats) and the server profile (playerProfile) agree on every shared number', () => {
	for (const attrs of ATTRS)
		for (const merchant of merchantSets)
			for (const equipment of [{}, PLAIN, fullSet('obsidian', 'wooden_sword'), fullSet('rattatui', 'wooden_sword')] as Equipment[]) {
				const c = character(attrs);
				const ui = effectiveStats({ characterStats: c, equipment, merchantUpgrades: merchant });
				const server = playerProfile({
					characterStats: { strength: c.strength, dexterity: c.dexterity, intelligence: c.intelligence, vitality: c.vitality, charisma: c.charisma },
					equipment,
					merchantUpgrades: merchant,
					resources: { xp: 0 },
				});
				const tag = `${JSON.stringify(attrs)} ${JSON.stringify(merchant)}`;
				assert.equal(server.maxHp, ui.maxHp, `maxHp ${tag}`);
				assert.equal(server.maxMp, ui.maxMana, `mana ${tag}`);
				assert.equal(server.hit, ui.damage, `damage ${tag}`);
				assert.equal(server.attacksPerSec, ui.attacksPerSecond, `speed ${tag}`);
				assert.equal(server.armor, ui.armor, `armor ${tag}`);
				near(server.dodge * 100, ui.dodge, `dodge ${tag}`);
				near(server.crit * 100, ui.critChance, `crit ${tag}`);
				near(server.superCrit * 100, ui.superCritChance, `super ${tag}`);
				assert.equal(server.leechPct, ui.lifeLeech, `leech ${tag}`);
				near(server.critExtra * 2, ui.critMultiplier, `crit multiplier ${tag}`);
				near(server.mpRegen, ui.manaRegen, `mana regen ${tag}`);
				// MISMATCH 3 (IDL-170, now labelled): the window shows the out-of-fight regen (1 HP/s base); a fight runs on gear + Wind only. The Regen tooltip says so
				near(ui.hpRegen - server.hpRegen, 1, `the window's HP regen is exactly the 1/s out-of-fight base above the fight's ${tag}`);
			}
});

test('MISMATCH 4 (IDL-170, now labelled "Weapon damage per second"): the item tooltip figure is weapon damage x speed only; the character\'s real DPS includes attributes and merchant bonuses', () => {
	const sword = ITEM_CATALOG.wooden_sword;
	const eq: Equipment = { mainHand: plainItem('wooden_sword') };
	const plain = character();
	near(weaponDps(sword), damagePerSecond(eq, plain), 'at 5 Str the two agree');
	const strong = character({ strength: 45, dexterity: 25 });
	const real = damagePerSecond(eq, strong, merchantCombat({ might: 8, swift: 8 }));
	assert.ok(real > weaponDps(sword) * 1.5, `real ${real} vs tooltip ${weaponDps(sword)}`);
});

test('engine parity: the profile a fight freezes at its start equals the server profile, and the swing rate is hit x attacks per second', () => {
	const equipment = PLAIN;
	const c = character({ strength: 12, dexterity: 14 });
	const { ledger, env, start } = simSetup({ equipment, character: c, monsters: [{ type: 'thistleBoar', level: 1 }], seed: 'audit' });
	const core = {
		equipment,
		characterStats: { strength: 12, dexterity: 14, intelligence: 5, vitality: 5, charisma: 5 },
		level: { level: 1, progress: 0 },
		bag: [],
	};
	const started = runCombat(ledger, env(start), { autoUse: false, commands: [{ kind: 'fight', n: 1 }] }).ledger;
	const frozen = started.combat!.fight!.profile;
	const server = playerProfile(core);
	assert.equal(frozen.hit, server.hit);
	assert.equal(frozen.attacksPerSec, server.attacksPerSec);
	assert.equal(frozen.armor, server.armor);
	assert.equal(frozen.maxHp, server.maxHp);
	assert.equal(frozen.hit, damagePerHit(equipment, c));
	assert.equal(frozen.attacksPerSec, attacksPerSecond(equipment, c));
});
