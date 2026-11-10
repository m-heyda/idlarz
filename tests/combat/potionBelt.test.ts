import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_CATALOG, ITEM_STAT_KEYS } from '../../src/catalog';
import { INITIAL_CHARACTER_STATS } from '../../src/config/character';
import { calculateCombatStats } from '../../src/utils/game/character';
import { COMBAT } from '../../src/config/combatConfig';
import { HARD_LIMITS, LIMITS } from '../../src/config/limits';
import { STARTER_EQUIPMENT } from '../../src/config/itemCatalog';
import { aggregateStats } from '../../src/lib/inventory';
import { plainItem } from '../../src/lib/itemInstance';
import { limitOf } from '../../src/lib/limits';
import { effectiveStats } from '../../src/lib/effectiveStats';
import { simSetup } from '../../src/lib/fightSim';
import { runCombat } from '../../src/lib/offline/fight';
import { applyUse } from '../../src/lib/offline/consumables';
import { applyOp, beltSlotsFor, fitInventory, inventoryFromCore, rebirthInventory } from '../../src/lib/offline/inventory';
import { playerProfile } from '../../src/lib/offline/profile';
import { potionCooldownSec, potionPower, potionSlotCount } from '../../src/lib/potionBelt';
import type { ItemStats } from '../../src/catalog/stats';
import type { Equipment } from '../../src/types/game';

// IDL-153 / IDL-154: the potion belt. Only a belt carries these stats (a test belt here, the real ones are IDL-142), and they reach the fight through
// aggregateStats -> playerProfile -> the fight engine, and the bag through limitOf('bagSize').

(COMBAT.auto as { minWinChance: number }).minWinChance = 0;

const belt = (id: string, stats: ItemStats) => {
	ITEM_CATALOG[id] = {
		...ITEM_CATALOG.potion_minor,
		id,
		name: id,
		kind: 'armor',
		slot: 'belt',
		effects: undefined,
		stats,
		tier: 1,
		minItemLevel: 1,
		stackMax: undefined,
	} as never;
	return { ...STARTER_EQUIPMENT, belt: plainItem(id) } as Equipment;
};

const setup = (equipment: Equipment) =>
	simSetup({ equipment, potions: [{ id: 'potion_minor', qty: 5 }], monsters: [{ type: 'bossGreatAuroch', level: 15 }], seed: 'belt' });

/** Drinks one potion at 40 HP in a fight and returns the HP it healed and the cooldown it started. */
const drinkOnce = (equipment: Equipment) => {
	const s = setup(equipment);
	const start = runCombat(s.ledger, s.env(s.start), { autoUse: false }).ledger;
	const hurt = { ...start, combat: { ...start.combat!, hp: 40 } };
	const drunk = runCombat(hurt, s.env(s.start + 1), { commands: [{ kind: 'potion', id: 'potion_minor' }] }).ledger;
	const event = drunk.combat!.log.find((e) => e.kind === 'potion');
	return { healed: event?.amount ?? 0, cd: drunk.combat!.cd.potion };
};

test('the belt stats are belt-only: no affix or base stat table has them', () => {
	for (const key of ['potionCooldownPct', 'potionPowerPct', 'potionSlots', 'bagSlots']) assert.ok(!(ITEM_STAT_KEYS as string[]).includes(key), key);
});

test('potionCooldownPct shortens the shared potion cooldown and stops at the 4 s floor', () => {
	assert.equal(potionCooldownSec({ potionCooldownPct: 0 }), COMBAT.potionCooldownSec);
	assert.equal(potionCooldownSec({ potionCooldownPct: 25 }), COMBAT.potionCooldownSec * 0.75);
	assert.equal(potionCooldownSec({ potionCooldownPct: 90 }), COMBAT.potionCooldownMinSec);
	assert.equal(COMBAT.potionCooldownMinSec, 4);

	assert.equal(playerProfile(setup(STARTER_EQUIPMENT).stored.core as Record<string, unknown>).potionCooldownSec, COMBAT.potionCooldownSec);
	const fast = drinkOnce(belt('t_belt_cd', { potionCooldownPct: 25 }));
	assert.ok(Math.abs(fast.cd - COMBAT.potionCooldownSec * 0.75) < 0.3, `cooldown ${fast.cd}`);
	const floor = drinkOnce(belt('t_belt_floor', { potionCooldownPct: 80 }));
	assert.ok(Math.abs(floor.cd - COMBAT.potionCooldownMinSec) < 0.3, `floored cooldown ${floor.cd}`);
	const plain = drinkOnce(STARTER_EQUIPMENT);
	assert.ok(plain.cd > COMBAT.potionCooldownSec - 0.3, 'no belt: the old 8 s');
});

test('Auto-use follows the belt: it drinks again as soon as the shortened cooldown ends', () => {
	const run = (equipment: Equipment) => {
		const s = setup(equipment);
		let ledger = runCombat(s.ledger, s.env(s.start)).ledger;
		let drinks = 0;
		let last = ledger.combat!.eventNo;
		for (let t = 1; t <= 20; t++) {
			ledger = { ...ledger, combat: { ...ledger.combat!, hp: Math.min(ledger.combat!.hp, 20) } }; // keep it below the auto-use line
			ledger = runCombat(ledger, s.env(s.start + t)).ledger;
			drinks += ledger.combat!.log.filter((e) => e.no > last && e.kind === 'potion').length;
			last = ledger.combat!.eventNo;
		}
		return drinks;
	};
	assert.ok(run(belt('t_belt_auto', { potionCooldownPct: 50 })) > run(STARTER_EQUIPMENT));
});

test('potionPowerPct scales what a drunk potion heals (and is capped)', () => {
	assert.equal(potionPower({ potionPowerPct: 0 }), 1);
	assert.equal(potionPower({ potionPowerPct: 20 }), 1.2);
	assert.equal(potionPower({ potionPowerPct: 400 }), 1 + COMBAT.potionPowerMaxPct / 100);
	const plain = drinkOnce(STARTER_EQUIPMENT).healed;
	const strong = drinkOnce(belt('t_belt_power', { potionPowerPct: 20 })).healed;
	assert.ok(plain > 0);
	assert.equal(strong, Math.round(plain * 1.2));
});

test('the use operation (a potion from the bag) follows the belt too', () => {
	const s = setup(belt('t_belt_use', { potionCooldownPct: 25, potionPowerPct: 20 }));
	const inv = inventoryFromCore(s.stored.core as Record<string, unknown>);
	const index = inv.bag.findIndex((slot) => slot && 'id' in slot && slot.id === 'potion_minor');
	const base = runCombat({ ...s.ledger, inv }, s.env(s.start), { autoUse: false }).ledger;
	const hurt = { ...base, combat: { ...base.combat!, hp: 30 } };
	const used = applyUse(hurt, s.env(s.start + 1), index);
	assert.ok(used.ok);
	if (!used.ok) return;
	assert.ok(Math.abs(used.ledger.combat!.cd.potion - COMBAT.potionCooldownSec * 0.75) < 1e-9);
	const heal = ITEM_CATALOG.potion_minor.effects!.reduce((sum, e) => sum + (e.kind === 'healHp' ? e.amount : 0), 0);
	assert.ok(Math.abs(used.ledger.combat!.hp - 30 - heal * 1.2) < 1e-6);
});

test('potionSlots add potion stacks to the hotkey bar, up to the maximum', () => {
	assert.equal(potionSlotCount({ potionSlots: 0 }), COMBAT.potionBaseSlots);
	assert.equal(potionSlotCount({ potionSlots: 2 }), COMBAT.potionBaseSlots + 2);
	assert.equal(potionSlotCount({ potionSlots: 9 }), COMBAT.potionMaxSlots);
	const worn = belt('t_belt_slots', { potionSlots: 1 });
	const s = setup(worn);
	assert.equal(
		effectiveStats({ characterStats: { ...INITIAL_CHARACTER_STATS, ...calculateCombatStats(INITIAL_CHARACTER_STATS) }, equipment: worn }).potionSlots,
		COMBAT.potionBaseSlots + 1,
	);
	assert.equal(playerProfile(s.stored.core as Record<string, unknown>).potionSlots, COMBAT.potionBaseSlots + 1);
});

// ---------------------------------------------------------------------------------------------------- bag slots (IDL-154)

test('bagSlots of the worn belt grow the bag through limitOf, under the hard ceiling and with Pack Rat and Deep Pockets', () => {
	assert.equal(limitOf('bagSize', { beltSlots: 3 }), LIMITS.bagSize + 3);
	const everything = limitOf('bagSize', { beltSlots: 3, merchantUpgrades: { packrat: 12 }, prestige: { deeppockets: 3 } as never });
	assert.ok(everything <= HARD_LIMITS.bagSize);
	assert.equal(limitOf('bagSize', { beltSlots: 10_000 }), HARD_LIMITS.bagSize, 'never past the ceiling');
});

test('equip a belt: the bag grows; take it off: nothing is lost; a rebirth and the server fit keep the slots', () => {
	const worn = belt('t_belt_bag', { bagSlots: 2 });
	assert.equal(aggregateStats(worn).bagSlots, 2);
	const s = simSetup({ equipment: STARTER_EQUIPMENT, monsters: [], seed: 'bag' });
	const core = s.stored.core as Record<string, unknown>;
	let inv = inventoryFromCore(core);
	const size = inv.bag.length;
	inv = { ...inv, bag: [{ item: worn.belt! }, ...inv.bag.slice(1)] };
	const ctx = {};
	const equipped = applyOp(inv, { action: 'equip', index: 0 }, ctx);
	assert.ok(equipped.ok);
	assert.equal(equipped.inv.bag.length, size + 2);
	assert.equal(equipped.inv.beltSlots, 2);
	assert.equal(beltSlotsFor(equipped.inv), 2);

	// a full bag cannot take the belt off (nothing is deleted); with room, the grown bag keeps its size
	const full = { ...equipped.inv, bag: equipped.inv.bag.map(() => ({ item: plainItem('steel_dagger') })) };
	assert.equal(applyOp(full, { action: 'unequip', slot: 'belt' }, ctx).ok, false);
	const off = applyOp(equipped.inv, { action: 'unequip', slot: 'belt' }, ctx);
	assert.ok(off.ok);
	assert.equal(off.inv.bag.length, size + 2);
	assert.equal(off.inv.bag.filter(Boolean).length, equipped.inv.bag.filter(Boolean).length + 1);

	// server and client sizes agree: refitting changes nothing, and the rebirth keeps the slots
	assert.equal(fitInventory(off.inv, core).bag.length, size + 2);
	assert.equal(rebirthInventory(off.inv, undefined, undefined).bag.length, size + 2);
	assert.equal(rebirthInventory(off.inv, undefined, undefined).beltSlots, 2);
});
