import type { SaveRepo, StoredSave } from '@/lib/cloudSave/pipeline';
import { POISON_FLAGS } from '@/lib/cloudSave/verify';
import { computeOfflineGrant } from '@/lib/offline/grant';
import type { ClaimResult, PublicTickets } from '@/lib/offline/types';
import { addTotals, seedLedger, type Ledger, type LedgerRepo } from '@/lib/offline/ledger';
import { restThrough } from '@/lib/offline/fight';
import { isChestPlaced, isPlaced, needsLook, placeTickets, siteKey, worldFromPart } from '@/lib/offline/placement';
import { sealedRng } from '@/lib/offline/seal';
import { advanceBank, type BankContext, type TicketBank } from '@/lib/offline/tickets';
import { offlineMinGapSec } from '@/lib/offline/limits';
import type { Rng } from '@/lib/rng';
import type { World } from '@/utils/world';

// The server's side of offline progress. No database code in here: it takes a `LedgerRepo` and a `SaveRepo`, so the same functions run
// against Supabase in the app and against a Map in the tests.

export interface ServiceDeps {
	ledgers: LedgerRepo;
	saves: SaveRepo;
	/** The server-only secret that seals rolls (LOOT_SECRET) */
	secret: string;
}

export type { ClaimResult, PublicTickets };

/** An online call is refused with `claim_first` when more than this long passed since the player was last seen (the absence is claimed first). */
export const UNCLAIMED_SEC = 900;

/** The tickets as the browser may see them: a monster or chest shows once the server has given it a tile. */
export const publicTickets = (bank: TicketBank, opened?: number): PublicTickets => ({
	chests: bank.chests.filter(isChestPlaced).map(({ n, x, y }) => ({ n, x: x!, y: y! })),
	...(opened === undefined ? {} : { opened }),
	rats: bank.rats.filter(isPlaced).map(({ n, at, lucky, x, y, spawnLevel }) => ({ n, at, lucky, x: x!, y: y!, spawnLevel: spawnLevel! })),
	king: bank.king && isPlaced(bank.king) ? { n: bank.king.n, at: bank.king.at, x: bank.king.x!, y: bank.king.y!, spawnLevel: bank.king.spawnLevel! } : null,
});

/** Reads the player's map at most once per request, and only when it is asked for. */
export const mapLoader = (deps: ServiceDeps, userId: string) => {
	let loaded: Promise<{ world: World; key: string; rebirths: number } | null> | null = null;
	return () =>
		(loaded ??= (async () => {
			try {
				const fresh = await deps.saves.load(userId, { world: true });
				const world = fresh?.world ? worldFromPart(fresh.world) : null;
				return fresh && world ? { world, key: siteKey(fresh.summary), rebirths: fresh.summary.rebirths } : null;
			} catch {
				return null; // the map and the save disagree for a moment (a save is landing): look again next time
			}
		})());
};

/**
 * Gives the bank its look at the land when that matters (the land changed, or a monster is waiting for a tile): counts the free
 * tiles for monsters, and puts every waiting monster on one (see placement.ts).
 */
export const lookAtMap = async (
	loadMap: ReturnType<typeof mapLoader>,
	bank: TicketBank,
	stored: StoredSave,
	rollFor: (kind: string, n: number) => Rng
): Promise<TicketBank> => {
	if (!needsLook(bank, siteKey(stored.summary))) return bank;
	const map = await loadMap();
	return map ? placeTickets(bank, map.world, map.key, map.rebirths, rollFor) : bank;
};

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
	step: (ledger: Ledger, stored: StoredSave) => { ledger: Ledger; result: T } | Promise<{ ledger: Ledger; result: T }>
): Promise<{ kind: 'no_save' } | { kind: 'ok'; result: T; ledger: Ledger }> => {
	for (let attempt = 0; attempt < CAS_TRIES; attempt++) {
		const stored = await deps.saves.load(userId);
		if (!stored) return { kind: 'no_save' };
		const existing = await deps.ledgers.load(userId);
		// a save from before the ledger existed does not say what stands on the map (chests): wait for the next upload instead of seeding from guesses
		if (!existing && stored.summary.derived.known !== true) return { kind: 'no_save' };
		const base = existing ?? seedLedger(stored, nowMs);
		const out = await step(base, stored);
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
	const loadMap = mapLoader(deps, userId);
	const done = await withLedger(deps, userId, nowMs, async (ledger, stored): Promise<{ ledger: Ledger; result: ClaimResult }> => {
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
		// the land is looked at first (monsters only come while it has a free tile for them), and again for the monsters this claim makes
		let bank = await lookAtMap(loadMap, ledger.bank, stored, rollFor);
		const hereSec = Math.max(0, anchorMs / 1000 - bank.accAt);
		if (hereSec > 0) bank = advanceBank(bank, hereSec, ctx, rollFor).bank;
		const from = Math.max(bank.accAt, anchorMs / 1000);
		if (grant) bank = advanceBank({ ...bank, accAt: from }, grant.elapsedSec * grant.efficiency, ctx, rollFor, { realDtSec: grant.elapsedSec }).bank;
		else bank = advanceBank({ ...bank, accAt: from }, gapSec, ctx, rollFor).bank;
		bank = await lookAtMap(loadMap, { ...bank, accAt: nowSec }, stored, rollFor);

		const result: ClaimResult = {
			grant,
			reason: flagged ? 'flagged' : grant ? 'paid' : 'short',
			tickets: publicTickets(bank, ledger.ordChest),
			serverNowSec: nowSec,
			gems: ledger.gems,
		};
		// a real absence is a rest: no fight is left open, HP and mana are back. (A page reload is not one: the open fight carries on.)
		const rested = gapSec > UNCLAIMED_SEC ? restThrough({ ...ledger, bank }, { secret: deps.secret, userId, stored, nowSec }, gapSec) : { ...ledger, bank };
		const next: Ledger = {
			...rested,
			anchorAt: nowMs,
			granted: grant ? addTotals(ledger.granted, grant.resources) : ledger.granted,
			lastKey: claimId,
			lastResult: result,
		};
		return { ledger: next, result };
	});
	return done.kind === 'no_save' ? done : { kind: 'ok', result: done.result };
};
