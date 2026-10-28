import type { CombatCommand } from '@/lib/offline/fightTypes';
import type { ChestReward, FightReply, SyncResult } from '@/lib/offline/types';

// The browser side of /api/spawn, /api/chest and /api/fight: the server decides what exists, what is inside and how every fight goes; the browser asks.

export type Reply<T> =
	| { status: 'ok'; value: T }
	| { status: 'need_claim' } // an absence has to be claimed first (POST /api/offline)
	| { status: 'no_save' } // no cloud save yet: nothing to ask about
	| { status: 'not_configured' } // the server has no LOOT_SECRET: it cannot seal rolls
	| { status: 'unavailable' }; // not set up, an outage, signed out

const post = async <T>(path: string, body: unknown): Promise<Reply<T>> => {
	try {
		const response = await fetch(path, {
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
		return { status: 'ok', value: (await response.json()) as T };
	} catch {
		return { status: 'unavailable' };
	}
};

/** `since`: the number of the last combat event this browser has applied (leave it out to take none: the answer says where the log stands). */
export const requestSync = (since?: number): Promise<Reply<SyncResult>> => post<SyncResult>('/api/spawn', since === undefined ? {} : { since });

export const requestChest = (key: string): Promise<Reply<ChestReward>> => post<ChestReward>('/api/chest', { key });

/** Carries the player's fight forward and answers with it. */
export const requestFightSync = (since: number | undefined): Promise<Reply<FightReply>> => post<FightReply>('/api/fight', { action: 'sync', since });

/** A hotkey: drink a potion or cast a skill. One key per press: the server replays the answer if it is sent twice. */
export const requestUse = (key: string, command: CombatCommand, since: number | undefined): Promise<Reply<FightReply>> => post<FightReply>('/api/fight', { action: 'use', key, command, since });

/** Switches auto-battle and/or auto-use. */
export const requestAuto = (switches: { autoBattle?: boolean; autoUse?: boolean }, since: number | undefined): Promise<Reply<FightReply>> =>
	post<FightReply>('/api/fight', { action: 'auto', ...switches, since });

/** Takes a monster off the map with no reward. */
export const requestDismiss = (key: string, n: number, since: number | undefined): Promise<Reply<FightReply>> => post<FightReply>('/api/fight', { action: 'dismiss', key, n, since });
