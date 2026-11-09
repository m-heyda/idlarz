/**
 * The endpoints under `src/app/api`. Each route handler only authenticates and calls the pure service in `src/lib/offline/`.
 *
 * `inventory` operations except the two purchases and `autoSell` are refused while a fight is open. The merchant's prices and shelf are still the browser's: a purchase through `inventory` is checked for being a valid item,
 * and its gold is paid in the browser.
 *
 * @title Endpoints (the API routes)
 * @category Saves & Server/Endpoints
 * @order 1
 * @table api-routes
 */
import { PINNED_KEEP, type SaveRepo, type StoredSave } from '@/lib/cloudSave/pipeline';
import { POISON_FLAGS } from '@/lib/cloudSave/verify';
import { UNCLAIMED_SEC, computeOfflineGrant } from '@/lib/offline/grant';
import type { ClaimResult, PublicTickets } from '@/lib/offline/types';
import { addTotals, resetLedger, seedLedger, type Ledger, type LedgerRepo } from '@/lib/offline/ledger';
import { restThrough } from '@/lib/offline/fight';
import { coreWithInventory, fitInventory, inventoryFromCore } from '@/lib/offline/inventory';
import { isChestPlaced, isPlaced, needsLook, placeTickets, siteKey, worldFromPart } from '@/lib/offline/placement';
import { playerProfile } from '@/lib/offline/profile';
import { powerKey } from '@/lib/offline/spawnWeights';
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

export { UNCLAIMED_SEC };

/** The tickets as the browser may see them: a monster or chest shows once the server has given it a tile. */
export const publicTickets = (bank: TicketBank, opened?: number): PublicTickets => ({
	chests: bank.chests.filter(isChestPlaced).map(({ n, x, y }) => ({ n, x: x!, y: y! })),
	...(opened === undefined ? {} : { opened }),
	rats: bank.rats.filter(isPlaced).map(({ n, at, lucky, x, y, spawnLevel, type, growCap }) => ({
		n,
		at,
		lucky,
		x: x!,
		y: y!,
		spawnLevel: spawnLevel!,
		...(type ? { type } : {}),
		...(growCap !== undefined ? { growCap } : {}),
	})),
	king:
		bank.king && isPlaced(bank.king)
			? {
					n: bank.king.n,
					at: bank.king.at,
					x: bank.king.x!,
					y: bank.king.y!,
					spawnLevel: bank.king.spawnLevel!,
					...(bank.king.type ? { type: bank.king.type } : {}),
				}
			: null,
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
	rollFor: (kind: string, n: number) => Rng,
): Promise<TicketBank> => {
	// the player's strength is part of the key: new gear is a new look, so the spawns still to come are weighted for the player as they are now
	const hero = playerProfile(stored.core);
	const power = `:${powerKey(hero)}`;
	if (!needsLook(bank, siteKey(stored.summary) + power)) return bank;
	const map = await loadMap();
	return map ? placeTickets(bank, map.world, map.key + power, map.rebirths, rollFor, hero) : bank;
};

/**
 * A New Game: the account's game is replaced on the server too, so nothing of the old one is paid or kept. The save being replaced is
 * pinned in the history first (recoverable), then the save, its map, the leaderboard row and the rebirth log are deleted and the ledger
 * starts over (timers at now, nothing granted, no bag, no fight) with the gems kept. With no save left, the next claim pays nothing.
 */
export const startNewGame = async (deps: Pick<ServiceDeps, 'ledgers' | 'saves'>, userId: string, nowMs: number): Promise<void> => {
	const { saves, ledgers } = deps;
	try {
		const old = await saves.load(userId, { world: true });
		if (old?.world) await saves.pin(userId, old, PINNED_KEEP);
	} catch {
		// an unreadable old save must not keep the player from starting over
	}
	await saves.remove?.(userId);
	for (let attempt = 0; attempt < CAS_TRIES; attempt++) {
		const existing = await ledgers.load(userId);
		if (!existing) return; // the first save of the new game creates it
		const next: Ledger = { ...resetLedger(existing, nowMs), ver: existing.ver + 1 };
		if (await ledgers.commit(userId, existing.ver, next)) return;
	}
	throw new Error('the ledger is busy');
};

export type ClaimOutcome = { kind: 'no_save' } | { kind: 'ok'; result: ClaimResult };

const CAS_TRIES = 4;

/** What a ledger step returns: the new ledger and the answer. `skipWrite` marks a poll that may leave the stored row alone (see `onlyTimeMoved`). */
export interface StepOutcome<T> {
	ledger: Ledger;
	result: T;
	skipWrite?: boolean;
}

/** A skipped write lets the stored anchor fall behind by at most this much; after that the poll writes again (far below `UNCLAIMED_SEC`). */
export const ANCHOR_REFRESH_MS = 120_000;

/**
 * Whether `next` differs from the stored ledger only in what the clock moves: the anchor and the spawn timers (`advanceBank` is additive
 * in time, so recomputing them from the older values gives the same result) and the idle combat clock, and the anchor has not fallen more than `ANCHOR_REFRESH_MS` behind.
 */
const onlyTimeMoved = (stored: Ledger, next: Ledger): boolean => {
	if (next.anchorAt - stored.anchorAt >= ANCHOR_REFRESH_MS) return false;
	// the combat clock is time as well while no fight is open (HP and mana that are still moving make the two differ anyway)
	const frozen = (l: Ledger) =>
		JSON.stringify({
			...l,
			ver: 0,
			anchorAt: 0,
			bank: { ...l.bank, accAt: 0, chestAcc: 0, ratAcc: 0, kingAcc: 0 },
			combat: l.combat && !l.combat.fight ? { ...l.combat, at: 0 } : l.combat,
		});
	return frozen(stored) === frozen(next);
};

export const bankContext = (stored: StoredSave): BankContext => ({
	luck: stored.summary.derived.luck,
	tilesOwned: stored.summary.tilesOwned,
	buildingsOwned: stored.summary.buildingsOwned,
	lakesOwned: stored.summary.derived.lakesOwned ?? 0,
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
	step: (ledger: Ledger, stored: StoredSave) => StepOutcome<T> | Promise<StepOutcome<T>>,
): Promise<{ kind: 'no_save' } | { kind: 'ok'; result: T; ledger: Ledger }> => {
	for (let attempt = 0; attempt < CAS_TRIES; attempt++) {
		const stored = await deps.saves.load(userId);
		if (!stored) return { kind: 'no_save' };
		const existing = await deps.ledgers.load(userId);
		const seeded = existing ?? seedLedger(stored, nowMs);
		// the bag, the gear and the pity are the ledger's (seeded from the save the first time); the engine sees the save with them in place
		const base: Ledger = { ...seeded, inv: fitInventory(seeded.inv ?? inventoryFromCore(stored.core), stored.core) };
		const out = await step(base, { ...stored, core: coreWithInventory(stored.core, base.inv) as StoredSave['core'] });
		// a read-only poll that found nothing new does not write: the spawn timers and the anchor are recomputed from the clock next time
		if (out.skipWrite && existing && onlyTimeMoved(existing, out.ledger))
			return { kind: 'ok', result: out.result, ledger: { ...out.ledger, ver: existing.ver } };
		const next: Ledger = { ...out.ledger, ver: (existing?.ver ?? 0) + 1 };
		if (await deps.ledgers.commit(userId, existing?.ver ?? 0, next)) return { kind: 'ok', result: out.result, ledger: next };
	}
	throw new Error('the ledger is busy');
};

/**
 * Pays an absence. The gap is measured on the server clock from the later of the last accepted save and the last claim, so it
 * cannot be lengthened by the client; it is capped (8 h + Night Watch) and paid at the efficiency (50 % + Steward) of the income the
 * last accepted save earns. Chests, normal monsters and a boss that would have appeared come with it as tickets. The claim moves the anchor to
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
		/**
		 * first the stretch the player was still here (their own spawn timers were running), then the absence at its efficiency
		 * the land is looked at first (monsters only come while it has a free tile for them), and again for the monsters this claim makes
		 */
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
