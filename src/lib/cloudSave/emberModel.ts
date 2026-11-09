import { CASTLE_UPGRADE } from '@/config/castle';
import { MERCHANT_UPGRADES } from '@/config/merchant';
import { REBIRTH } from '@/config/rebirth';
import { emberGain, emberSpent } from '@/utils/game/rebirth';
import type { PrestigeState } from '@/types/game';
import type { Snapshot } from './verify';

/**
 * The server's model of how many Embers (and rebirths) an account can hold. Embers multiply the income of every resource but XP
 * (`1 + 0.1 x earned^0.6`), and the server derives offline pay, kill rewards and chest gold from the stored save, so a save that
 * claims Embers no rebirth paid would pay out for real. Until the server runs the rebirth itself (`/api/rebirth`, IDL-102) the
 * browser still does, so the server bounds what two consecutive saves can explain, from numbers it already holds (IDL-166):
 *
 *  - Embers only rise together with the rebirth count: a save at the same rebirth count cannot hold more than the last one did
 *    (buying shop levels lowers the unspent points, never the Embers ever earned).
 *  - A rebirth is believable when the previous save was at castle level 6 or more (a running upgrade counts) with the territory the
 *    next rebirth needs, give or take the tiles bought since; at most one rebirth fits between two saves.
 *  - The gain is at most what the previous save's castle and territory pay, with the Ancestral Tithe at its maximum (the merchant
 *    upgrades bought without gold are put back by the trusted economy, IDL-168, but a Tithe bought since the last upload is not known here).
 *  - A first save (nothing to compare with) holds a whole history: its rebirths are bounded by the play time and its Embers by the
 *    best rebirth the game can pay.
 *
 * In short: Embers only rise with the rebirth count; one rebirth fits between two saves and it must be believable from the previous castle and land; a first save is bounded by 4 hours of play per rebirth and a 1,000-tile best case.
 * `requireServerRebirth` is off.
 *
 * @category Saves & Server/Accepting a save
 * @order 5
 */
export const EMBER_MODEL = {
	/** The old run may have bought this many more tiles after the save it is judged from (same margin as the XP model). */
	runEndTiles: 100,
	/** No honest run is shorter (the fastest measured one, a hardcore player, takes more than a day): play time per rebirth in a first save. */
	minRunSec: 4 * 3600,
	/** A first save is bounded by the best rebirth: the highest castle level and a territory above the medium-map target (docs/reference/pacing.md). */
	firstSaveTiles: 1000,
	/**
	 * Once the browser asks the server to run every rebirth (`POST /api/rebirth`, IDL-102), a rebirth with no server record can be refused.
	 * Off while old tabs and builds may still rebirth on their own: those fall back to the bound above.
	 */
	requireServerRebirth: false as boolean,
} as const;

const MAX_CASTLE_LEVEL = CASTLE_UPGRADE.durationsSec.length + 1;
const MAX_TITHE = { tithe: MERCHANT_UPGRADES.tithe.maxLevel };

export interface EmberClaim {
	rebirths: number;
	legacyEarned: number;
	playSeconds: number;
}

export interface EmberVerdict {
	/** What the save may hold: its own numbers, or the most it can explain when it asked for more */
	rebirths: number;
	legacyEarned: number;
	/** True when the save asked for more than it could have earned: the numbers above are the limit and the save is flagged */
	clamped: boolean;
}

/** The most Embers one rebirth can pay with the previous save's castle and territory (Tithe maxed, the territory margin included). */
const maxGainFrom = (castleLevel: number, tiles: number, rebirths: number): number => emberGain(castleLevel, tiles, MAX_TITHE, rebirths);

const settled = (claim: EmberClaim, rebirths: number, legacyEarned: number): EmberVerdict => {
	// the pair stays consistent (sanitizeSave refuses 0 rebirths with Embers, or rebirths with none, or fewer Embers than rebirths)
	const kept = Math.max(0, Math.floor(rebirths));
	const earned = kept === 0 ? 0 : Math.max(kept, Math.floor(legacyEarned));
	const clamped = claim.rebirths !== kept || claim.legacyEarned !== earned;
	return { rebirths: kept, legacyEarned: earned, clamped };
};

/** The rebirth the server ran itself (`POST /api/rebirth`, kept in the ledger's inventory): the count it leads to and the Embers it computed. */
export interface ServerRebirth {
	to: number;
	gain: number;
}

export const settleEmbers = (
	prev: Snapshot | null,
	claim: EmberClaim,
	serverRebirth: ServerRebirth | null = null,
	requireServer: boolean = EMBER_MODEL.requireServerRebirth,
): EmberVerdict => {
	if (!prev) {
		const rebirths = Math.min(claim.rebirths, Math.floor(Math.max(0, claim.playSeconds) / EMBER_MODEL.minRunSec));
		const best = maxGainFrom(MAX_CASTLE_LEVEL, EMBER_MODEL.firstSaveTiles, 0);
		return settled(claim, rebirths, Math.min(claim.legacyEarned, rebirths * best));
	}
	const before = prev.summary;
	// a lower rebirth count (a New Game, an older save) is the player's choice and is judged elsewhere (`prestige_regress`)
	if (claim.rebirths <= before.rebirths) {
		return settled(claim, claim.rebirths, Math.min(claim.legacyEarned, Math.max(before.legacyEarned, 0)));
	}
	// the server ran this very rebirth: the gain is exactly what it computed from the stored save, no margin needed
	if (serverRebirth && serverRebirth.to === before.rebirths + 1 && claim.rebirths === serverRebirth.to) {
		return settled(claim, serverRebirth.to, Math.min(claim.legacyEarned, before.legacyEarned + serverRebirth.gain));
	}
	if (requireServer) return settled(claim, before.rebirths, before.legacyEarned);
	const castle = Math.max(before.castleLevel, before.derived.castleUpgrade?.toLevel ?? 0);
	const tiles = before.derived.purchased + EMBER_MODEL.runEndTiles;
	const believable = castle >= REBIRTH.minCastleLevel && tiles >= REBIRTH.tilesNeeded(before.rebirths);
	if (!believable) return settled(claim, before.rebirths, before.legacyEarned);
	const rebirths = before.rebirths + 1; // one rebirth fits between two saves
	return settled(claim, rebirths, Math.min(claim.legacyEarned, before.legacyEarned + maxGainFrom(castle, tiles, before.rebirths)));
};

/** The prestige state with the verdict applied: unspent points follow the Embers, and shop levels the Embers cannot pay for are dropped. */
export const clampPrestige = (prestige: PrestigeState, verdict: EmberVerdict): PrestigeState => {
	const spent = emberSpent(prestige.upgrades);
	if (spent <= verdict.legacyEarned) {
		return { ...prestige, rebirths: verdict.rebirths, legacyEarned: verdict.legacyEarned, legacyPoints: verdict.legacyEarned - spent };
	}
	return { ...prestige, rebirths: verdict.rebirths, legacyEarned: verdict.legacyEarned, legacyPoints: verdict.legacyEarned, upgrades: {} };
};
