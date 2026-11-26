// paragonSync.ts
// The paragon points are the server's (ledger `paragon`, @category Saves & Server, docs/plan/paragon.md): the browser previews a point at once (`spendParagon`) and asks the server for it here, like the attribute points (characterSync.ts).

import { paragonRoom, paragonUpgrade, type ParagonId } from '@/config/paragon';
import { paragonFree, type Paragon } from '@/lib/offline/paragon';
import { newClaimId } from '@/lib/offlineClient';
import { currentCloudSaver } from '@/lib/manualCloudSave';
import { requestParagon } from '@/lib/rewardsClient';
import { notify } from '@/lib/notices';
import { ratesWithGear, type GameGet, type GameSet } from './base';

/** How long a burst of clicks waits before it is sent as one request. */
const BATCH_MS = 350;

export const createParagonSync = (set: GameSet, get: GameGet) => {
	let pending: Partial<Record<ParagonId, number>> = {};
	let timer: ReturnType<typeof setTimeout> | undefined;
	let inFlight = 0;
	let chain: Promise<void> = Promise.resolve();
	let gen = 0;
	let ver = 0;

	const busy = () => inFlight > 0 || Object.keys(pending).length > 0;

	/** Puts the browser's record in line with the server's: the points in each upgrade, and every rate the bonuses change. */
	const applyParagon = (paragon: Paragon) => {
		if (paragon.ver < ver) return;
		ver = paragon.ver;
		const state = get();
		if (JSON.stringify(state.paragonSpent) === JSON.stringify(paragon.spent)) return;
		const next = { ...state, paragonSpent: paragon.spent };
		set({ paragonSpent: paragon.spent, resourceRates: ratesWithGear(next, state.equipment) });
	};

	const send = async (add: Partial<Record<ParagonId, number>>) => {
		const key = newClaimId();
		const body = add as Record<string, number>;
		let reply = await requestParagon(key, { action: 'allocate', add: body });
		if (reply.status === 'unavailable') reply = await requestParagon(key, { action: 'allocate', add: body });
		// the server may not have seen the XP yet (it reaches it with the next upload): upload, and ask once more with a new key
		if (reply.status === 'ok' && !reply.value.ok && reply.value.reason === 'no_points') {
			const saver = currentCloudSaver();
			if (saver) {
				await saver.run();
				reply = await requestParagon(newClaimId(), { action: 'allocate', add: body });
			}
		}
		return reply;
	};

	const flush = () => {
		clearTimeout(timer);
		timer = undefined;
		const add = pending;
		pending = {};
		if (Object.keys(add).length === 0) return;
		inFlight++;
		const mine = gen;
		chain = chain.then(async () => {
			if (mine !== gen) return;
			const reply = await send(add);
			if (mine !== gen) return;
			inFlight--;
			if (reply.status === 'ok') {
				if (!reply.value.ok) {
					notify(reply.value.reason === 'no_points' ? 'The server has not counted that paragon level yet. Try again in a moment.' : 'The server did not take that point.', 'error');
					if (!busy()) ver = 0; // the truth wins even when it is not newer
				}
				if (!busy()) applyParagon(reply.value.paragon);
				else ver = Math.max(ver, reply.value.paragon.ver);
				return;
			}
			if (reply.status === 'unavailable') notify('Could not reach the server: the paragon points will be checked at the next save.', 'error');
		});
	};

	/** Previews `n` points in one upgrade at once (refused when none are free or the upgrade is full) and asks the server for them (a burst of clicks is one request). */
	const spendParagon = (id: ParagonId, n = 1): number => {
		const u = paragonUpgrade(id);
		if (!u) return 0;
		const state = get();
		const have = state.paragonSpent[id] ?? 0;
		const free = paragonFree(state.resources.xp, state.paragonSpent);
		const take = Math.min(n, free, paragonRoom(u, have));
		if (take <= 0) return 0;
		const spent = { ...state.paragonSpent, [id]: have + take };
		set({ paragonSpent: spent, resourceRates: ratesWithGear({ ...state, paragonSpent: spent }, state.equipment) });
		pending[id] = (pending[id] ?? 0) + take;
		clearTimeout(timer);
		timer = setTimeout(flush, BATCH_MS);
		return take;
	};

	/** Reads the server's record (when the game starts, and after a respec) and takes it, unless a change of our own is still on its way. */
	const syncParagon = async () => {
		if (busy()) return;
		const mine = gen;
		const reply = await requestParagon(null, { action: 'sync' });
		if (mine !== gen || busy() || reply.status !== 'ok') return;
		ver = 0;
		applyParagon(reply.value.paragon);
	};

	/** A New Game starts the record again: nothing in flight is waited for. */
	const reset = () => {
		gen++;
		clearTimeout(timer);
		timer = undefined;
		pending = {};
		inFlight = 0;
		chain = Promise.resolve();
		ver = 0;
	};

	return { applyParagon, spendParagon, syncParagon, resetParagonSync: reset };
};

export type ParagonSync = ReturnType<typeof createParagonSync>;
