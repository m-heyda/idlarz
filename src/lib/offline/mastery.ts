import { BIOME_GOALS, MASTERY_BIOMES, biomeRoster, masteryTiersOf, type MasteryTier } from '@/catalog/mastery';
import { GEMS_CAP } from '@/config/economy';
import { biomeState, masteryReachedOf } from '@/lib/mastery';
import { addTotals, type Ledger } from '@/lib/offline/ledger';

// SERVER ONLY. Claiming Bestiary mastery tiers (IDL-309, IDL-336). A tier is reached by the kills the server counted (`stats.kills[type]`); claiming records it in `stats.masteryClaimed[type]` (a count: tiers are taken in order) and pays the tier's gems
// when it has any. A biome goal (every monster of the biome at tier N) is claimed the same way into `stats.biomeClaimed[biome]`. The browser names a type (or a biome) and a tier; the server judges both from its own counters, so a forged claim has nowhere to go.
// What the claimed tiers give against a monster is `masteryBonusesFor` (lib/mastery.ts), applied by the fight and the kill reward.

export type MasteryClaim =
	| { ok: true; ledger: Ledger; gems: number; tiers: number }
	| { ok: false; reason: 'unknown' | 'not_reached' | 'already_claimed' | 'out_of_order' };

/** The gems the tiers `from` (exclusive) to `to` (inclusive, 1-based) of a ladder pay. */
const gemsOf = (tiers: readonly { gems: number }[], from: number, to: number): number => tiers.slice(from, to).reduce((sum, t) => sum + t.gems, 0);

/** Pays `owed` gems (capped by `GEMS_CAP`) and returns the ledger with `change` applied to its stats. */
const pay = (ledger: Ledger, owed: number, change: (stats: Ledger['stats']) => Ledger['stats']): { ledger: Ledger; gems: number } => {
	const gems = Math.min(GEMS_CAP, ledger.gems + owed) - ledger.gems;
	return {
		gems,
		ledger: { ...ledger, gems: ledger.gems + gems, granted: gems > 0 ? addTotals(ledger.granted, { gems }) : ledger.granted, stats: change(ledger.stats) },
	};
};

const settle = (ledger: Ledger, type: string, toTiers: number, taken: number): { ledger: Ledger; gems: number } =>
	pay(ledger, gemsOf(masteryTiersOf(type), taken, toTiers), (stats) => ({ ...stats, masteryClaimed: { ...stats.masteryClaimed, [type]: toTiers } }));

const settleBiome = (ledger: Ledger, biome: string, toTiers: number, taken: number): { ledger: Ledger; gems: number } =>
	pay(ledger, gemsOf(BIOME_GOALS, taken, toTiers), (stats) => ({ ...stats, biomeClaimed: { ...stats.biomeClaimed, [biome]: toTiers } }));

/**
 * Claims tier `tier` (1-based) of monster `type`. It must be the next one to take (tiers are claimed in order), and its kills must be reached on the type's own ladder (a boss reaches its tiers at 1 / 5 / 25 / 100 kills). Refused with nothing changed for an unknown type (no kills recorded), a tier not reached, one already claimed, or one
 * that skips a tier; a repeated or forged claim therefore pays nothing.
 *
 * @category Progression/Mastery
 * @order 1
 */
export const claimMastery = (ledger: Ledger, type: string, tier: number): MasteryClaim => {
	const kills = ledger.stats.kills[type] ?? 0;
	const tiers: readonly MasteryTier[] = masteryTiersOf(type);
	if (kills <= 0 || !Number.isInteger(tier) || tier < 1 || tier > tiers.length) return { ok: false, reason: 'unknown' };
	const taken = ledger.stats.masteryClaimed[type] ?? 0;
	if (tier <= taken) return { ok: false, reason: 'already_claimed' };
	if (tier > masteryReachedOf(type, kills)) return { ok: false, reason: 'not_reached' };
	if (tier > taken + 1) return { ok: false, reason: 'out_of_order' };
	const done = settle(ledger, type, tier, taken);
	return { ok: true, ledger: done.ledger, gems: done.gems, tiers: 1 };
};

/**
 * Claims the next collection tier of a biome: every live monster of the biome, its boss included, must have reached that tier by its kills (each on its own ladder). In order, like the monster tiers; refused with nothing changed otherwise.
 *
 * @category Progression/Mastery
 * @order 1.5
 */
export const claimBiomeGoal = (ledger: Ledger, biome: string, tier: number): MasteryClaim => {
	if (!biomeRoster(biome).length || !Number.isInteger(tier) || tier < 1 || tier > BIOME_GOALS.length) return { ok: false, reason: 'unknown' };
	const taken = ledger.stats.biomeClaimed[biome] ?? 0;
	if (tier <= taken) return { ok: false, reason: 'already_claimed' };
	if (tier > biomeState(biome, ledger.stats.kills, taken).reached) return { ok: false, reason: 'not_reached' };
	if (tier > taken + 1) return { ok: false, reason: 'out_of_order' };
	const done = settleBiome(ledger, biome, tier, taken);
	return { ok: true, ledger: done.ledger, gems: done.gems, tiers: 1 };
};

/**
 * Claim all: every tier every monster type has reached and not claimed, then every biome goal that became reachable, in one ledger write (all or nothing; the gems are capped once). Refused as `not_reached` when nothing is waiting.
 *
 * @category Progression/Mastery
 * @order 2
 */
export const claimAllMastery = (ledger: Ledger): MasteryClaim => {
	let next = ledger;
	let gems = 0;
	let tiers = 0;
	for (const [type, kills] of Object.entries(ledger.stats.kills)) {
		const taken = next.stats.masteryClaimed[type] ?? 0;
		const reached = masteryReachedOf(type, kills);
		if (reached <= taken) continue;
		const done = settle(next, type, reached, taken);
		next = done.ledger;
		gems += done.gems;
		tiers += reached - taken;
	}
	for (const biome of MASTERY_BIOMES) {
		const taken = next.stats.biomeClaimed[biome] ?? 0;
		const reached = biomeState(biome, next.stats.kills, taken).reached;
		if (reached <= taken) continue;
		const done = settleBiome(next, biome, reached, taken);
		next = done.ledger;
		gems += done.gems;
		tiers += reached - taken;
	}
	return tiers === 0 ? { ok: false, reason: 'not_reached' } : { ok: true, ledger: next, gems, tiers };
};
