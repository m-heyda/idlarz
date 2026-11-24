import { EMBER_MODEL } from '@/lib/cloudSave/emberModel';
import { currentCloudSaver } from '@/lib/manualCloudSave';
import { newClaimId } from '@/lib/offlineClient';
import { requestRebirth } from '@/lib/rewardsClient';
import type { KeepRef } from '@/lib/rebirthKeep';
import type { ItemInstance } from '@/types/game';

/**
 * The browser's side of the server-run rebirth (IDL-102, `POST /api/rebirth`). The rebirth is asked of the server FIRST: the game uploads its
 * save (so the server judges the game the player is looking at), the server checks the requirements, computes the Embers and wipes its bag and
 * gear, and only then does the browser start the new run with the Embers the server named. The save that follows is capped at that number.
 *
 *  - `ok`: the server ran it; `gain` is what it pays and `kept` the legendary pieces it carried into the new bag (the places the player picked, read from the server's own inventory).
 *  - `refused`: the server does not see a rebirth in the stored save (not ready yet, or it would pay nothing): the browser must not start one. `badKeep`: the picks did not stand (the bag changed since).
 *  - `unavailable`: no cloud save this session, or the server could not be reached. The browser rebirths on its own, as before, and keeps nothing (the server wipes its inventory
 *    when that save lands); the server still bounds the Embers of that save (`settleEmbers`).
 */
export type ServerRebirthResult = { status: 'ok'; gain: number; kept: ItemInstance[] } | { status: 'refused'; badKeep?: boolean } | { status: 'unavailable' };

export const askServerRebirth = async (keep: readonly KeepRef[] = []): Promise<ServerRebirthResult> => {
	const saver = currentCloudSaver();
	if (!saver) return { status: 'unavailable' };
	await saver.run(); // 'busy' / 'retry' / 'stopped': the request below still judges whatever is stored
	const key = newClaimId();
	let reply = await requestRebirth(key, keep);
	if (reply.status === 'unavailable') reply = await requestRebirth(key, keep); // the same key: a lost answer is replayed, not paid twice
	if (reply.status !== 'ok') return { status: 'unavailable' };
	if (reply.value.ok) return { status: 'ok', gain: reply.value.gain, kept: reply.value.kept ?? [] };
	return { status: 'refused', ...(reply.value.reason === 'bad_keep' ? { badKeep: true } : {}) };
};

/**
 * Whether the browser must NOT rebirth on its own after this answer: only when the server demands to run every rebirth (`EMBER_MODEL.requireServerRebirth`, switched on with enforcement) and it could not be asked (`unavailable`). A rebirth the server
 * never recorded is reverted by the next save, so starting it locally would lose the run; the dialog says "try again" instead. With the switch off (today) this is always false and the browser rebirths locally as before.
 */
export const blocksLocalRebirth = (answer: ServerRebirthResult, requireServer: boolean = EMBER_MODEL.requireServerRebirth): boolean =>
	requireServer && answer.status === 'unavailable';
