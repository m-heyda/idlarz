import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_CATALOG } from '../../src/catalog';
import { describeEffect } from '../../src/catalog/buffs';
import { sourcesOf } from '../../src/catalog/ingredients';
import { BOSS_DROPS, MONSTER_DROPS } from '../../src/catalog/monsterDrops';
import { RECIPE_BY_ID } from '../../src/catalog/recipes';
import { TIME_SHIFT } from '../../src/config/crafting';
import { ROCK_DROPS } from '../../src/config/rocks';
import { fullSet, simSetup } from '../../src/lib/fightSim';
import { recipeCostGold } from '../../src/lib/crafting';
import { applyUse, applyTimeShift } from '../../src/lib/offline/consumables';
import { inventoryFromCore } from '../../src/lib/offline/inventory';
import type { Ledger } from '../../src/lib/offline/ledger';

// IDL-355: the time-shift potion: craftable, its Hourglass Sand drops from the Banner Wraith and the Cinder Warlord (IDL-381), and the server pays the hour.

const setup = (qty = 5) => simSetup({ equipment: fullSet('steel'), potions: [{ id: 'elixir_time_shift', qty }], monsters: [], seed: 'time-shift' });
const seeded = (s: ReturnType<typeof setup>): Ledger => ({ ...s.ledger, inv: inventoryFromCore(s.stored.core as Record<string, unknown>) });
/** An env whose last accepted save earns 10 gold and 2 wood a second, with the away efficiency 0.5 */
const envWithRates = (s: ReturnType<typeof setup>, at: number) => {
	const env = s.env(at);
	const summary = env.stored.summary;
	return {
		...env,
		stored: {
			...env.stored,
			summary: { ...summary, rates: { ...summary.rates, gold: 10, wood: 2 }, xpGainPct: 0, derived: { ...summary.derived, offlineEfficiency: 0.5 } },
		},
	};
};
const bagQty = (l: Ledger) => l.inv!.bag.reduce((n, slot) => n + (slot && 'id' in slot && slot.id === 'elixir_time_shift' ? slot.qty : 0), 0);

test('the potion: an epic brew whose effect moves the clock an hour, described for the tooltip', () => {
	const def = ITEM_CATALOG.elixir_time_shift;
	assert.equal(def.kind, 'consumable');
	assert.deepEqual(def.effects, [{ kind: 'timeShift', seconds: TIME_SHIFT.seconds }]);
	assert.equal(TIME_SHIFT.seconds, 3600);
	assert.match(describeEffect(def.effects![0]), /1 hour/);
});

test('the recipe is the most expensive brew, costs more than the hour it pays, and its Hourglass Sand has a source', () => {
	const recipe = RECIPE_BY_ID.elixir_time_shift;
	assert.ok(recipe && recipe.kind === 'potion' && recipe.unlock >= 60);
	assert.ok(recipe.inputs.some((i) => 'component' in i && i.component === 'ing_hourglass_sand'));
	// an hour of the best income (6,000 gold/s at the away efficiency 1) is 21.6M gold: the resources alone cost more than that
	assert.ok(recipeCostGold(recipe) > 21_600_000, `${recipeCostGold(recipe)}`);
	for (const other of Object.values(RECIPE_BY_ID).filter((r) => r.kind === 'potion' && r.id !== recipe.id))
		assert.ok(recipeCostGold(other) < recipeCostGold(recipe), other.id);
	// the sand is a rare drop of the Banner Wraith and the Cinder Warlord (IDL-381); no rock drops it
	assert.ok(sourcesOf('junk_hourglass_sand').length > 0, 'the sand has a source');
	assert.ok(MONSTER_DROPS.bannerWraith.some((drop) => drop.id === 'junk_hourglass_sand'));
	assert.ok(BOSS_DROPS.bossCinderWarlord.some((drop) => drop.id === 'junk_hourglass_sand' && drop.chance === 1));
	for (const table of Object.values(ROCK_DROPS)) assert.ok(!table.some((drop) => drop.kind === 'ingredient' && drop.id === 'ing_hourglass_sand'));
});

test('drinking it: one potion leaves the bag, the hour is paid at the away efficiency into granted, the grant carries no rest, the day counter moves', () => {
	const s = setup();
	const now = s.start + 100;
	const used = applyUse(seeded(s), envWithRates(s, now), 0);
	assert.ok(used.ok, used.ok ? '' : used.message);
	if (!used.ok || !used.shifted) return assert.fail('a time shift pays');
	assert.equal(bagQty(used.ledger), 4);
	assert.equal(used.shifted.resources.gold, 18_000, '10 gold a second for an hour at 50%');
	assert.equal(used.shifted.resources.wood, 3_600);
	assert.equal(used.shifted.elapsedSec, 3600);
	assert.equal(used.shifted.gapSec, 0, 'a zero gap: the browser does not heal the hero for a potion');
	assert.equal(used.ledger.granted.gold, (s.ledger.granted.gold ?? 0) + 18_000, 'the save check allows what the server paid');
	assert.equal(used.ledger.granted.shiftSec, 3600, 'and the timers it ran ahead');
	assert.deepEqual(used.ledger.craft.shift, { day: Math.floor(now / 86_400), used: 1 });
	assert.equal(used.ledger.combat?.hp, seeded(s).combat?.hp, 'no healing');
});

test('three a day: the fourth is refused with nothing consumed, the next UTC day starts again, and a fight blocks it', () => {
	const s = setup(10);
	const now = s.start + 100;
	let ledger = seeded(s);
	for (let i = 0; i < TIME_SHIFT.perDay; i++) {
		const used = applyUse(ledger, envWithRates(s, now), 0);
		assert.ok(used.ok, `#${i + 1}`);
		if (used.ok) ledger = used.ledger;
	}
	assert.equal(bagQty(ledger), 7);
	const fourth = applyUse(ledger, envWithRates(s, now + 60), 0);
	assert.equal(fourth.ok, false);
	assert.equal(bagQty(ledger), 7, 'refused: nothing consumed');
	const tomorrow = applyUse(ledger, envWithRates(s, now + 86_400), 0);
	assert.ok(tomorrow.ok, 'a new UTC day');
	assert.equal(applyTimeShift(seeded(s), envWithRates(s, now), 0, 3600, true).ok, false, 'not in a fight');
});
