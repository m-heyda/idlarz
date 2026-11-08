import assert from 'node:assert/strict';
import test from 'node:test';
import { COMBAT } from '../../src/config/combatConfig';
import { STARTER_EQUIPMENT } from '../../src/config/itemCatalog';
import { effectiveStats } from '../../src/lib/effectiveStats';
import { INITIAL_CHARACTER_STATS } from '../../src/config/character';
import { simSetup } from '../../src/lib/fightSim';
import { potionCooldownSec, potionIndexOfKey, potionPower, potionSlotCount } from '../../src/lib/beltEffects';
import { addGear, emptyBag, equipFromBag, gearBagSlots, unequip } from '../../src/lib/inventory';
import { plainItem } from '../../src/lib/itemInstance';
import { runCombat } from '../../src/lib/offline/fight';
import { playerProfile } from '../../src/lib/offline/profile';
import { LADDER } from '../../src/catalog/items/ladder';
import { estimateWin } from '../../src/lib/offline/winChance';
import type { Equipment } from '../../src/types/game';

// Auto-battle's win-chance gate is tested in winChance.test.ts; here the player fights whatever is put in front of them (each test file is its own process).
(COMBAT.auto as { minWinChance: number }).minWinChance = 0;

// The belt stats (IDL-138/139), each through the pipeline: the item -> the totals (effectiveStats) -> the server profile -> the fight engine.

const belt = (grade: keyof typeof LADDER): Equipment => ({ ...STARTER_EQUIPMENT, belt: { ...plainItem(LADDER[grade].belt!), rarity: 'rare' } });

test('potion cooldown: a belt shortens the shared cooldown, nothing goes under the floor', () => {
	assert.equal(potionCooldownSec(STARTER_EQUIPMENT), COMBAT.potionCooldownSec);
	assert.equal(potionCooldownSec(belt('G6')), COMBAT.potionCooldownSec * 0.75);
	assert.equal(potionCooldownSec(belt('G9')), COMBAT.potionCooldownMinSec, 'the best belts sit on the 4 s floor');
	assert.equal(potionCooldownSec(belt('S1')), COMBAT.potionCooldownMinSec);
	assert.equal(effectiveStats({ characterStats: INITIAL_CHARACTER_STATS as never, equipment: belt('G6') }).potionCooldownSec, 6);
});

test('potion power and slots: more healing per potion, more hotkey slots, and the keys that reach them', () => {
	assert.equal(potionPower(STARTER_EQUIPMENT), 1);
	assert.equal(potionPower(belt('G9')), 1.24);
	assert.equal(potionSlotCount(STARTER_EQUIPMENT), 3);
	assert.equal(potionSlotCount(belt('G5')), 4);
	assert.equal(potionSlotCount(belt('G9')), 5);
	assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(potionIndexOfKey), [0, 1, 2, -1, -1, 3, 4], '4 and 5 stay the skills');
});

test('the server profile carries the belt: the fight drinks with its cooldown and heals more, and the win estimate counts it', () => {
	const core = (equipment: Equipment) => ({ equipment });
	assert.equal(playerProfile(core(belt('G9'))).potionCooldownSec, COMBAT.potionCooldownMinSec);
	assert.equal(playerProfile(core(STARTER_EQUIPMENT)).potionPower, 1);

	const drinkWith = (equipment: Equipment) => {
		const s = simSetup({ equipment, potions: [{ id: 'potion_minor', qty: 2 }], monsters: [{ type: 'bossGreatAuroch', level: 15 }], seed: 'engine' });
		const ledger = runCombat(s.ledger, s.env(s.start), { autoUse: false }).ledger;
		const hurt = { ...ledger, combat: { ...ledger.combat!, hp: 40 } };
		const after = runCombat(hurt, s.env(s.start + 1), { commands: [{ kind: 'potion', id: 'potion_minor' }] }).ledger;
		const drunk = after.combat!.log.find((e) => e.kind === 'potion')!;
		return { healed: drunk.amount!, cooldown: after.combat!.cd.potion };
	};
	const plain = drinkWith(STARTER_EQUIPMENT);
	const belted = drinkWith(belt('G9'));
	assert.equal(plain.healed, 35);
	assert.equal(belted.healed, Math.round(35 * 1.24), 'potion power');
	assert.ok(plain.cooldown > COMBAT.potionCooldownSec - 1.5, `${plain.cooldown}`);
	assert.ok(belted.cooldown < COMBAT.potionCooldownMinSec + 0.1 && belted.cooldown < plain.cooldown, `${belted.cooldown}`);
	const chance = (equipment: Equipment) => {
		const p = playerProfile(core(equipment));
		return estimateWin(p, p.maxHp * 0.5, 'thistleBoar', 5, [{ healHp: 90, count: 5 }]);
	};
	assert.ok(chance(belt('G9')).surviveSec > chance(STARTER_EQUIPMENT).surviveSec, 'stronger and faster potions last longer');
});

test('bag slots: a belt grows the bag, and cannot come off while those slots hold something', () => {
	const worn = belt('G6');
	assert.equal(gearBagSlots(STARTER_EQUIPMENT), 0);
	assert.equal(gearBagSlots(worn), 2);
	const bag = addGear(emptyBag(), worn.belt!).bag;
	const on = equipFromBag(bag, STARTER_EQUIPMENT, 0)!;
	assert.equal(on.bag.length, COMBAT.bagSize + 2, 'two more slots');
	const off = unequip(on.bag, on.equipment, 'belt')!;
	assert.equal(off.bag.length, COMBAT.bagSize, 'and back');
	const full = on.bag.map((slot, i) => (i >= COMBAT.bagSize ? { item: plainItem('wooden_ring') } : slot));
	assert.equal(unequip(full, on.equipment, 'belt'), null, 'the extra slots are in use: the belt stays on');
	assert.equal(
		unequip(
			on.bag.map((s, i) => (i < COMBAT.bagSize ? { item: plainItem('wooden_ring') } : s)),
			on.equipment,
			'belt',
		),
		null,
		'no room for the belt itself',
	);
});
