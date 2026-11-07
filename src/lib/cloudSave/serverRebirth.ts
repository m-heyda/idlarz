import { REBIRTH } from '@/config/gameConfig';
import { emberGain } from '@/utils/gameUtils';
import type { SaveSummary } from './summary';

/**
 * The server's own reading of "may this account rebirth, and what does it pay" (IDL-102), from the last STORED save (never from numbers the
 * browser sends with the request): the same rules as `rebirthStatus` in the game (castle level, territory, no castle upgrade running) and the
 * same `emberGain`, with the Tithe level the stored save holds (merchant levels are paid for on the server since IDL-168).
 */
export type RebirthJudgement = { ok: true; to: number; gain: number } | { ok: false; reason: 'not_ready' | 'no_embers' };

export const judgeRebirth = (summary: SaveSummary, merchantUpgrades: Record<string, number> | undefined): RebirthJudgement => {
	const ready = summary.castleLevel >= REBIRTH.minCastleLevel && summary.derived.purchased >= REBIRTH.tilesNeeded(summary.rebirths) && !summary.derived.castleUpgrade;
	if (!ready) return { ok: false, reason: 'not_ready' };
	const gain = emberGain(summary.castleLevel, summary.derived.purchased, merchantUpgrades, summary.rebirths);
	return gain >= 1 ? { ok: true, to: summary.rebirths + 1, gain } : { ok: false, reason: 'no_embers' };
};
