import assert from 'node:assert/strict';
import test from 'node:test';
import { ITEM_CATALOG } from '../../src/catalog';
import { LADDER } from '../../src/catalog/items/ladder';
import { STAT_RULES } from '../../src/config/combatConfig';
import { STARTER_EQUIPMENT } from '../../src/config/itemCatalog';
import { gearBossTimerSec, gearBuildTimePct, gearTileDiscountPct } from '../../src/lib/gearEconomy';
import { aggregateStats } from '../../src/lib/inventory';
import { plainItem } from '../../src/lib/itemInstance';
import { playerProfile } from '../../src/lib/offline/profile';
import { bossClockSec } from '../../src/lib/offline/winChance';
import { effectiveTileDiscount } from '../../src/utils/game/rebirth';
import type { Equipment, EquipmentSlot } from '../../src/types/game';

// IDL-176: the economy stats of the ladder's gear. Build Speed (hands, chest), Tile Discount (cape, neck) and Boss Timer (head, shoulder) are fixed base stats from G4 on, each total capped where it is read.

const worn = (grade: 'G3' | 'G4' | 'G6' | 'S3'): Equipment => {
	const eq: Equipment = {};
	const cells: [EquipmentSlot, keyof (typeof LADDER)['G4']][] = [
		['head', 'head'],
		['shoulder', 'shoulder'],
		['chest', 'chest'],
		['hands', 'hands'],
		['cape', 'cape'],
		['neck', 'neck'],
	];
	for (const [slot, cell] of cells) eq[slot] = plainItem(LADDER[grade][cell]!);
	return eq;
};
const stat = (id: string, key: 'buildSpeed' | 'tileDiscount' | 'bossTimer') => ITEM_CATALOG[id]?.stats?.[key] ?? 0;

test('the ladder gives each stat to its slots from G4 on, and G3 and below stay without them', () => {
	for (const grade of ['G4', 'G6'] as const) {
		assert.ok(stat(LADDER[grade].hands!, 'buildSpeed') > 0 && stat(LADDER[grade].chest!, 'buildSpeed') > 0);
		assert.ok(stat(LADDER[grade].cape!, 'tileDiscount') > 0 && stat(LADDER[grade].neck!, 'tileDiscount') > 0);
		assert.ok(stat(LADDER[grade].head!, 'bossTimer') > 0 && stat(LADDER[grade].shoulder!, 'bossTimer') > 0);
		assert.equal(stat(LADDER[grade].legs!, 'buildSpeed'), 0, 'no other slot carries them');
	}
	assert.ok(stat(LADDER.G6.hands!, 'buildSpeed') > stat(LADDER.G4.hands!, 'buildSpeed'), 'a higher grade gives more');
	for (const key of ['buildSpeed', 'tileDiscount', 'bossTimer'] as const) assert.equal(aggregateStats(worn('G3'))[key], 0, `G3 gear has no ${key}`);
});

test('Build Speed joins the build time bucket and stops at its cap', () => {
	assert.equal(gearBuildTimePct({}), 0);
	const g6 = gearBuildTimePct(worn('G6'));
	assert.ok(g6 > 0 && g6 < STAT_RULES.buildSpeedCap, `G6 gives ${g6} %`);
	assert.ok(aggregateStats(worn('S3')).buildSpeed > STAT_RULES.buildSpeedCap, 'the top set overshoots the cap');
	assert.equal(gearBuildTimePct(worn('S3')), STAT_RULES.buildSpeedCap);
});

test('Tile Discount adds to the tile discount, under its gear cap and the tile discount cap', () => {
	const stats = { tileCostDiscount: 0 };
	const base = effectiveTileDiscount(stats, undefined, undefined, undefined);
	assert.equal(effectiveTileDiscount(stats, undefined, undefined, undefined, {}), base, 'no gear, no change');
	const withGear = effectiveTileDiscount(stats, undefined, undefined, undefined, worn('G6'));
	assert.ok(withGear > base, 'worn gear lowers the price');
	assert.equal(withGear - base, gearTileDiscountPct(worn('G6')));
	assert.equal(gearTileDiscountPct(worn('S3')), STAT_RULES.tileDiscountGearCap);
	assert.equal(gearTileDiscountPct(undefined), 0);
});

test('Boss Timer reaches the profile, the fight clock and the win estimate, and only when worn', () => {
	const core = (equipment: Equipment) => ({ equipment, characterStats: { availablePoints: 0 }, level: { level: 1, progress: 0 }, bag: [] }) as never;
	const plain = playerProfile(core(STARTER_EQUIPMENT));
	assert.equal('bossTimerSec' in plain, false, 'no gear, no new field');
	const profile = playerProfile(core(worn('G6')));
	assert.equal(profile.bossTimerSec, gearBossTimerSec(worn('G6')));
	assert.equal(gearBossTimerSec(worn('S3')), Math.min(STAT_RULES.bossTimerCapSec, aggregateStats(worn('S3')).bossTimer));
	assert.ok(gearBossTimerSec(worn('S3')) <= STAT_RULES.bossTimerCapSec);
	// a boss's clock is its own limit plus the seconds the gear adds; a monster with no clock has none
	assert.equal(bossClockSec('bossGreatAuroch', { bossTimerSec: 5 })! - bossClockSec('bossGreatAuroch', {})!, 5);
	assert.equal(bossClockSec('thistleBoar', { bossTimerSec: 5 }), undefined, 'a normal monster has no clock');
});
