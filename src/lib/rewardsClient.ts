import type { CombatCommand } from '@/lib/offline/fightTypes';
import type { ChestReward, CraftReply, FightReply, InventoryOp, InventoryReply, RebirthReply, SyncResult } from '@/lib/offline/types';
import type { TutorialReply, TutorialRequest } from '@/lib/offline/tutorial';
import type { AchievementReport } from '@/lib/offline/achievements';
import { epochFetch } from '@/lib/epochFetch';

// The browser side of /api/spawn, /api/chest and /api/fight: the server decides what exists, what is inside and how every fight goes; the browser asks.

export type Reply<T> =
	| { status: 'ok'; value: T }
	| { status: 'need_claim' } // an absence has to be claimed first (POST /api/offline)
	| { status: 'no_save' } // no cloud save yet: nothing to ask about
	| { status: 'not_configured' } // the server has no LOOT_SECRET: it cannot seal rolls
	| { status: 'unavailable' }; // not set up, an outage, signed out

// The version of the inventory this browser holds: sent with every online request, so the server answers with the inventory when it is a newer one.
let invVerOf: () => number | null = () => null;
export const provideInvVer = (fn: () => number | null): void => {
	invVerOf = fn;
};

// Where the achievements an answer carries go (the achievement store registers itself here): every online answer can have paid one, whichever request found it.
let achievementSink: ((report: AchievementReport) => void) | null = null;
export const provideAchievementSink = (fn: (report: AchievementReport) => void): void => {
	achievementSink = fn;
};

const post = async <T>(path: string, body: unknown): Promise<Reply<T>> => {
	const invVer = path === '/api/inventory' ? null : invVerOf();
	if (invVer !== null && typeof body === 'object' && body !== null) body = { ...body, invVer };
	try {
		const response = await epochFetch(path, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
		if (response.status === 409) return { status: 'need_claim' };
		if (response.status === 404) return { status: 'no_save' };
		if (!response.ok) {
			const reply = (await response.json().catch(() => ({}))) as { reason?: string };
			return reply.reason === 'not_configured' ? { status: 'not_configured' } : { status: 'unavailable' };
		}
		const value = (await response.json()) as T;
		const report = (value as { achievements?: AchievementReport } | null)?.achievements;
		if (report && Array.isArray(report.earned)) achievementSink?.(report);
		return { status: 'ok', value };
	} catch {
		return { status: 'unavailable' };
	}
};

/** `since`: the number of the last combat event this browser has applied (leave it out to take none: the answer says where the log stands). */
export const requestSync = (since?: number): Promise<Reply<SyncResult>> => post<SyncResult>('/api/spawn', since === undefined ? {} : { since });

/** Opens the chest on this tile (the server put it there; a tile with no chest answers `no_ticket`). */
export const requestChest = (key: string, x: number, y: number): Promise<Reply<ChestReward>> => post<ChestReward>('/api/chest', { key, x, y });

/** One of the player's own changes to what they carry. The answer is the inventory as it stands, and the gold a sale paid. */
export const requestInventory = (key: string, op: InventoryOp): Promise<Reply<InventoryReply>> => post<InventoryReply>('/api/inventory', { key, ...op });

/** Queues `count` crafts of a recipe as a timed batch (up to the batch cap; a recipe without a time is done at once); count 0 only asks for the crafting state. The browser has paid the resources already. */
export const requestCraft = (key: string, recipeId: string, count: number): Promise<Reply<CraftReply>> =>
	post<CraftReply>('/api/craft', { key, recipeId, count });

/** Delivers the finished crafts of a batch (the bag, or the component stock) with their XP. */
export const requestCraftClaim = (key: string, slot: number | 'all' = 0): Promise<Reply<CraftReply>> => post<CraftReply>('/api/craft/claim', { key, slot });

/** Moves crafted potions or trade goods from the crafting stash into the bag (as many as fit). */
export const requestCraftWithdraw = (key: string, id: string, qty: number): Promise<Reply<CraftReply>> =>
	post<CraftReply>('/api/craft/stash', { key, id, qty });

/** Ends a batch: the finished crafts are delivered, the unfinished ones refunded (the answer names the resources to give back). */
export const requestCraftCancel = (key: string, slot = 0): Promise<Reply<CraftReply>> => post<CraftReply>('/api/craft/cancel', { key, slot });

/** Asks the server to run the rebirth (it judges the last stored save, computes the Embers and wipes its bag and gear). One key per rebirth attempt. */
export const requestRebirth = (key: string): Promise<Reply<RebirthReply>> => post<RebirthReply>('/api/rebirth', { key });

/** A hotkey: drink a potion or cast a skill. One key per press: the server replays the answer if it is sent twice. */
export const requestUse = (key: string, command: CombatCommand, since: number | undefined): Promise<Reply<FightReply>> =>
	post<FightReply>('/api/fight', { action: 'use', key, command, since });

/** Switches auto-battle and/or auto-use. */
export const requestAuto = (switches: { autoBattle?: boolean; autoUse?: boolean }, since: number | undefined): Promise<Reply<FightReply>> =>
	post<FightReply>('/api/fight', { action: 'auto', ...switches, since });

/** Takes a monster off the map with no reward. */
export const requestDismiss = (key: string, n: number, since: number | undefined): Promise<Reply<FightReply>> =>
	post<FightReply>('/api/fight', { action: 'dismiss', key, n, since });

/** The guided tutorial: `sync` reads the account's progress; `done`, `lesson` and `skip` record it (one key per request) and a finished step may pay its starter bundle. */
export const requestTutorial = (key: string, request: TutorialRequest): Promise<Reply<TutorialReply>> =>
	post<TutorialReply>('/api/tutorial', { key, ...request });
