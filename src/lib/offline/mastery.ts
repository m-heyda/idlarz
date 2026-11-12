import { MASTERY_TIERS } from '@/catalog/mastery';
import { GEMS_CAP } from '@/config/economy';
import { masteryReached } from '@/lib/mastery';
import { addTotals, type Ledger } from '@/lib/offline/ledger';

// SERVER ONLY. Claiming Bestiary mastery tiers (IDL-309). A tier is reached by the kills the server counted (`stats.kills[type]`); claiming records it in `stats.masteryClaimed[type]` (a count: tiers are taken in order) and pays the tier's gems
// when it has any (none today). The browser names a type and a tier; the server judges both from its own counters, so a forged claim has nowhere to go. The bonus a tier will give is placeholder text for now: nothing is applied.

export type MasteryClaim =
	| { ok: true; ledger: Ledger; gems: number; tiers: number }
	| { ok: false; reason: 'unknown' | 'not_reached' | 'already_claimed' | 'out_of_order' };

/** The gems the tiers `from` (exclusive) to `to` (inclusive, 1-based) pay. */
const gemsOf = (from: number, to: number): number => MASTERY_TIERS.slice(from, to).reduce((sum, t) => sum + t.gems, 0);

const settle = (ledger: Ledger, type: string, toTiers: number, taken: number): { ledger: Ledger; gems: number } => {
	const owed = gemsOf(taken, toTiers);
	const gems = Math.min(GEMS_CAP, ledger.gems + owed) - ledger.gems;
	return {
		gems,
		ledger: {
			...ledger,
			gems: ledger.gems + gems,
			granted: gems > 0 ? addTotals(ledger.granted, { gems }) : ledger.granted,
			stats: { ...ledger.stats, masteryClaimed: { ...ledger.stats.masteryClaimed, [type]: toTiers } },
		},
	};
};

/**
 * Claims tier `tier` (1-based) of monster `type`. It must be the next one to take (tiers are claimed in order), and its kills must be reached. Refused with nothing changed for an unknown type (no kills recorded), a tier not reached, one already claimed, or one
 * that skips a tier; a repeated or forged claim therefore pays nothing.
 *
 * @category Progression/Mastery
 * @order 1
 */
export const claimMastery = (ledger: Ledger, type: string, tier: number): MasteryClaim => {
	const kills = ledger.stats.kills[type] ?? 0;
	if (kills <= 0 || !Number.isInteger(tier) || tier < 1 || tier > MASTERY_TIERS.length) return { ok: false, reason: 'unknown' };
	const taken = ledger.stats.masteryClaimed[type] ?? 0;
	if (tier <= taken) return { ok: false, reason: 'already_claimed' };
	if (tier > masteryReached(kills)) return { ok: false, reason: 'not_reached' };
	if (tier > taken + 1) return { ok: false, reason: 'out_of_order' };
	const done = settle(ledger, type, tier, taken);
	return { ok: true, ledger: done.ledger, gems: done.gems, tiers: 1 };
};

/**
 * Claim all: every tier every monster type has reached and not claimed, in one ledger write (all or nothing; the gems are capped once). Refused as `not_reached` when nothing is waiting.
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
		const reached = masteryReached(kills);
		if (reached <= taken) continue;
		const done = settle(next, type, reached, taken);
		next = done.ledger;
		gems += done.gems;
		tiers += reached - taken;
	}
	return tiers === 0 ? { ok: false, reason: 'not_reached' } : { ok: true, ledger: next, gems, tiers };
};
