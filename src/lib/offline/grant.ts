import { STORED_KEYS, zeroResources } from '@/catalog/resourceKeys';
import type { CastleUpgradeState, Resources } from '@/types/game';

// What an absence pays. Pure: the server computes it from the last accepted save and its own clock; the client only applies the result.

const RESOURCES: readonly (keyof Resources)[] = STORED_KEYS;

/** What the server derived from the last accepted save (never sent by the client). */
export interface OfflineInput {
	/** Per second, every resource (xp before the xp multiplier) */
	rates: Resources;
	/** The same once the running castle upgrade is done; null with no upgrade running */
	ratesAfterCastle: Resources | null;
	castleUpgrade: CastleUpgradeState | null;
	/** % bonus on xp income */
	xpGainPct: number;
	/** The server clock since the last save or claim, in seconds */
	gapSec: number;
	capSec: number;
	/** 0-1: the share of income an away second pays */
	efficiency: number;
	minGapSec: number;
}

export interface OfflineGrant {
	/** The real away time that counts: the gap up to the cap. Castle builds and monster growth run at this full speed. */
	elapsedSec: number;
	/** What the player was really gone, before the cap (for the welcome-back text) */
	gapSec: number;
	capSec: number;
	efficiency: number;
	/** True when the absence was longer than the cap */
	capped: boolean;
	/** Income earned while away: `efficiency` x the rates over `elapsedSec` (xp includes the xp bonus) */
	resources: Resources;
	/** The castle upgrade that was running, and whether it finished while away */
	castle: { toLevel: number; finished: boolean } | null;
}

/**
 * The longest gap the server treats as the same session: past it an online call is refused with `claim_first`, and the hero rests (heals fully) through the gap. The client uses the same number, so the picture never jumps back.
 *
 * @category Combat/Results and rest
 * @order 2
 */
export const UNCLAIMED_SEC = 900;

export const zeroGrant = (): Resources => zeroResources();

/**
 * The grant for an absence of `gapSec`, or null when it is shorter than the minimum (nothing to show). Income is piecewise: if the
 * castle upgrade finishes while away, the rest of the time earns at the higher rates. Amounts are rounded down.
 *
 * Away time (`/api/offline`).
 *
 * - Gap = server clock now minus the later of the ledger anchor and the last accepted save. Gaps shorter than 300 s (`offlineMinGapSec`) pay nothing.
 * - `elapsed = min(gap, cap)` with cap = 8 h + Night Watch + set hours (hard 72 h).
 * - Paid = `rates x elapsed x efficiency`, efficiency = 50% + Steward + set points (hard 100%); XP also times `(1 + XP gain %)`; floored. If the castle upgrade finishes during `elapsed`, the rest is paid at the higher rates.
 * - Castle timers and monster growth run at full speed for the whole `elapsed`; chests and monsters arrive at the efficiency rate.
 * - Online calls are refused with `claim_first` when more than {@link UNCLAIMED_SEC} passed since the player was last seen; a gap over 900 s also rests the hero ({@link restThrough}).
 *   The client heals HP/mana fully for a gap of 600 s or more (`FULL_HEAL_AFTER_SEC` in `src/lib/offline/apply.ts`).
 * - Write-skipping: a poll that moved only the clock does not write the ledger unless the anchor fell 120 s behind (`ANCHOR_REFRESH_MS`).
 *
 * @category Saves & Server/Away time
 * @order 1
 * @formula
 * elapsed = min(gap, 8 h + Night Watch hours + set hours)           (hard cap 72 h)
 * paid[r] = floor(rate[r] x elapsed x efficiency)                    efficiency = min(1, 0.5 + 0.05 x Steward level + set points)
 */
export const computeOfflineGrant = (input: OfflineInput): OfflineGrant | null => {
	const gap = Number.isFinite(input.gapSec) ? input.gapSec : 0;
	if (gap < input.minGapSec) return null;
	const elapsed = Math.min(gap, input.capSec);
	const eff = Math.min(1, Math.max(0, input.efficiency));
	const remaining = input.castleUpgrade ? Math.max(0, input.castleUpgrade.remainingSec) : null;
	const finished = remaining !== null && remaining <= elapsed;
	const switchAt = finished && input.ratesAfterCastle ? (remaining as number) : elapsed;

	const resources = zeroGrant();
	for (const key of RESOURCES) {
		const before = input.rates[key] ?? 0;
		const after = input.ratesAfterCastle ? (input.ratesAfterCastle[key] ?? 0) : before;
		let amount = (before * switchAt + after * (elapsed - switchAt)) * eff;
		if (key === 'xp') amount *= 1 + input.xpGainPct / 100;
		resources[key] = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
	}
	return {
		elapsedSec: elapsed,
		gapSec: gap,
		capSec: input.capSec,
		efficiency: eff,
		capped: gap > input.capSec,
		resources,
		castle: input.castleUpgrade ? { toLevel: input.castleUpgrade.toLevel, finished } : null,
	};
};
