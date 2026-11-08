import type { ItemStats } from './stats';

/**
 * Armour sets. A set's pieces are the items whose `set` field names it (see catalog/index.ts), so adding a piece to a
 * set is done on the item. `bonuses` maps "pieces worn" to the extra stats that count gives (every threshold reached
 * applies, so the bonuses add up); both rings count, so a full set of 14 slots needs both rings, the belt, a weapon and an off hand.
 *
 * Bonuses are big on purpose, in the manner of Diablo sets: a few pieces already change a build, a full set makes it. They
 * may carry the set-only stats (`incomePct`, `xpPct`, `killRewardPct`, `offlineEff`, `offlineCapHours`, `clickPct`,
 * `damagePct`, `maxHpPct`); the server derives every economy one from the saved gear (`lib/gearEconomy.ts`), so they pay
 * out on the server's side too. The wood, cloth and steel families are plain loot with no set bonus.
 */
export interface SetDef {
	id: string;
	label: string;
	/** One line on what the set is for (the generated item catalog prints it) */
	theme: string;
	bonuses: Record<number, ItemStats>;
	/** true: the set no longer drops or sells (IDL-55); owned pieces keep their bonuses, but guides and lists leave it out */
	retired?: boolean;
}

export const SET_DEFS: SetDef[] = [
	{
		id: 'obsidian',
		label: 'Obsidian Set',
		theme: "The prospector's set: it pays the kingdom (income, XP, kill rewards, away time) and keeps its wearer alive, without raw offence.",
		bonuses: {
			2: { incomePct: 6, maxHp: 20 },
			4: { xpPct: 10, goldFind: 10, armor: 6 },
			6: { killRewardPct: 12, damage: 5, luck: 3 },
			9: { offlineEff: 15, clickPct: 10, incomePct: 8, maxHp: 40 },
			12: { incomePct: 12, xpPct: 15, killRewardPct: 25, offlineCapHours: 3, goldFind: 20, armor: 10, superCrit: 6 },
		},
	},
	// ---- the special sets S1-S3 (decided 2026-11-07, IDL-39; docs/plan/28-reuse-items-and-stats.md section 10): 14 pieces each, thresholds 3 / 6 / 9 / 12 / 14. Their
	// pieces are `enabled: false` (catalog/items/ladder.ts), so nobody can wear them yet. NUMBERS ARE PLACEHOLDERS, TODO tune in R2 C5
	// with fight-sim and sim: a full set reaches 70-90 % of the family caps of IDL-149 (income 50, XP 40, kill reward 60, click 40, damage 45).
	{
		id: 'sunhoney',
		label: 'Sunhoney Raiment',
		theme: 'The economy set: income, XP, kill rewards, away time and gold find, with no defence at all.',
		bonuses: {
			3: { incomePct: 8, goldFind: 10 },
			6: { xpPct: 10, clickPct: 8 },
			9: { killRewardPct: 20, offlineEff: 10, incomePct: 10 },
			12: { incomePct: 10, xpPct: 10, offlineCapHours: 3, goldFind: 10, clickPct: 6 },
			14: { incomePct: 10, xpPct: 12, killRewardPct: 28, offlineEff: 10, offlineCapHours: 3, goldFind: 10, clickPct: 6 },
		},
	},
	{
		id: 'ashen_warlord',
		label: 'Ashen Warlord',
		theme: 'The combat plate: percent damage and HP, armor, crits and a slow regeneration.',
		bonuses: {
			3: { damagePct: 6, armor: 6 },
			6: { maxHpPct: 10, critChance: 4 },
			9: { damagePct: 12, armor: 8, regen: 2 },
			12: { damagePct: 10, maxHpPct: 8, critChance: 4, armor: 6 },
			14: { damagePct: 10, maxHpPct: 7, critChance: 4, regen: 2, killRewardPct: 10, armor: 4 },
		},
	},
	{
		id: 'blightbound',
		label: 'Blightbound',
		theme: 'The caster and leech set: the strongest raw power, fragile (no armor, no max HP).',
		bonuses: {
			3: { damagePct: 8, luck: 3 },
			6: { lifeLeech: 3, critChance: 4 },
			9: { damagePct: 12, luck: 5, superCrit: 4 },
			12: { damagePct: 10, lifeLeech: 2, critChance: 3, luck: 4 },
			14: { damagePct: 10, lifeLeech: 3, critChance: 3, luck: 3, superCrit: 6 },
		},
	},
];
