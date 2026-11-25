import assert from 'node:assert/strict';
import test from 'node:test';
import { COMBAT } from '../../src/config/combatConfig';
import { STARTER_EQUIPMENT } from '../../src/config/itemCatalog';
import { simSetup } from '../../src/lib/fightSim';
import { runCombat } from '../../src/lib/offline/fight';
import type { Ledger } from '../../src/lib/offline/ledger';
import { playerProfile } from '../../src/lib/offline/profile';
import { estimateWin } from '../../src/lib/offline/winChance';
import { plainItem } from '../../src/lib/itemInstance';
import { STRONG_KIT } from '../builders';
import type { Equipment } from '../../src/types/game';

// IDL-176: the four combat stats of the gear (Crit Damage, Armor Penetration, Thorns, Heal on Kill) reach the fight's frozen profile and are applied inside the fight engine.
// Each is absent from the profile when no gear carries it, so a fight without them is exactly the fight there was before.

(COMBAT.auto as { minWinChance: number }).minWinChance = 0;

const core = (equipment: Equipment) => ({ equipment, characterStats: { availablePoints: 0 }, level: { level: 1, progress: 0 }, bag: [] }) as never;

test('the profile carries each stat only when the gear has it, and the gear total is capped', () => {
	const ring = (affix: string): Equipment => ({
		...STARTER_EQUIPMENT,
		ring1: { ...plainItem('skull_ring'), level: 100, rarity: 'rare', affixes: [{ id: affix, roll: 100 }] },
	});
	const plain = playerProfile(core(STARTER_EQUIPMENT));
	for (const key of ['armorPenPct', 'thornsPct', 'healOnKillPct']) assert.equal(key in plain, false, `${key} is absent without gear`);
	const pen = playerProfile(
		core({ ...STARTER_EQUIPMENT, mainHand: { ...plainItem('wooden_sword'), level: 100, rarity: 'rare', affixes: [{ id: 'armorPen_prefix', roll: 100 }] } }),
	);
	assert.ok(pen.armorPenPct! > 0 && pen.armorPenPct! <= 30);
	assert.ok(playerProfile(core(ring('healOnKill_prefix'))).healOnKillPct! > 0);
	assert.ok(playerProfile(core(ring('critDamage_prefix'))).critExtra > plain.critExtra, 'Crit Damage raises the crit multiplier');
});

/** Opens one fight and returns the ledger with the fight open (the profile frozen into it is replaced by `profile`). */
const openFight = (profile: Record<string, number>, type = 'thistleBoar', level = 40) => {
	const s = simSetup({ equipment: STRONG_KIT, monsters: [{ type: type as never, level }], seed: 'gear-stats' });
	let ledger: Ledger = s.ledger;
	for (let t = 1; t <= 30 && !ledger.combat!.fight; t++) ledger = runCombat(ledger, s.env(s.start + t), {}).ledger;
	assert.ok(ledger.combat!.fight, 'a fight opened');
	const fight = ledger.combat!.fight!;
	ledger = { ...ledger, combat: { ...ledger.combat!, fight: { ...fight, profile: { ...fight.profile, ...profile } } } };
	return { s, ledger, at: ledger.combat!.at };
};

/** The same fight with and without `profile`, stepped second by second: the monster's HP after each step, and the hero's HP. */
const race = (profile: Record<string, number>, steps = 4) => {
	const a = openFight(profile);
	const b = openFight({});
	let la = a.ledger;
	let lb = b.ledger;
	for (let i = 1; i <= steps && la.combat!.fight && lb.combat!.fight; i++) {
		la = runCombat(la, a.s.env(Math.ceil(a.at) + i), {}).ledger;
		lb = runCombat(lb, b.s.env(Math.ceil(b.at) + i), {}).ledger;
	}
	return { withStat: la, without: lb };
};

test('Armor Penetration: the same swings leave the monster with less HP, and the win estimate rises', () => {
	const { withStat, without } = race({ armorPenPct: 30 });
	const fa = withStat.combat!.fight;
	const fb = without.combat!.fight;
	if (fa && fb) assert.ok(fa.monsterHp < fb.monsterHp, `less HP left (${fa.monsterHp} vs ${fb.monsterHp})`);
	else assert.ok(!fa, 'or the penetrating one already killed it');
	const base = openFight({}).ledger.combat!.fight!;
	const withPen = estimateWin({ ...base.profile, armorPenPct: 30 }, base.profile.maxHp, base.type, base.level);
	const noPen = estimateWin(base.profile, base.profile.maxHp, base.type, base.level);
	assert.ok(withPen.killSec <= noPen.killSec, 'the estimate counts the penetration');
});

test('Thorns: a monster that hits the hero takes a share of it back', () => {
	const { withStat, without } = race({ thornsPct: 25 }, 6);
	const fa = withStat.combat!.fight;
	const fb = without.combat!.fight;
	if (fa && fb) assert.ok(fa.monsterHp < fb.monsterHp, `the thorned monster has less HP left (${fa.monsterHp} vs ${fb.monsterHp})`);
	else assert.ok(!fa, 'or it is already dead');
});

test('Heal on Kill: the hero comes out of a kill with a share of max HP more', () => {
	const run = (pct: number) => {
		const f = openFight({ healOnKillPct: pct, hit: 1e9 }, 'thistleBoar', 1);
		const hurt: Ledger = { ...f.ledger, combat: { ...f.ledger.combat!, hp: 40 } };
		const out = runCombat(hurt, f.s.env(Math.ceil(f.at) + 1), {}).ledger;
		return { hp: out.combat!.hp, maxHp: f.ledger.combat!.fight!.profile.maxHp, won: out.combat!.fight === null };
	};
	const none = run(0);
	const heal = run(8);
	assert.ok(none.won && heal.won, 'the weak monster died to the huge hit');
	assert.ok(Math.abs(heal.hp - none.hp - (heal.maxHp * 8) / 100) < 0.01 || heal.hp === heal.maxHp, `${heal.hp} vs ${none.hp}`);
	assert.ok(heal.hp > none.hp);
});
