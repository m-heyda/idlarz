import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT, STAT_RULES } from '../src/config/combatConfig';
import { INITIAL_CHARACTER_STATS } from '../src/config/gameConfig';
import { STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import {
	armorOf,
	attacksPerSecond,
	damageMultiplier,
	damagePerClick,
	damagePerSecond,
	leechHeal,
	lifeLeechPercent,
	manaRegenPerSec,
	maxHp,
	maxMana,
	rollHit,
	weaponDamageType,
} from '../src/lib/combat';
import { atkSpeedPercent, critDamagePercent, magicDamagePercent, physicalDamagePercent, statArmor, statManaRegen, statMaxMana } from '../src/lib/statBonuses';
import { plainItem } from '../src/lib/itemInstance';
import { calculateCombatStats, getStatDescription } from '../src/utils/gameUtils';
import { AFFIX_CATALOG } from '../src/catalog/affixes';
import { resolveItem } from '../src/lib/itemInstance';
import type { CharacterStats, Equipment, ItemInstance } from '../src/types/game';

const character = (over: Partial<CharacterStats> = {}): CharacterStats => {
	const stats = { ...INITIAL_CHARACTER_STATS, ...over };
	return Object.assign(stats, calculateCombatStats(stats));
};
const fresh = character();
const sword: Equipment = { mainHand: plainItem('wooden_sword') };
const staff: Equipment = { mainHand: plainItem('oak_staff') };
const wand: Equipment = { mainHand: plainItem('apprentice_wand') };

test('a fresh character has no attribute bonuses: it plays exactly like before the stat rework', () => {
	assert.equal(physicalDamagePercent(fresh), 0);
	assert.equal(magicDamagePercent(fresh), 0);
	assert.equal(statArmor(fresh), 0);
	assert.equal(critDamagePercent(fresh), 0);
	assert.equal(atkSpeedPercent(fresh), 0);
	assert.equal(damagePerClick(STARTER_EQUIPMENT, fresh), 6);
	assert.equal(armorOf(STARTER_EQUIPMENT, fresh), 2);
	assert.equal(maxHp(fresh, STARTER_EQUIPMENT), 101);
	assert.deepEqual(rollHit(fresh, STARTER_EQUIPMENT, () => 0), { damage: 6, crit: 'none' });
	assert.deepEqual(rollHit(fresh, STARTER_EQUIPMENT, (() => { let n = 0; return () => (n++ ? 0 : 0.999); })()), { damage: 6 * COMBAT.crit.mult, crit: 'crit' });
	assert.equal(fresh.physicalAtk, 0);
	assert.equal(fresh.magicAtk, 0);
	assert.equal(fresh.def, 0);
});

test('Strength adds 2% to physical weapon damage per point above 5, and nothing to magic weapons', () => {
	const strong = character({ strength: 15 });
	assert.equal(physicalDamagePercent(strong), 20);
	assert.equal(damageMultiplier(sword, strong), 1.2);
	assert.equal(damagePerClick(sword, strong), 7.2);
	assert.equal(damagePerClick(staff, strong), damagePerClick(staff, fresh), 'a staff ignores Strength');
	assert.equal(weaponDamageType({}), 'physical', 'bare hands are physical');
	assert.equal(damagePerClick({}, strong), 1, 'but they deal the flat 1 whatever the bonus');
});

test('Intelligence adds 2.4% to magic weapon damage per point above 5: 1.2x the physical rate, and nothing to physical weapons', () => {
	assert.equal(STAT_RULES.magicDamagePerIntelligence / STAT_RULES.physicalDamagePerStrength, 1.2);
	const wise = character({ intelligence: 15 });
	assert.equal(magicDamagePercent(wise), 24);
	assert.equal(damagePerClick(staff, wise), Math.round(8 * 1.24 * 10) / 10);
	assert.equal(damagePerClick(wand, wise), Math.round(5 * 1.24 * 10) / 10);
	assert.equal(damagePerClick(sword, wise), 6, 'a sword ignores Intelligence');
	assert.equal(weaponDamageType(staff), 'magic');
	assert.equal(weaponDamageType(wand), 'magic');
	assert.equal(weaponDamageType(sword), 'physical');
	assert.equal(weaponDamageType({ mainHand: plainItem('hunting_bow') }), 'physical');
});

test('at the same tier a magic weapon matches a melee weapon per second, so a mage with the same points is ahead by the rate', () => {
	const dps = (eq: Equipment, s: CharacterStats = fresh) => damagePerSecond(eq, s);
	assert.equal(dps(staff), dps(sword), 'staff 8 x 0.9 = sword 6 x 1.2');
	assert.ok(dps(wand) >= dps(sword) * 0.85, `the wand has crit and spell power on top: ${dps(wand)} vs ${dps(sword)}`);
	for (const points of [5, 10, 25, 50]) {
		const warrior = character({ strength: 5 + points });
		const mage = character({ intelligence: 5 + points });
		const edge = dps(staff, mage) / dps(sword, warrior);
		assert.ok(edge > 1 && edge <= 1.2, `${points} points: the mage is ahead by ${((edge - 1) * 100).toFixed(1)}%`);
	}
	const w = character({ strength: 30 });
	const m = character({ intelligence: 30 });
	assert.ok(dps(staff, m) / dps(sword, w) > 1.06, 'a level 30 build: magic is about 7% ahead on damage alone');
});

test('DEF is real: Dexterity and Vitality add 0.5 armor per point above 5, Strength 0.25, through the normal armor curve', () => {
	const tank = character({ vitality: 25, dexterity: 15, strength: 9 });
	assert.equal(statArmor(tank), 20 * 0.5 + 10 * 0.5 + 4 * 0.25);
	assert.equal(tank.def, statArmor(tank));
	assert.equal(armorOf(STARTER_EQUIPMENT, tank), 2 + 16);
	assert.equal(armorOf(STARTER_EQUIPMENT), 2, 'without attributes only the gear counts');
});

test('crit damage in fights follows Strength, Dexterity and Charisma above 5, on both the crit and the super crit', () => {
	const c = character({ strength: 15, dexterity: 15, charisma: 15 });
	assert.equal(critDamagePercent(c), 10 * 1 + 10 * 0.5 + 10 * 0.5);
	const roll = (s: CharacterStats, ...values: number[]) => {
		let i = 0;
		return rollHit({ ...s, critChance: 100 }, sword, () => values[i++] ?? 0.999);
	};
	const plain = roll(fresh, 0.999, 0);
	const boosted = roll(c, 0.999, 0);
	assert.equal(plain.damage, 6 * COMBAT.crit.mult);
	assert.ok(boosted.damage > plain.damage * 1.15 && boosted.crit === 'crit');
	const superFresh = roll(fresh, 0.999, 0.999);
	assert.equal(superFresh.damage, 6 * COMBAT.crit.superMult);
	assert.ok(roll(c, 0.999, 0.999).damage > superFresh.damage * 1.15);
});

test('mana: 20 + 4 per Intelligence, 0.5 + 0.05 per second per Intelligence, plus the gear', () => {
	assert.equal(statMaxMana(fresh), 40);
	assert.equal(statManaRegen(fresh), 0.75);
	assert.equal(maxMana(fresh, {}), 40);
	assert.equal(fresh.mp, 40);
	const wise = character({ intelligence: 25 });
	assert.equal(maxMana(wise, {}), 120);
	assert.equal(manaRegenPerSec(wise, {}), 1.75);
	const geared: Equipment = { mainHand: plainItem('oak_staff'), offHand: plainItem('apprentice_tome') };
	assert.equal(maxMana(fresh, geared), 40 + 8 + 8);
	assert.ok(Math.abs(manaRegenPerSec(fresh, geared) - (0.75 + 0.3)) < 1e-9);
});

test('life leech returns a share of the damage as HP, capped', () => {
	assert.equal(lifeLeechPercent({}), 0);
	assert.equal(leechHeal(10, sword), 0);
	// a Vampiric affix on a weapon: derived like every other affix value
	const vamp = AFFIX_CATALOG.lifeLeech_prefix;
	assert.ok(vamp && vamp.stat === 'lifeLeech' && vamp.minItemLevel >= 5);
	const dagger: ItemInstance = { base: 'steel_dagger', level: 30, rarity: 'uncommon', quality: 50, affixes: [{ id: 'lifeLeech_prefix', roll: 100 }] };
	const resolved = resolveItem(dagger)!;
	assert.ok(resolved.stats.lifeLeech! > 0 && resolved.stats.lifeLeech! < STAT_RULES.lifeLeechCap);
	const eq: Equipment = { mainHand: dagger };
	assert.equal(lifeLeechPercent(eq), resolved.stats.lifeLeech);
	assert.ok(Math.abs(leechHeal(100, eq) - resolved.stats.lifeLeech!) < 1e-9);
	// the cap: stack absurd leech on the gear and it stops at the cap
	const stacked: Equipment = { mainHand: dagger, head: { ...dagger, base: 'leather_cap', affixes: [] } };
	assert.ok(lifeLeechPercent(stacked) <= STAT_RULES.lifeLeechCap);
});

test('attacks per second: the weapon speed (1 bare-handed) times the Dexterity bonus; damage per second is the base of the later speed combat', () => {
	assert.equal(attacksPerSecond({}), 1);
	assert.equal(attacksPerSecond(sword), 1.2);
	assert.equal(attacksPerSecond({ mainHand: plainItem('steel_dagger') }), 1.6);
	const nimble = character({ dexterity: 25 });
	assert.equal(atkSpeedPercent(nimble), 5);
	assert.equal(attacksPerSecond(sword, nimble), 1.26);
	assert.equal(damagePerSecond(sword, fresh), 7.2);
	assert.equal(damagePerSecond(sword, character({ strength: 15, dexterity: 25 })), Math.round(7.2 * 1.2 * 1.05 * 100) / 100);
});

test('the tooltips are built from the same constants the maths uses', () => {
	const strength = getStatDescription('strength');
	assert.ok(strength.includes(`+${STAT_RULES.physicalDamagePerStrength}% damage with physical weapons per point above ${STAT_RULES.base}`));
	assert.ok(strength.includes(`+${STAT_RULES.armorPerStrength} DEF`));
	const intelligence = getStatDescription('intelligence');
	assert.ok(intelligence.includes(`+${STAT_RULES.magicDamagePerIntelligence}% damage with magic weapons`));
	assert.ok(intelligence.includes(`+${STAT_RULES.mana.perIntelligence} Max Mana`));
	assert.ok(getStatDescription('dexterity').includes(`+${STAT_RULES.atkSpeedPerDexterity}% ATK Speed`));
	assert.ok(getStatDescription('vitality').includes(`+${STAT_RULES.armorPerVitality} DEF`));
	assert.ok(!('magicDef' in character()), 'Magic DEF is gone: one DEF');
});

test('every listed effect has a reader: the derived values equal the functions the fight uses', () => {
	const c = character({ strength: 12, dexterity: 9, intelligence: 14, vitality: 8, charisma: 6 });
	assert.equal(c.physicalAtk, physicalDamagePercent(c));
	assert.equal(c.magicAtk, magicDamagePercent(c));
	assert.equal(c.def, statArmor(c));
	assert.equal(c.mp, statMaxMana(c));
	assert.equal(c.atkSpeedIncrease, atkSpeedPercent(c));
});
