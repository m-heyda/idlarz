import { createHash } from 'node:crypto';
import { SAVE_SCHEMA, decodeSave, packBody, sealWire, type SaveBody } from '@/lib/saveFormat';
import { checkNetWorth } from './netWorth';
import { summarize, type SaveSummary } from './summary';
import { POISON_FLAGS, VERIFY, verifyTransition, type SaveFlag, type Snapshot } from './verify';

/** Accepted saves are copied into the history when this long passed since the last copy (not every N revisions: event saves make the revision count race ahead of the clock), and when a flag appears that the previous save did not have. */
export const HISTORY_EVERY_MS = 30 * 60_000;
/** How many history copies are kept per player, and how many extra pinned ones. */
export const HISTORY_KEEP = 6;
export const PINNED_KEEP = 3;
/** Saves from one player are accepted at most this often (an honest client sends every ~90 s). */
export const MIN_SAVE_INTERVAL_MS = 10_000;

/** The map: large, changes only when land is bought or built on. Stored apart so a save that did not change it never rewrites it. */
export interface WorldPart {
	hash: string;
	land: unknown;
	extra: unknown;
	tiles: number;
}

/**
 * One stored save. `core` is everything but the map (small); `world` is the map and is only present when it was asked for.
 * Everything else is derived by the server and lives in typed columns.
 */
export interface StoredSave {
	rev: number;
	schema: number;
	core: SaveBody;
	worldHash: string;
	world?: WorldPart;
	summary: SaveSummary;
	flags: SaveFlag[];
	auditRatio: number;
	freshStart: boolean;
	everFlagged: boolean;
	/** Saved through a non-production server (local dev, preview): never ranked, flags never count against the account. Sticky. */
	testAccount: boolean;
	serverSavedAt: number;
	createdAt: number;
	/** When the history last got a full copy of this player's game. */
	lastArchiveAt: number;
}

/** What the leaderboard row of an account holds (the display name comes from the profile, never from the save). */
export interface StatsRow {
	displayName: string;
	trusted: boolean;
}

/** Storage behind the pipeline; Supabase in the app, a Map in tests. */
export interface SaveRepo {
	/** The small row. With `world` the map comes along (needed to give a save back or to keep a copy, never to verify one). */
	load(userId: string, options?: { world?: boolean }): Promise<StoredSave | null>;
	/**
	 * Atomically: replace (or, with `baseRev` 0, create) the save if it is still at `baseRev`, store `world` when given,
	 * and update the leaderboard row. False when someone else got there first.
	 */
	commit(userId: string, baseRev: number, save: StoredSave, world: WorldPart | null, stats: StatsRow): Promise<boolean>;
	/** Keeps a copy of a full save (map included) and drops all but the newest `keep` unpinned ones. */
	archive(userId: string, save: StoredSave, keep: number): Promise<void>;
	/** Keeps a copy of a full save that ordinary trimming never drops (only the newest `keep` pinned ones stay). */
	pin(userId: string, save: StoredSave, keep: number): Promise<void>;
}

export type SaveOutcome =
	| { kind: 'ok'; rev: number; serverSavedAt: number; flags: SaveFlag[] }
	| { kind: 'conflict'; rev: number; serverSavedAt: number }
	| { kind: 'invalid'; reason: string }
	| { kind: 'too_soon'; retryAfterMs: number };

const hashWorld = (land: unknown, extra: unknown): string => createHash('sha256').update(JSON.stringify([land, extra])).digest('hex');

/** Splits a canonical save body into the small part and the map. */
export const splitBody = (body: SaveBody, tiles: number): { core: SaveBody; world: WorldPart } => {
	const { land, extra, ...core } = body;
	return { core, world: { hash: hashWorld(land, extra), land, extra, tiles } };
};

/** Puts a stored save back together as the text the client imports (the client migrates and sanitizes it again). */
export const storedToText = (stored: StoredSave): string => {
	if (!stored.world) throw new Error('the map was not loaded');
	return sealWire({ v: stored.schema, t: stored.serverSavedAt, s: { ...stored.core, land: stored.world.land, extra: stored.world.extra } });
};

/**
 * Accepts a save from a client that says it was based on revision `baseRev` (0 = this account has no save yet).
 *   - the text must decode (checksum, schema, `sanitizeSave`), otherwise `invalid`
 *   - a stale `baseRev` is a `conflict`: the player picks a side in the hub, nothing is overwritten silently
 *   - the stored copy is rebuilt from the sanitized state, and rates and headline numbers are computed here
 *   - the spending check and the transition from the previous save are verified in shadow mode (flags, no rejection)
 *   - the map is only written when it changed; every ~30 min (by the clock) and when a new flag appears a full copy goes to the history
 */
export const acceptSave = async (
	repo: SaveRepo,
	userId: string,
	displayName: string,
	text: string,
	baseRev: number,
	nowMs: number,
	/** True when this server is not production (see environment.ts). The route decides; nothing from the request is involved. */
	nonProduction = false,
): Promise<SaveOutcome> => {
	const decoded = decodeSave(text);
	if (!decoded.ok) return { kind: 'invalid', reason: decoded.reason };
	const state = decoded.state;

	const current = await repo.load(userId);
	if (current && current.rev !== baseRev) return { kind: 'conflict', rev: current.rev, serverSavedAt: current.serverSavedAt };
	if (!current && baseRev !== 0) return { kind: 'conflict', rev: 0, serverSavedAt: 0 };
	if (current && nowMs - current.serverSavedAt < MIN_SAVE_INTERVAL_MS) {
		return { kind: 'too_soon', retryAfterMs: MIN_SAVE_INTERVAL_MS - (nowMs - current.serverSavedAt) };
	}

	const summary = summarize(state);
	const previous: Snapshot | null = current ? { summary: current.summary, serverSavedAt: current.serverSavedAt } : null;
	const flags = verifyTransition(previous, summary, nowMs);
	const worth = checkNetWorth(state, summary);
	if (worth.exceeds) flags.push('networth_exceeds');

	// Starting over (New Game) must not push the old game out of the history: pin the save that is about to be replaced
	if (current && flags.includes('playtime_regress')) {
		const old = await repo.load(userId, { world: true });
		if (old?.world && old.rev === current.rev) await repo.pin(userId, old, PINNED_KEEP);
	}

	const { core, world } = splitBody(packBody(state), summary.tilesOwned);
	// A test account's findings are still recorded (they show the checks working) but never count against it, and it is never ranked
	const testAccount = (current?.testAccount ?? false) || nonProduction;
	const everFlagged = !testAccount && ((current?.everFlagged ?? false) || flags.some((flag) => POISON_FLAGS.has(flag)));
	const freshStart = current ? current.freshStart : summary.playSeconds <= VERIFY.freshStartSec;

	// A flag already on the previous save is not archived again: an account that stays flagged must not make us store a full copy every upload (test accounts only get the regular copies)
	const newFlag = !testAccount && flags.some((flag) => !(current?.flags ?? []).includes(flag));
	const archive = !current || nowMs - current.lastArchiveAt >= HISTORY_EVERY_MS || newFlag;

	const save: StoredSave = {
		rev: (current?.rev ?? 0) + 1,
		schema: SAVE_SCHEMA,
		core,
		worldHash: world.hash,
		summary,
		flags,
		auditRatio: Number.isFinite(worth.ratio) ? worth.ratio : 1e9,
		freshStart,
		everFlagged,
		testAccount,
		serverSavedAt: nowMs,
		createdAt: current?.createdAt ?? nowMs,
		lastArchiveAt: archive ? nowMs : (current?.lastArchiveAt ?? nowMs),
	};
	const worldChanged = !current || current.worldHash !== world.hash;
	const written = await repo.commit(userId, baseRev, save, worldChanged ? world : null, { displayName, trusted: !testAccount && freshStart && !everFlagged });
	if (!written) {
		const latest = await repo.load(userId);
		return { kind: 'conflict', rev: latest?.rev ?? 0, serverSavedAt: latest?.serverSavedAt ?? 0 };
	}

	if (archive) await repo.archive(userId, { ...save, world }, HISTORY_KEEP);
	return { kind: 'ok', rev: save.rev, serverSavedAt: nowMs, flags };
};
