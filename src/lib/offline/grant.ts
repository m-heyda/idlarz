import type { CastleUpgradeState, Resources } from '@/types/game';

// What an absence pays. Pure: the server computes it from the last accepted save and its own clock; the client only applies the result.

const RESOURCES: (keyof Resources)[] = ['gold', 'wood', 'stone', 'coal', 'food', 'meat', 'eggs', 'milk', 'hide', 'xp'];

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

export const zeroGrant = (): Resources => ({ gold: 0, wood: 0, stone: 0, coal: 0, food: 0, meat: 0, eggs: 0, milk: 0, hide: 0, xp: 0 });

/**
 * The grant for an absence of `gapSec`, or null when it is shorter than the minimum (nothing to show). Income is piecewise: if the
 * castle upgrade finishes while away, the rest of the time earns at the higher rates. Amounts are rounded down.
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
