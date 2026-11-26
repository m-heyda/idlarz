import { KEY } from '@/lib/idempotencyKey';
import type { GuestAnswer, GuestTransport } from '@/lib/guestMode';
import { runGems } from '@/lib/offline/gemsFlow';
import { parseGemsBody } from '@/lib/offline/gemsParse';
import { parseClaimSlot, parseCraft, parseSlot, parseWithdraw } from '@/lib/offline/craft';
import { parseOp } from '@/lib/offline/inventory';
import { claimOffline, type ServiceDeps } from '@/lib/offline/service';
import {
	characterStep,
	craftStep,
	fightStep,
	inventoryStep,
	masteryStep,
	paragonStep,
	petsStep,
	rebirthStep,
	redeemChest,
	hitRock,
	syncTickets,
	tutorialStep,
	type FightRequest,
	type Online,
} from '@/lib/offline/online';
import type { CharacterRequest, MasteryRequest, ParagonRequest } from '@/lib/offline/gemTypes';
import type { TutorialRequest } from '@/lib/offline/tutorial';
import type { PetsRequest } from '@/lib/offline/pets';
import { isSkillId } from '@/lib/skills';
import { COORD_LIMIT } from '@/utils/world';
import { ROCK } from '@/config/rocks';
import type { GameState } from '@/types/game';
import type { StoredSave } from '@/lib/cloudSave/pipeline';
import {
	GUEST_SECRET,
	buildStored,
	forgetGuestLedger,
	guestUserId,
	landSave,
	localIdentityRepo,
	localLedgerRepo,
	localSaveRepo,
	readSeenAt,
	startedOver,
	writeSeenAt,
} from '@/lib/guest/localRepos';

/**
 * Guest mode: the game's /api calls answered in the browser by the same engine the server runs (`src/lib/offline/*`: spawns, chests, fights, loot, crafting, the gem shop, rebirth, offline claims), against the guest's own
 * ledger in `localStorage` and a "saved game" built from the live game. Nothing leaves the browser, nothing is checked against a database, and nothing is ranked: the loot secret is public and the save is never verified, so a guest may cheat, and
 * that is why none of it can ever be sent anywhere. It is installed only on `/guest` (`installGuest`) and loaded only there, so a signed-in player's bundle does not contain it.
 *
 * @title Guest mode
 * @category Architecture/Guest mode
 * @order 1
 */

/** The save is rebuilt from the live game at most this often (a poll every few seconds does not need a new map hash each time). */
const REBUILD_MS = 1500;

/** The routes the engine answers (the ones that need the guest's saved game prepared first). */
const ENGINE_ROUTES = ['offline', 'spawn', 'chest', 'rock', 'fight', 'inventory', 'craft', 'rebirth', 'gems', 'mastery', 'character', 'paragon', 'tutorial', 'pets'];

const intOrUndefined = (value: unknown): number | undefined => (Number.isInteger(value) && (value as number) >= 0 ? (value as number) : undefined);
const key = (value: unknown): string | null => (typeof value === 'string' && KEY.test(value) ? value : null);
const tile = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && Math.abs(v) <= COORD_LIMIT;
const ID = /^[A-Za-z0-9_-]{1,40}$/;

const bad = (): GuestAnswer => ({ status: 400, body: { error: 'Bad request.' } });
const ok = (body: unknown): GuestAnswer => ({ status: 200, body });
const answered = (out: Online<unknown> | { kind: 'no_save' }): GuestAnswer => {
	if (out.kind === 'no_save') return { status: 404, body: { error: 'No save yet.', noSave: true } };
	if (out.kind === 'claim_first') return { status: 409, body: { error: 'Claim your time away first.', needClaim: true } };
	return ok(out.value);
};

/** The fight request of a body, as `/api/fight` reads it. */
const fightRequest = (body: Record<string, unknown>): { key: string | null; request: FightRequest } | null => {
	const since = intOrUndefined(body.since);
	const k = key(body.key);
	switch (body.action) {
		case 'sync':
			return { key: null, request: { action: 'sync', since } };
		case 'use': {
			const command = body.command as { kind?: unknown; id?: unknown; n?: unknown } | undefined;
			if (!k || !command) return null;
			if ((command.kind === 'fight' || command.kind === 'unqueue') && Number.isInteger(command.n) && (command.n as number) > 0)
				return { key: k, request: { action: 'use', command: { kind: command.kind, n: command.n as number }, since } };
			if (typeof command.id !== 'string') return null;
			if (command.kind === 'potion') return { key: k, request: { action: 'use', command: { kind: 'potion', id: command.id }, since } };
			if (command.kind === 'skill' && isSkillId(command.id)) return { key: k, request: { action: 'use', command: { kind: 'skill', id: command.id }, since } };
			return null;
		}
		case 'auto': {
			const autoBattle = typeof body.autoBattle === 'boolean' ? body.autoBattle : undefined;
			const autoUse = typeof body.autoUse === 'boolean' ? body.autoUse : undefined;
			return autoBattle === undefined && autoUse === undefined ? null : { key: null, request: { action: 'auto', autoBattle, autoUse, since } };
		}
		case 'dismiss':
			return k && Number.isInteger(body.n) && (body.n as number) > 0 ? { key: k, request: { action: 'dismiss', n: body.n as number, since } } : null;
		default:
			return null;
	}
};

/**
 * The guest's door: one function that takes what the browser would have posted and answers as the route would (status and JSON). Requests are served one at a time, like the database's compare-and-swap would serialise them.
 * `getGame` reads the live game (the engine reads rates, luck, the map and the gear from it).
 */
export const createGuestTransport = (getGame: () => GameState): GuestTransport => {
	const userId = guestUserId();
	const ledgers = localLedgerRepo();
	let stored: StoredSave | null = null;
	let builtAt = 0;
	let landedAt = 0;
	let savedAtMs: number | null = null;
	const deps: ServiceDeps = { ledgers, saves: localSaveRepo(() => stored), secret: GUEST_SECRET };
	const identity = localIdentityRepo(() => ({ characterName: getGame().playerName, playerClass: getGame().playerClass, nameChangedAtSec: null }));

	/** Builds the saved game the engine reads and does what accepting a save does on the server (counters, trades, the run), before every request but the claim at the start (its absence is measured from the last time the guest was here). */
	const prepare = async (nowMs: number, claim: boolean): Promise<void> => {
		let ledger = await ledgers.load(userId);
		savedAtMs ??= ledger ? (readSeenAt() ?? ledger.anchorAt) : nowMs;
		if (!stored || claim || nowMs - builtAt >= REBUILD_MS) {
			stored = buildStored(getGame(), ledger?.gems ?? null, savedAtMs);
			builtAt = nowMs;
		}
		if (ledger && startedOver(stored)) {
			// a New Game: the engine's record of the old one goes, the next request starts it again from this game
			forgetGuestLedger();
			ledger = null;
			savedAtMs = nowMs;
			stored = buildStored(getGame(), null, savedAtMs);
		}
		if (!ledger || (!claim && nowMs - landedAt >= REBUILD_MS)) {
			const landed = landSave(ledger, stored, nowMs);
			await ledgers.commit(userId, landed.expectedVer, landed.ledger);
			landedAt = nowMs;
		}
	};

	const handle = async (path: string, body: Record<string, unknown>, nowMs: number): Promise<GuestAnswer> => {
		const invVer = intOrUndefined(body.invVer);
		const k = key(body.key);
		switch (path) {
			case '/api/offline': {
				const claimId = typeof body.claimId === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(body.claimId) ? body.claimId : null;
				if (!claimId) return bad();
				const out = await claimOffline(deps, userId, claimId, nowMs);
				return out.kind === 'no_save' ? answered(out) : ok(out.result);
			}
			case '/api/spawn':
				return answered(await syncTickets(deps, userId, nowMs, intOrUndefined(body.since), invVer));
			case '/api/chest':
				return k && tile(body.x) && tile(body.y) ? answered(await redeemChest(deps, userId, k, { x: body.x, y: body.y }, nowMs, invVer)) : bad();
			case '/api/rock':
				return k &&
					tile(body.x) &&
					tile(body.y) &&
					typeof body.clicks === 'number' &&
					Number.isInteger(body.clicks) &&
					body.clicks >= 1 &&
					body.clicks <= ROCK.maxBatch
					? answered(await hitRock(deps, userId, k, { x: body.x, y: body.y }, body.clicks, nowMs, invVer))
					: bad();
			case '/api/fight': {
				const parsed = fightRequest(body);
				return parsed ? answered(await fightStep(deps, userId, parsed.key, parsed.request, nowMs, invVer)) : bad();
			}
			case '/api/inventory': {
				const op = parseOp(body);
				return k && op ? answered(await inventoryStep(deps, userId, k, op, nowMs)) : bad();
			}
			case '/api/craft': {
				const craft = parseCraft(body);
				return k && craft ? answered(await craftStep(deps, userId, k, { recipeId: craft.recipeId, count: craft.count }, nowMs)) : bad();
			}
			case '/api/craft/claim': {
				const slot = parseClaimSlot(body);
				return k && slot ? answered(await craftStep(deps, userId, k, { action: 'claim', slot: slot.slot }, nowMs)) : bad();
			}
			case '/api/craft/cancel': {
				const slot = parseSlot(body);
				return k && slot ? answered(await craftStep(deps, userId, k, { action: 'cancel', slot: slot.slot }, nowMs)) : bad();
			}
			case '/api/craft/stash': {
				const withdraw = parseWithdraw(body);
				return k && withdraw ? answered(await craftStep(deps, userId, k, { action: 'withdraw', id: withdraw.id, qty: withdraw.qty }, nowMs)) : bad();
			}
			case '/api/rebirth':
				return k ? answered(await rebirthStep(deps, userId, k, nowMs)) : bad();
			case '/api/gems': {
				const parsed = parseGemsBody(body);
				return parsed ? answered(await runGems(deps, identity, userId, parsed.key, parsed.request, nowMs)) : bad();
			}
			case '/api/mastery': {
				if (!k) return bad();
				const request: MasteryRequest | null =
					body.action === 'claimAll'
						? { action: 'claimAll' }
						: body.action === 'claim' && typeof body.type === 'string' && body.type.length > 0 && body.type.length <= 40 && Number.isInteger(body.tier)
							? { action: 'claim', type: body.type, tier: body.tier as number }
							: body.action === 'claimBiome' &&
								  typeof body.biome === 'string' &&
								  body.biome.length > 0 &&
								  body.biome.length <= 40 &&
								  Number.isInteger(body.tier)
								? { action: 'claimBiome', biome: body.biome, tier: body.tier as number }
								: null;
				return request ? answered(await masteryStep(deps, userId, k, request, nowMs)) : bad();
			}
			case '/api/character': {
				if (body.action === 'sync') return answered(await characterStep(deps, userId, null, { action: 'sync' }, nowMs));
				if (body.action !== 'allocate' || !k || typeof body.add !== 'object' || body.add === null || Array.isArray(body.add)) return bad();
				const request: CharacterRequest = { action: 'allocate', add: body.add as Record<string, number> };
				return answered(await characterStep(deps, userId, k, request, nowMs));
			}
			case '/api/paragon': {
				if (body.action === 'sync') return answered(await paragonStep(deps, userId, null, { action: 'sync' }, nowMs));
				if (body.action !== 'allocate' || !k || typeof body.add !== 'object' || body.add === null || Array.isArray(body.add)) return bad();
				const request: ParagonRequest = { action: 'allocate', add: body.add as Record<string, number> };
				return answered(await paragonStep(deps, userId, k, request, nowMs));
			}
			case '/api/tutorial': {
				if (body.action === 'sync') return answered(await tutorialStep(deps, userId, null, { action: 'sync' }, nowMs, invVer));
				if (!k) return bad();
				if (body.action === 'skip') return answered(await tutorialStep(deps, userId, k, { action: 'skip' }, nowMs, invVer));
				if ((body.action === 'done' || body.action === 'lesson') && typeof body.id === 'string' && ID.test(body.id))
					return answered(await tutorialStep(deps, userId, k, { action: body.action, id: body.id } as TutorialRequest, nowMs, invVer));
				return bad();
			}
			case '/api/pets': {
				if (!k) return bad();
				const request: PetsRequest | null =
					body.action === 'sync'
						? { action: 'sync' }
						: body.action === 'ack' && typeof body.id === 'string' && ID.test(body.id)
							? { action: 'ack', id: body.id }
							: null;
				// no pet is granted to a guest (the gift belongs to one account)
				return request ? answered(await petsStep(deps, userId, k, request, '', nowMs)) : bad();
			}
			case '/api/rebirths':
				return ok({ entries: [] });
			default:
				// everything else (the cloud save, accounts, rankings) is an account's: not available to a guest
				return { status: 404, body: { error: 'Not available in guest mode.' } };
		}
	};

	let queue: Promise<unknown> = Promise.resolve();
	return (path, body) => {
		const run = async (): Promise<GuestAnswer> => {
			const nowMs = Date.now();
			const gameCall = ENGINE_ROUTES.some((route) => path === `/api/${route}` || path.startsWith(`/api/${route}/`));
			if (gameCall) await prepare(nowMs, path === '/api/offline');
			const answer = await handle(path, body, nowMs);
			// an absence that was refused (`needClaim`) is still the guest's absence: the clock only moves once the engine has taken the game
			if (gameCall && answer.status !== 409) {
				savedAtMs = nowMs;
				writeSeenAt(nowMs);
			}
			return answer;
		};
		const next = queue.then(run, run);
		queue = next.catch(() => undefined);
		return next;
	};
};
