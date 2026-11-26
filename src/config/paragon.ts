/**
 * The Paragon upgrades (docs/plan/paragon.md): one paragon point per paragon level, spent in a grid of 4 categories with 5 upgrades each. Three of the five in a category are **capped** (`PARAGON_CAP_POINTS` points, a flat effect per point),
 * the other two are **uncapped** and grow with a square root, so every point is worth a little less than the last and never nothing. The coefficients are placeholders until the sims have run (`fight-sim` for combat, the pace sim for economy).
 * Ids are append-only (they are stored in the ledger's `paragon` column and never renamed or reordered).
 *
 * @category Progression/Paragon
 * @order 1
 * @formula
 * capped:   effect = perPoint x min(points, 25)
 * uncapped: effect = k x sqrt(points)
 */

export const PARAGON_CATEGORIES = ['combat', 'economy', 'fortune', 'realm'] as const;
export type ParagonCategory = (typeof PARAGON_CATEGORIES)[number];

export const PARAGON_CATEGORY_LABEL: Record<ParagonCategory, string> = { combat: 'Combat', economy: 'Economy', fortune: 'Fortune', realm: 'Realm' };

/** The most points one capped upgrade takes (3 capped x 4 categories x 25 = 300: all of them are done by paragon 300) */
export const PARAGON_CAP_POINTS = 25;

/** The most points one request may add to one upgrade (a sanity bound on the body; the budget is the real limit) */
export const PARAGON_ADD_MAX = 1000;

/** The unit of an upgrade's effect: `%` is a percentage, `pts` percentage points or plain points (Luck), `s` seconds */
export type ParagonUnit = '%' | 'pts' | 's';

export interface ParagonUpgrade {
	id: ParagonId;
	category: ParagonCategory;
	name: string;
	/** What it does, in a line */
	blurb: string;
	unit: ParagonUnit;
	/** Capped: the effect of one point, up to `PARAGON_CAP_POINTS`. Uncapped: the factor `k` of `k x sqrt(points)` */
	rate: number;
	capped: boolean;
}

export type ParagonId =
	| 'critDamage'
	| 'bossTimer'
	| 'lifeLeech'
	| 'damage'
	| 'maxLife'
	| 'income'
	| 'xpGain'
	| 'tileDiscount'
	| 'clickGold'
	| 'killRewards'
	| 'luck'
	| 'goldFind'
	| 'goldenChance'
	| 'chestDrop'
	| 'epicFind'
	| 'offlineEff'
	| 'buildSpeed'
	| 'potionPower'
	| 'paragonXp'
	| 'craftXp';

const up = (id: ParagonId, category: ParagonCategory, name: string, blurb: string, unit: ParagonUnit, rate: number, capped: boolean): ParagonUpgrade => ({
	id,
	category,
	name,
	blurb,
	unit,
	rate,
	capped,
});

/** The grid, in display order (3 capped, then 2 uncapped, per category) */
export const PARAGON_UPGRADES: readonly ParagonUpgrade[] = [
	up('critDamage', 'combat', 'Critical damage', 'More damage on a critical hit.', '%', 2, true),
	up('bossTimer', 'combat', 'Boss timer', 'More time to beat a boss.', 's', 0.6, true),
	up('lifeLeech', 'combat', 'Life leech', 'Heal for a share of the damage you deal.', '%', 0.2, true),
	up('damage', 'combat', 'Damage', 'More damage, with no end.', '%', 2, false),
	up('maxLife', 'combat', 'Maximum life', 'More hit points, with no end.', '%', 2, false),
	up('income', 'economy', 'Income', 'More of every resource the map makes.', '%', 0.8, true),
	up('xpGain', 'economy', 'XP gain', 'More XP from every source.', '%', 0.8, true),
	up('tileDiscount', 'economy', 'Tile discount', 'New tiles cost less gold.', '%', 0.4, true),
	up('clickGold', 'economy', 'Click gold', 'More gold from every map click, with no end.', '%', 3, false),
	up('killRewards', 'economy', 'Kill rewards', 'More gold and XP from a kill, with no end.', '%', 1.5, false),
	up('luck', 'fortune', 'Luck', 'Better chances in chests and drops.', 'pts', 1.2, true),
	up('goldFind', 'fortune', 'Gold find', 'More gold from drops and sales.', '%', 0.4, true),
	up('goldenChance', 'fortune', 'Golden monsters', 'A better chance that a monster is golden.', 'pts', 0.1, true),
	up('chestDrop', 'fortune', 'Monster chests', 'A better chance that a monster drops a chest, with no end.', 'pts', 0.2, false),
	up('epicFind', 'fortune', 'Epic find', 'A better chance of epic and better items, with no end.', '%', 1, false),
	up('offlineEff', 'realm', 'Offline efficiency', 'A bigger share of the income is paid while you are away.', 'pts', 0.8, true),
	up('buildSpeed', 'realm', 'Build speed', 'Castle and building timers run shorter.', '%', 0.4, true),
	up('potionPower', 'realm', 'Potion power', 'Potions heal and buff more.', '%', 0.6, true),
	up('paragonXp', 'realm', 'Paragon XP', 'More XP past level 100, with no end.', '%', 2, false),
	up('craftXp', 'realm', 'Crafting XP', 'More XP from crafting, with no end.', '%', 2, false),
];

export const PARAGON_IDS: readonly ParagonId[] = PARAGON_UPGRADES.map((u) => u.id);

const BY_ID = new Map<string, ParagonUpgrade>(PARAGON_UPGRADES.map((u) => [u.id, u]));

export const paragonUpgrade = (id: string): ParagonUpgrade | undefined => BY_ID.get(id);

/** How many points an upgrade can still take (capped upgrades stop at `PARAGON_CAP_POINTS`; an uncapped one never does) */
export const paragonRoom = (u: ParagonUpgrade, points: number): number => (u.capped ? Math.max(0, PARAGON_CAP_POINTS - points) : Number.POSITIVE_INFINITY);

/** The effect of `points` in one upgrade, in the upgrade's unit (0 for none; a capped upgrade counts at most `PARAGON_CAP_POINTS`) */
export const paragonEffect = (u: ParagonUpgrade, points: number): number => {
	const p = Math.max(0, Math.floor(points));
	return u.capped ? u.rate * Math.min(p, PARAGON_CAP_POINTS) : u.rate * Math.sqrt(p);
};

/** The number the grid shows for an effect: "+4.8 %", "+7.2", "+3 s" */
export const paragonEffectText = (u: ParagonUpgrade, value: number): string => {
	const n = Math.round(value * 100) / 100;
	return `+${n}${u.unit === '%' ? ' %' : u.unit === 's' ? ' s' : ''}`;
};
