import { currentCloudSaver } from '@/lib/manualCloudSave';
import { newClaimId } from '@/lib/offlineClient';
import { requestRebirth } from '@/lib/rewardsClient';

/**
 * The browser's side of the server-run rebirth (IDL-102, `POST /api/rebirth`). The rebirth is asked of the server FIRST: the game uploads its
 * save (so the server judges the game the player is looking at), the server checks the requirements, computes the Embers and wipes its bag and
 * gear, and only then does the browser start the new run with the Embers the server named. The save that follows is capped at that number.
 *
 *  - `ok`: the server ran it; `gain` is what it pays.
 *  - `refused`: the server does not see a rebirth in the stored save (not ready yet, or it would pay nothing): the browser must not start one.
 *  - `unavailable`: no cloud save this session, or the server could not be reached. The browser rebirths on its own, as before; the server
 *    still bounds the Embers of that save (`settleEmbers`), and can be told to refuse such rebirths once every client goes through the route.
 */
export type ServerRebirthResult = { status: 'ok'; gain: number } | { status: 'refused' } | { status: 'unavailable' };

export const askServerRebirth = async (): Promise<ServerRebirthResult> => {
	const saver = currentCloudSaver();
	if (!saver) return { status: 'unavailable' };
	await saver.run(); // 'busy' / 'retry' / 'stopped': the request below still judges whatever is stored
	const key = newClaimId();
	let reply = await requestRebirth(key);
	if (reply.status === 'unavailable') reply = await requestRebirth(key); // the same key: a lost answer is replayed, not paid twice
	if (reply.status !== 'ok') return { status: 'unavailable' };
	return reply.value.ok ? { status: 'ok', gain: reply.value.gain } : { status: 'refused' };
};
