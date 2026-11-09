import { createHmac } from 'node:crypto';
import type { Rng } from '@/lib/rng';

// SERVER ONLY (node:crypto). A reward is a pure function of a secret only the server has and of where the reward sits in the
// player's history, so the browser cannot compute it ahead of time and reloading the page cannot roll it again.

/**
 * A random source for one reward: `kind` and `ordinal` name it (the 7th chest of this run, rat ticket 12, ...), `runId` separates a
 * player's runs (a rebirth or a new game starts again at ordinal 1 without repeating the old rewards). Every draw is a fresh HMAC of
 * (secret, key, draw number), so there is no short seed to brute-force.
 *
 * Sealed rolls: every reward is seeded by `HMAC-SHA256(LOOT_SECRET, userId | runId | kind | ordinal)` with a fresh digest per draw. The ordinal is consumed on the server, so a reload cannot reroll.
 * A rebirth or New Game starts a new run id. `LOOT_SECRET` is server-only; without it `/api/offline`, `/api/spawn`, `/api/chest` and `/api/fight` answer 503.
 *
 * @category Saves & Server/The ledger
 * @order 2
 */
export const sealedRng = (secret: string, userId: string, runId: number, kind: string, ordinal: number): Rng => {
	if (!secret) throw new Error('the loot secret is not configured');
	const key = `${userId}|${runId}|${kind}|${ordinal}`;
	let draw = 0;
	return () => {
		const digest = createHmac('sha256', secret).update(`${key}|${draw++}`).digest();
		return digest.readUIntBE(0, 6) / 2 ** 48;
	};
};
