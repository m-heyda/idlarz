/**
 * The Paragon upgrades (docs/plan/paragon.md): one paragon point per paragon level, spent in a grid of 4 categories with 5 upgrades each. Three of the five in a category are **capped** (`PARAGON_CAP_POINTS` points, a flat effect per point),
 * the other two are **uncapped** and grow with a square root, so every point is worth a little less than the last and never nothing. Ids are append-only (they are stored in the ledger's `paragon` column and never renamed or reordered).
 *
 * **Tuned by the sims (IDL-187).** Combat: `npm run fight-sim` ("Paragon: the combat upgrades", gate in `src/lib/fightSim.ts`): fights get faster and safer, but a kit two grades behind a boss still loses with every capped upgrade full and 100 points in Damage and
 * Maximum life, and the biggest spend leaves a boss fight of at least 15 s. That gate is why Life leech is +0.12 % per point (max +3 %): at +0.2 % it let that kit win a fifth of the level 45 fights, because leech multiplies with the extra damage. Economy:
 * `npm run pace:local -- hardcore-rebirth6 hardcore-rebirth6-paragon hardcore-rebirth6-paragon-max` (the bot is limited by resources, so it shows what the bonuses are worth; the `human` bot is limited by castle timers and does not move): the capped economy
 * upgrades plus 100 points in each uncapped one shorten a hardcore run by about a quarter (5.2 to 4.0 days to the first rebirth, 1.4 to 0.9 on the third run), and 1,000 points in each uncapped one by about half (2.7 days). The gate is "at most a quarter at about
 * paragon 400, at most half at 1,000 points"; both hold, so no economy coefficient moved. `npm run stat-audit` (section 6) pins every upgrade at 0, 1, the cap, over it and at 5,000 points, and that the folded number (`PARAGON_IDOL_FIELD`) equals the effect.
 *
 * @category Progression/Paragon
 * @order 1
 * @formula
 * capped:   effect = perPoint x min(points, 25)
 * uncapped: effect = k x sqrt(points)
 */

import type { PixelIconName } from '@/config/pixelIcons';

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
	up('lifeLeech', 'combat', 'Life leech', 'Heal for a share of the damage you deal.', '%', 0.12, true),
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

/** How a category is drawn in the Paragon window: its colour (a CSS colour the whole column is tinted with) and the emblem in its heading. Display data only: existing icons, no new art (docs/plan/paragon.md). */
export const PARAGON_CATEGORY_STYLE: Record<ParagonCategory, { color: string; icon: PixelIconName }> = {
	combat: { color: '#d8483c', icon: 'equip_offHand' },
	economy: { color: '#f0c84a', icon: 'gold' },
	fortune: { color: '#3fb673', icon: 'item_rabbit_foot' },
	realm: { color: '#9a6be0', icon: 'legacy' },
};

/** The picture of each upgrade in the Paragon window: an existing icon, drawn at `scale` (the 64 px menu icons at 0.5), twinkling when `shine` is set and the icon has a shine strip. */
export const PARAGON_ICON: Record<ParagonId, { name: PixelIconName; scale?: number; shine?: boolean }> = {
	critDamage: { name: 'equip_mainHand' },
	bossTimer: { name: 'menu_boss', scale: 0.5 },
	lifeLeech: { name: 'item_potion_hp' },
	damage: { name: 'item_titan_maul' },
	maxLife: { name: 'item_steel_cuirass' },
	income: { name: 'gold' },
	xpGain: { name: 'xp' },
	tileDiscount: { name: 'stone' },
	clickGold: { name: 'res_iron' },
	killRewards: { name: 'rank_trophy', scale: 0.5 },
	luck: { name: 'item_rabbit_foot' },
	goldFind: { name: 'gold', shine: true },
	goldenChance: { name: 'res_crystal' },
	chestDrop: { name: 'bonus_chest' },
	epicFind: { name: 'diamond' },
	offlineEff: { name: 'res_mana' },
	buildSpeed: { name: 'menu_farm', scale: 0.5 },
	potionPower: { name: 'item_potion_greater' },
	paragonXp: { name: 'legacy', shine: true },
	craftXp: { name: 'menu_crafting', scale: 0.5 },
};
