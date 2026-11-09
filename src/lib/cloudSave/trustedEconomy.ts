import { MERCHANT_UPGRADES, type MerchantUpgradeId } from '@/config/merchant';
import type { Resources } from '@/types/game';
import type { SaveSummary } from './summary';

/**
 * What the server pays a save from when the save's own economy cannot be believed (IDL-167). A save flagged `castle_jump` (a castle level its
 * timer never paid for) or `networth_exceeds` (land, buildings, castle and merchant levels worth more than the game could have paid) is still
 * stored, but everything the server derives from it for money - the per-second rates behind offline pay, kill gold and chest gold, and the
 * castle level the Ember model reads - comes from the last trusted save instead of the claimed one. That save was either honest or itself
 * pinned to an earlier honest one, so a cheat never raises what the account is paid; and since the claim stays out of range, the next save
 * is judged the same way (the cheat is frozen, not rewarded at the second try).
 *
 * Not pinned: the headline figures that feed the XP and Ember models (tiles bought, XP), which are judged against the claim on their own.
 */

/** A baseline exists when the previous save is of the same run: after a rebirth or a New Game its rates describe another game. */
export const sameRunAs = (prev: SaveSummary | null, next: SaveSummary): prev is SaveSummary =>
	!!prev && next.rebirths === prev.rebirths && next.playSeconds >= prev.playSeconds - 1;

const scaled = (rates: Resources | null, factor: number): Resources | null => {
	if (!rates || factor >= 1) return rates;
	const out = { ...rates };
	for (const key of Object.keys(out) as (keyof Resources)[]) out[key] = out[key] * factor;
	return out;
};

/**
 * `ratio` is the net-worth check's `required / allowed` (over 1 = the save claims more than its time can explain). With a baseline the rates
 * and the castle are the previous save's; without one (the account's first save, or the first of a new run) there is nothing trusted to fall
 * back on, so the claimed rates are cut by the same ratio: the economy is worth what the play time can explain.
 *
 * After `castle_jump` or `networth_exceeds` the rates, castle level and castle timer the server pays from are those of the last trusted save of the same run; unpaid merchant levels are put back to the last trusted level (Pack Rat excepted).
 *
 * @category Saves & Server/Accepting a save
 * @order 3
 */
export const trustedEconomy = (prev: SaveSummary | null, claimed: SaveSummary, ratio: number): SaveSummary => {
	if (sameRunAs(prev, claimed)) {
		return {
			...claimed,
			rates: { ...prev.rates },
			castleLevel: prev.castleLevel,
			derived: {
				...claimed.derived,
				castleUpgrade: prev.derived.castleUpgrade ? { ...prev.derived.castleUpgrade } : null,
				ratesAfterCastle: prev.derived.ratesAfterCastle ? { ...prev.derived.ratesAfterCastle } : null,
			},
		};
	}
	const factor = Number.isFinite(ratio) && ratio > 1 ? 1 / ratio : ratio > 1 ? 0 : 1;
	return {
		...claimed,
		rates: scaled(claimed.rates, factor)!,
		derived: { ...claimed.derived, ratesAfterCastle: scaled(claimed.derived.ratesAfterCastle, factor) },
	};
};

/**
 * Merchant levels the stored game keeps when they are not paid for (IDL-168): no higher than the last trusted save held them. Pack Rat is
 * left alone (its bag survives a rebirth, so its levels were paid in earlier runs and cannot be judged against this run's play time).
 */
export const restoreMerchantLevels = (claimed: Record<string, number>, trusted: Record<string, number> | undefined): Record<string, number> => {
	const out: Record<string, number> = {};
	for (const [id, level] of Object.entries(claimed)) {
		const kept = id === 'packrat' ? level : Math.min(level, trusted?.[id] ?? 0);
		if (kept > 0 && id in MERCHANT_UPGRADES) out[id as MerchantUpgradeId] = kept;
	}
	return out;
};
