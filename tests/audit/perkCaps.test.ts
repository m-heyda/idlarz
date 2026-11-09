// Perk family caps (IDL-252): the gear bucket of income, XP, kill reward, click and damage is capped; client and server read the same capped number.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_CATALOG, SETS, setBonusStats, setCounts } from '../../src/catalog';
import { LEGENDARY_PERK_TIERS, PERK_CAPS, PERK_FAMILIES, WEAPON_LEGENDARY_DAMAGE_TOP, capPerks, type PerkFamily } from '../../src/catalog/perkCaps';
import { emptyStats, sumStats } from '../../src/catalog/stats';
import { character } from './helpers';
import { effectiveStats } from '../../src/lib/effectiveStats';
import { gearEconomy } from '../../src/lib/gearEconomy';
import { aggregateStats } from '../../src/lib/inventory';
import { damagePerHit } from '../../src/lib/combat';
import { playerProfile } from '../../src/lib/offline/profile';
import { fullSet } from '../../src/lib/fightSim';
import type { Equipment } from '../../src/types/game';
import { withSetBonus } from '../setBonus';

const withFamily = (family: PerkFamily, value: number) => ({ ...emptyStats(), [family]: value });

test('the decided caps: income 50, XP 50, kill reward 60, click 40, damage 50', () => {
	assert.deepEqual(PERK_CAPS, { incomePct: 50, xpPct: 50, killRewardPct: 60, clickPct: 40, damagePct: 50 });
});

test('each family is cut at its own cap and passes through below it', () => {
	for (const family of PERK_FAMILIES) {
		const cap = PERK_CAPS[family];
		assert.equal(capPerks(withFamily(family, cap + 30))[family], cap, `${family} over`);
		assert.equal(capPerks(withFamily(family, cap))[family], cap, `${family} at`);
		assert.equal(capPerks(withFamily(family, cap - 1))[family], cap - 1, `${family} under`);
		for (const other of PERK_FAMILIES)
			if (other !== family) assert.equal(capPerks(withFamily(family, cap + 30))[other], 0, `${family} does not leak into ${other}`);
	}
});

test('stats without a perk cap are untouched', () => {
	const totals = { ...emptyStats(), damage: 9999, armor: 500, offlineEff: 400, offlineCapHours: 99, maxHpPct: 300, goldFind: 250 };
	const out = capPerks(totals);
	for (const key of Object.keys(totals) as (keyof typeof totals)[]) assert.equal(out[key], totals[key], key);
});

test('sets and legendary perks are summed BEFORE the cap, not capped one by one', () => {
	// Obsidian 12 gives 26 income; a top legendary (25) on top is 51 raw and 50 capped, while capping the parts first would keep 51.
	const set = setBonusStats({ obsidian: 12 }).incomePct;
	const legendary = LEGENDARY_PERK_TIERS.incomePct.top;
	assert.equal(capPerks(sumStats({ incomePct: set }, { incomePct: legendary })).incomePct, PERK_CAPS.incomePct);
	// two top legendaries alone reach the cap exactly, a third adds nothing
	assert.equal(capPerks(sumStats({ incomePct: 25 }, { incomePct: 25 })).incomePct, 50);
	assert.equal(capPerks(sumStats({ incomePct: 25 }, { incomePct: 25 }, { incomePct: 25 })).incomePct, 50);
	// kill reward: Obsidian 37 + 25 = 62, cut by 2
	assert.equal(capPerks(sumStats({ killRewardPct: setBonusStats({ obsidian: 12 }).killRewardPct }, { killRewardPct: 25 })).killRewardPct, 60);
});

test('the weapon legendary top damage tier is +20 and the best set plus it sits exactly on the damage cap', () => {
	assert.equal(WEAPON_LEGENDARY_DAMAGE_TOP, 20);
	assert.ok(WEAPON_LEGENDARY_DAMAGE_TOP > LEGENDARY_PERK_TIERS.damagePct.top);
	const s3 = setBonusStats({ blightbound: 13 }).damagePct;
	assert.equal(s3 + WEAPON_LEGENDARY_DAMAGE_TOP, PERK_CAPS.damagePct);
	assert.equal(capPerks(withFamily('damagePct', s3 + WEAPON_LEGENDARY_DAMAGE_TOP + 10)).damagePct, PERK_CAPS.damagePct);
});

test('no change for current gear: every live set, whole and in part, is below every cap', () => {
	for (const id of Object.keys(SETS)) {
		const full = fullSet(id);
		const parts: Equipment[] = [full, Object.fromEntries(Object.entries(full).slice(0, 7)) as Equipment];
		for (const eq of parts) {
			const raw = sumStats(...Object.values(eq).map((item) => ITEM_CATALOG[item!.base].stats), setBonusStats(setCounts(eq)));
			const got = aggregateStats(eq);
			for (const family of PERK_FAMILIES) {
				assert.ok(raw[family] <= PERK_CAPS[family], `${id} ${family} ${raw[family]} must be under its cap`);
				assert.equal(got[family], raw[family], `${id} ${family}`);
			}
		}
	}
});

test('aggregateStats caps the gear bucket: a boosted set is cut at the cap', () => {
	withSetBonus('obsidian', 12, { incomePct: 40, xpPct: 70, killRewardPct: 90, clickPct: 60, damagePct: 80 }, () => {
		const got = aggregateStats(fullSet('obsidian'));
		for (const family of PERK_FAMILIES) assert.equal(got[family], PERK_CAPS[family], family);
	});
});

test('client equals server: the capped number is the same in the character window, the server profile and the income summary', () => {
	withSetBonus('obsidian', 12, { incomePct: 40, xpPct: 70, killRewardPct: 90, clickPct: 60, damagePct: 80 }, () => {
		const equipment = fullSet('obsidian', 'wooden_sword');
		const c = character({ strength: 8, dexterity: 6, intelligence: 5, vitality: 7, charisma: 5 });
		const ui = effectiveStats({ characterStats: c, equipment, merchantUpgrades: {} });
		const server = playerProfile({
			characterStats: { strength: c.strength, dexterity: c.dexterity, intelligence: c.intelligence, vitality: c.vitality, charisma: c.charisma },
			equipment,
			merchantUpgrades: {},
			resources: { xp: 0 },
		});
		assert.equal(server.hit, ui.damage);
		assert.equal(server.hit, damagePerHit(equipment, c));
		// the hit is exactly the uncapped-by-gear hit with the damage bucket at the cap (x1.50), not x1.80
		const noPct = withSetBonus('obsidian', 12, { damagePct: 0 }, () => damagePerHit(equipment, c));
		assert.ok(Math.abs(server.hit / noPct - 1.5) < 0.01, `hit ratio ${server.hit / noPct}`);
		const economy = gearEconomy(equipment);
		assert.equal(economy.incomePct, PERK_CAPS.incomePct);
		assert.equal(economy.xpPct, PERK_CAPS.xpPct);
		assert.equal(economy.killRewardPct, PERK_CAPS.killRewardPct);
		assert.equal(economy.clickPct, PERK_CAPS.clickPct);
		assert.equal(ui.gearIncome, economy.incomePct);
		assert.equal(ui.killRewards, economy.killRewardPct);
		assert.equal(ui.gearClick, economy.clickPct);
	});
});
