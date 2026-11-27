import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PERK_CAPS } from '../../src/catalog/perkCaps';
import { MASTERY_CAPS } from '../../src/catalog/mastery';
import { DEED_BONUS_CAP_PCT } from '../../src/catalog/deedMilestones';
import { COMBAT, STAT_RULES } from '../../src/config/combatConfig';
import { BUILDING_RULES, GENERAL_RULES, IDOL_RULES } from '../../src/config/buildings';
import { BIOME_YIELD, RESOURCE_CAP, SCALING_CONFIG } from '../../src/config/economy';
import { CASTLE_AREA_BONUS, CASTLE_UPGRADE } from '../../src/config/castle';
import { REBIRTH } from '../../src/config/rebirth';
import { LUCK } from '../../src/config/spawns';
import { CRAFT_DISCOUNT_MAX } from '../../src/config/crafting';
import { PARAGON_CAP_POINTS } from '../../src/config/paragon';
import { CHARACTER_STAT_CONFIG } from '../../src/config/character';

// docs/BONUSES.md and docs/bonuses.html carry `<!-- cap:KEY=VALUE -->` markers. Each one must equal the live constant, and both files
// must carry the same set of keys. Changing a cap in code without updating the docs fails here and names the stale key.

const ROOT = resolve(__dirname, '..', '..');

/** The live value behind each marker key. Add a line here when you add a marker. */
const LIVE: Record<string, number> = {
	'biome.yieldScale': BIOME_YIELD.scale,
	'tile.adjacencyBonus': SCALING_CONFIG.adjacencyBonus,
	'castle.lateLevelStep': CASTLE_UPGRADE.lateLevelStep,
	'castle.maxLevel': CASTLE_UPGRADE.maxLevel,
	'castle.areaEarlyBonus': CASTLE_AREA_BONUS.earlyBonus,
	'ember.incomePerPoint': REBIRTH.incomePerPoint,
	'ember.incomeExponent': REBIRTH.incomeExponent,
	'perk.incomePct': PERK_CAPS.incomePct,
	'perk.xpPct': PERK_CAPS.xpPct,
	'perk.clickPct': PERK_CAPS.clickPct,
	'perk.damagePct': PERK_CAPS.damagePct,
	'perk.killRewardPct': PERK_CAPS.killRewardPct,
	'producer.bonusCap': BUILDING_RULES.producer.bonusCap,
	'building.maxLevel': BUILDING_RULES.maxLevel,
	'gear.farmYield': STAT_RULES.farmYieldCap,
	'gear.tileDiscount': STAT_RULES.tileDiscountGearCap,
	'gear.buildSpeed': STAT_RULES.buildSpeedCap,
	'gear.lifeLeech': STAT_RULES.lifeLeechCap,
	'gear.atkSpeed': STAT_RULES.atkSpeedGearCap,
	'gear.critDamage': STAT_RULES.critDamageGearCap,
	'gear.armorPen': STAT_RULES.armorPenCap,
	'gear.thorns': STAT_RULES.thornsCap,
	'gear.healOnKill': STAT_RULES.healOnKillCap,
	'gear.bossTimerSec': STAT_RULES.bossTimerCapSec,
	'tile.charismaDiscountCap': CHARACTER_STAT_CONFIG.tileDiscountCapPercent,
	'tile.discountBaseCap': REBIRTH.discountCapPercent,
	'tile.discountMax': REBIRTH.discountMaxPercent,
	'build.timeCap': IDOL_RULES.buildTimeCap,
	'idol.perLevel': IDOL_RULES.perLevel,
	'general.perLevel': GENERAL_RULES.perLevel,
	'resource.cap': RESOURCE_CAP,
	'crit.maxChance': COMBAT.crit.maxCritChance,
	'crit.maxSuperChance': COMBAT.crit.maxSuperChance,
	'dodge.max': COMBAT.maxDodge,
	'potion.powerMaxPct': COMBAT.potionPowerMaxPct,
	'potion.maxSlots': COMBAT.potionMaxSlots,
	'potion.cooldownMinSec': COMBAT.potionCooldownMinSec,
	'paragon.capPoints': PARAGON_CAP_POINTS,
	'mastery.damage': MASTERY_CAPS.damage,
	'luck.spawnFloor': LUCK.spawnIntervalFloor,
	'luck.rarityCap': LUCK.rarityCap,
	'luck.gemCap': LUCK.gem.cap,
	'luck.goldenCap': LUCK.goldenMonster.cap,
	'deed.capPct': DEED_BONUS_CAP_PCT,
	'craft.discountMax': CRAFT_DISCOUNT_MAX,
};

function markers(file: string): Map<string, string> {
	const text = readFileSync(resolve(ROOT, file), 'utf8');
	const out = new Map<string, string>();
	for (const m of text.matchAll(/<!--\s*cap:([\w.]+)=([^\s]+?)\s*-->/g)) out.set(m[1], m[2]);
	return out;
}

for (const file of ['docs/BONUSES.md', 'docs/bonuses.html']) {
	test(`${file}: every cap marker equals the live constant`, () => {
		const found = markers(file);
		assert.ok(found.size > 0, `${file} has no cap markers`);
		for (const [key, value] of found) {
			assert.ok(key in LIVE, `${file}: marker "${key}" is not mapped in tests/docs/bonuses.test.ts`);
			assert.equal(Number(value), LIVE[key], `${file}: "${key}" says ${value} but the code says ${LIVE[key]}. Update the doc (and the HTML)`);
		}
	});

	test(`${file}: every mapped cap has a marker`, () => {
		const found = markers(file);
		for (const key of Object.keys(LIVE)) assert.ok(found.has(key), `${file} is missing the marker for "${key}"`);
	});
}
