import type { StatTotals } from './stats';

/** The stat families whose gear bucket is capped (IDL-149 / IDL-252). Every other stat has its own rule (crit, dodge, leech caps) or none. */
export type PerkFamily = 'incomePct' | 'xpPct' | 'killRewardPct' | 'clickPct' | 'damagePct';

/**
 * The cap on the gear bucket of each perk family, in percent. Each family is its own `(1 + sum)` bucket; the sum is everything gear gives: item stats, set
 * bonuses and legendary perks added together BEFORE the cap. Decided by the owner (IDL-149 on 2026-11-07, XP raised to 50 and damage to 50 on 2026-11-09).
 *
 * @category Economy/Perk caps
 * @formula
 * bucket = min(cap, sum of gear + set bonus + legendary perks)       multiplier = 1 + bucket / 100
 * @table perk-caps
 */
export const PERK_CAPS: Record<PerkFamily, number> = {
	incomePct: 50,
	xpPct: 50,
	killRewardPct: 60,
	clickPct: 40,
	damagePct: 50,
};

/**
 * The magnitude of a legendary perk by tier, in percent of its family (IDL-149: 8 / 15 / 25 for every family, damage 4 / 6 / 10). Data for the legendary
 * roster (IDL-144): no item carries these yet, so nothing reads them in the game today.
 *
 * @category Economy/Perk caps
 * @table perk-tiers
 */
export const LEGENDARY_PERK_TIERS: Record<PerkFamily, { common: number; rare: number; top: number }> = {
	incomePct: { common: 8, rare: 15, top: 25 },
	xpPct: { common: 8, rare: 15, top: 25 },
	killRewardPct: { common: 8, rare: 15, top: 25 },
	clickPct: { common: 8, rare: 15, top: 25 },
	damagePct: { common: 4, rare: 6, top: 10 },
};

/**
 * The top damage tier of a WEAPON legendary: +20 % where every other slot tops out at {@link LEGENDARY_PERK_TIERS} damage +10 (owner, 2026-11-09: weapon
 * legendaries are a little overpowered on purpose). With the best set (S3, 13 pieces: 40) it reaches exactly the damage cap of 50. Data for IDL-144.
 *
 * @category Economy/Perk caps
 */
export const WEAPON_LEGENDARY_DAMAGE_TOP = 20;

/** The capped families, in a fixed order. */
export const PERK_FAMILIES = Object.keys(PERK_CAPS) as PerkFamily[];

/**
 * The one function that caps the perk families of a summed gear block. `aggregateStats` calls it, and the server reads gear only through `aggregateStats`
 * (fight profile, income summary), so the browser and the server cannot disagree. A new object is returned; stats without a cap pass through unchanged.
 *
 * @category Economy/Perk caps
 * @formula
 * totals[f] = min(PERK_CAPS[f], totals[f])    for the five families, nothing else changes
 */
export const capPerks = <T extends StatTotals>(totals: T): T => {
	const capped = { ...totals };
	for (const family of PERK_FAMILIES) capped[family] = Math.min(PERK_CAPS[family], totals[family]) as T[PerkFamily];
	return capped;
};
