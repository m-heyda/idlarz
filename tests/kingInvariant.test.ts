import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, store } from './helpers';
import { MONSTERS } from '../src/config/combatConfig';
import { CLICK_LIMIT } from '../src/config/gameConfig';
import { ITEM_CATALOG, STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { createClickLimiter } from '../src/lib/clickLimiter';

import { EQUIPMENT_LAYOUT, RATTATUI_SET } from '../src/config/itemCatalog';
import { COMBAT } from '../src/config/combatConfig';
import type { EquipmentSlot } from '../src/types/game';

const SLOTS: EquipmentSlot[] = [...EQUIPMENT_LAYOUT.left, ...EQUIPMENT_LAYOUT.right, ...EQUIPMENT_LAYOUT.bottom];

/**
 * An upper bound for the damage of one click with any loadout the catalog allows: the best item of every slot
 * (a 'ring' item fits both ring slots) plus the damage of every set bonus. Gear damage is summed over ALL slots,
 * not just the weapon, so a damage ring or a set bonus with damage must show up here.
 */
const maxDamagePerClick = (): number => {
	let total = 0;
	for (const slot of SLOTS) {
		const fits = Object.values(ITEM_CATALOG).filter(
			(i) => i.slot === slot || (i.slot === 'ring' && (slot === 'ring1' || slot === 'ring2'))
		);
		total += Math.max(0, ...fits.map((i) => i.stats?.damage ?? 0));
	}
	for (const bonus of Object.values(RATTATUI_SET.bonuses)) total += bonus.damage ?? 0;
	return Math.max(1, total);
};

test('no single item exceeds the weapon damage cap', () => {
	for (const def of Object.values(ITEM_CATALOG)) {
		assert.ok((def.stats?.damage ?? 0) <= COMBAT.maxWeaponDamage, def.id);
	}
});

test('the best possible loadout (every slot, set bonuses included) cannot exceed the damage cap', () => {
	assert.ok(
		maxDamagePerClick() <= COMBAT.maxWeaponDamage,
		`best loadout deals ${maxDamagePerClick()} per click, cap is ${COMBAT.maxWeaponDamage}`
	);
});

test('the king is beatable with the starter sword at the limiter cap, within the time limit', () => {
	const starterDamage = ITEM_CATALOG[STARTER_EQUIPMENT.mainHand!].stats!.damage!;
	// real limiter, a bot clicking every 5 ms for the whole window: the accepted clicks are the most anyone can land
	const limiter = createClickLimiter();
	let accepted = 0;
	for (let t = 0, id = 1; t <= MONSTERS.ratKing.timeLimitSec * 1000; t += 5, id++) {
		if (limiter.take({ eventId: id, now: t, trusted: true })) accepted++;
	}
	assert.ok(accepted * starterDamage >= MONSTERS.ratKing.hp * 1.25, `${accepted} clicks x ${starterDamage}`);
});

test('even the best possible loadout cannot trivialise the king: it takes at least 20 s of capped clicking', () => {
	const best = maxDamagePerClick();
	const clicksNeeded = Math.ceil(MONSTERS.ratKing.hp / best);
	const seconds = Math.max(0, (clicksNeeded - CLICK_LIMIT.capacity) / CLICK_LIMIT.refillPerSec);
	assert.ok(seconds >= 20, `${clicksNeeded} clicks at ${best} per click = ${seconds.toFixed(1)} s`);
});

test('a starter-kit king fight that is never clicked ends by timeout, not by knockout', () => {
	freshGame();
	growTo(6);
	store.setState({ monsters: [{ id: 1, type: 'ratKing', tier: 1, x: 0, y: 0, ageSec: 0 }], nextMonsterId: 2 });
	const startHp = api().playerHp;
	api().startFight(1);
	for (let i = 0; i < MONSTERS.ratKing.timeLimitSec + 10 && api().fight?.phase === 'active'; i++) api().tick(1000);
	assert.equal(api().fight?.phase, 'timeout');
	assert.ok(api().playerHp > 0 && api().playerHp < startHp);
});
