import type { ItemStats } from './stats';

/**
 * Armour sets. A set's pieces are the items whose `set` field names it (see catalog/index.ts), so adding a piece to a
 * set is done on the item. `bonuses` maps "pieces worn" to the extra stats that count gives (every threshold reached
 * applies, so the bonuses add up); both rings count, so a full set of 13 slots needs both rings, a weapon and an off hand.
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
}

export const SET_DEFS: SetDef[] = [
	{
		id: 'obsidian',
		label: 'Obsidian Set',
		theme: 'The prospector\'s set: it pays the kingdom (income, XP, kill rewards, away time) and keeps its wearer alive, without raw offence.',
		bonuses: {
			2: { incomePct: 6, maxHp: 20 },
			4: { xpPct: 10, goldFind: 10, armor: 6 },
			6: { killRewardPct: 12, damage: 5, luck: 3 },
			9: { offlineEff: 15, clickPct: 10, incomePct: 8, maxHp: 40 },
			12: { incomePct: 12, xpPct: 15, killRewardPct: 25, offlineCapHours: 3, goldFind: 20, armor: 10, superCrit: 6 },
		},
	},
	{
		id: 'rattatui',
		label: 'Rattatui Set',
		theme: 'The Rat King\'s court: the combat set. Percent damage and health, crits and leech, with a little loot on the side.',
		bonuses: {
			2: { maxHp: 25, armor: 3 },
			4: { damagePct: 8, critChance: 4 },
			6: { maxHpPct: 15, lifeLeech: 3, goldFind: 10 },
			9: { damagePct: 12, superCrit: 8, regen: 2, luck: 5 },
			13: { damagePct: 15, maxHpPct: 10, killRewardPct: 10, xpPct: 10 },
		},
	},
];
