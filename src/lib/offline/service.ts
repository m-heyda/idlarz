import type { SaveRepo, StoredSave } from '@/lib/cloudSave/pipeline';
import { POISON_FLAGS } from '@/lib/cloudSave/verify';
import { computeOfflineGrant } from '@/lib/offline/grant';
import type { ClaimResult, PublicTickets } from '@/lib/offline/types';
import { addTotals, seedLedger, type Ledger, type LedgerRepo } from '@/lib/offline/ledger';
import { sealedRng } from '@/lib/offline/seal';
import { advanceBank, type BankContext, type TicketBank } from '@/lib/offline/tickets';
import { offlineMinGapSec } from '@/lib/offline/limits';

// The server's side of offline progress. No database code in here: it takes a `LedgerRepo` and a `SaveRepo`, so the same functions run
// against Supabase in the app and against a Map in the tests.

export interface ServiceDeps {
	ledgers: LedgerRepo;
	saves: SaveRepo;
	/** The server-only secret that seals rolls (LOOT_SECRET) */
	secret: string;
}

export type { ClaimResult, PublicTickets };

export const publicTickets = (bank: TicketBank): PublicTickets => ({
	chests: bank.chests.length,
	rats: bank.rats.map(({ n, at, lucky }) => ({ n, at, lucky })),
	king: bank.king ? { n: bank.king.n, at: bank.king.at } : null,
});

export type ClaimOutcome = { kind: 'no_save' } | { kind: 'ok'; result: ClaimResult };

const CAS_TRIES = 4;

export const bankContext = (stored: StoredSave): BankContext => ({
	luck: stored.summary.derived.luck,
	tilesOwned: stored.summary.tilesOwned,
	buildingsOwned: stored.summary.buildingsOwned,
	castleLevel: stored.summary.castleLevel,
});

/**
 * Loads the player's ledger, creating it from the last save the first time (seeded from what is on the map, see `seedLedger`), and
 * runs `step` on it. The step returns the new ledger and what to answer; the write is a compare-and-swap on `ver`, so two requests
 * at once (two browsers, a double click) cannot both build on the same state: the loser reads again and runs its step on the winner's.
 */
export const withLedger = async <T>(
	deps: ServiceDeps,
	userId: string,
	nowMs: number,
	step: (ledger: Ledger, stored: StoredSave) => { ledger: Ledger; result: T }
): Promise<{ kind: 'no_save' } | { kind: 'ok'; result: T; ledger: Ledger }> => {
	for (let attempt = 0; attempt < CAS_TRIES; attempt++) {
		const stored = await deps.saves.load(userId);
		if (!stored) return { kind: 'no_save' };
		const existing = await deps.ledgers.load(userId);
		// a save from before the ledger existed does not say what stands on the map (chests): wait for the next upload instead of seeding from guesses
		if (!existing && stored.summary.derived.known !== true) return { kind: 'no_save' };
		const base = existing ?? seedLedger(stored, nowMs);
		const out = step(base, stored);
		const next: Ledger = { ...out.ledger, ver: (existing?.ver ?? 0) + 1 };
		if (await deps.ledgers.commit(userId, existing?.ver ?? 0, next)) return { kind: 'ok', result: out.result, ledger: next };
	}
	throw new Error('the ledger is busy');
};

/**
 * Pays an absence. The gap is measured on the server clock from the later of the last accepted save and the last claim, so it
 * cannot be lengthened by the client; it is capped (8 h + Night Watch) and paid at the efficiency (50 % + Steward) of the income the
 * last accepted save earns. Chests, rats and a King that would have appeared come with it as tickets. The claim moves the anchor to
 * now (a second claim a moment later pays nothing) and is remembered under `claimId`, so a response lost on the way is simply replayed.
 */
export const claimOffline = async (deps: ServiceDeps, userId: string, claimId: string, nowMs: number): Promise<ClaimOutcome> => {
	const done = await withLedger(deps, userId, nowMs, (ledger, stored): { ledger: Ledger; result: ClaimResult } => {
		if (ledger.lastKey === claimId && ledger.lastResult) return { ledger, result: ledger.lastResult as ClaimResult };

		const derived = stored.summary.derived;
		const nowSec = nowMs / 1000;
		const flagged = stored.flags.some((flag) => POISON_FLAGS.has(flag));
		const anchorMs = Math.max(ledger.anchorAt, stored.serverSavedAt);
		const gapSec = Math.max(0, (nowMs - anchorMs) / 1000);
		const grant = flagged
			? null
			: computeOfflineGrant({
					rates: stored.summary.rates,
					ratesAfterCastle: derived.ratesAfterCastle,
					castleUpgrade: derived.castleUpgrade,
					xpGainPct: stored.summary.xpGainPct,
					gapSec,
					capSec: derived.offlineCapSec,
					efficiency: derived.offlineEfficiency,
					minGapSec: offlineMinGapSec(),
				});

		const ctx = bankContext(stored);
		const rollFor = (kind: string, n: number) => sealedRng(deps.secret, userId, ledger.runId, kind, n);
		// first the stretch the player was still here (their own spawn timers were running), then the absence at its efficiency
		let bank = ledger.bank;
		const hereSec = Math.max(0, anchorMs / 1000 - bank.accAt);
		if (hereSec > 0) bank = advanceBank(bank, hereSec, ctx, rollFor).bank;
		const from = Math.max(bank.accAt, anchorMs / 1000);
		if (grant) bank = advanceBank({ ...bank, accAt: from }, grant.elapsedSec * grant.efficiency, ctx, rollFor, { realDtSec: grant.elapsedSec }).bank;
		else bank = advanceBank({ ...bank, accAt: from }, gapSec, ctx, rollFor).bank;
		bank = { ...bank, accAt: nowSec };

		const result: ClaimResult = {
			grant,
			reason: flagged ? 'flagged' : grant ? 'paid' : 'short',
			tickets: publicTickets(bank),
			serverNowSec: nowSec,
			gems: ledger.gems,
		};
		const next: Ledger = {
			...ledger,
			bank,
			anchorAt: nowMs,
			granted: grant ? addTotals(ledger.granted, grant.resources) : ledger.granted,
			lastKey: claimId,
			lastResult: result,
		};
		return { ledger: next, result };
	});
	return done.kind === 'no_save' ? done : { kind: 'ok', result: done.result };
};
