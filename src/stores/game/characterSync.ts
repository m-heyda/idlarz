// characterSync.ts
// The attribute points are the server's (ledger `attrs`, docs/reference/saves-and-server.md): the browser previews a point at once (`addStatPoint`) and asks the server for it here.

import { INITIAL_CHARACTER_STATS } from '@/config/character';
import { maxHp, maxMana } from '@/lib/combat';
import { ATTR_KEYS, attributeBudget, spentOf, type Attrs, type AttrKey } from '@/lib/offline/attrs';
import { newClaimId } from '@/lib/offlineClient';
import { currentCloudSaver } from '@/lib/manualCloudSave';
import { requestCharacter } from '@/lib/rewardsClient';
import { calculateCombatStats } from '@/utils/game/character';
import { ratesWithGear, toast, type GameGet, type GameSet } from './base';

/** How long a burst of clicks waits before it is sent as one request. */
const BATCH_MS = 350;

export const createCharacterSync = (set: GameSet, get: GameGet) => {
	let pending: Partial<Record<AttrKey, number>> = {};
	let timer: ReturnType<typeof setTimeout> | undefined;
	let inFlight = 0;
	let chain: Promise<void> = Promise.resolve();
	let gen = 0; // a New Game starts the changes over: an answer that belongs to the game before it is dropped
	let ver = 0;

	const busy = () => inFlight > 0 || Object.keys(pending).length > 0;

	/** Puts the browser's attributes in line with the server's allocation: the five values, the free points for the level the browser knows, every derived number. */
	const applyAttrs = (attrs: Attrs) => {
		if (attrs.ver < ver) return;
		ver = attrs.ver;
		const state = get();
		const stats = { ...state.characterStats };
		for (const key of ATTR_KEYS) stats[key] = INITIAL_CHARACTER_STATS[key] + attrs.alloc[key];
		stats.availablePoints = Math.max(0, attributeBudget(state.level.level, state.prestige.rebirths) - spentOf(attrs.alloc));
		Object.assign(stats, calculateCombatStats(stats));
		const same = ATTR_KEYS.every((key) => stats[key] === state.characterStats[key]) && stats.availablePoints === state.characterStats.availablePoints;
		if (same) return;
		set({
			characterStats: stats,
			resourceRates: ratesWithGear({ ...state, characterStats: stats }, state.equipment),
			playerHp: Math.min(state.playerHp, maxHp(stats, state.equipment)),
			playerMp: Math.min(state.playerMp, maxMana(stats, state.equipment, state.playerClass)),
		});
	};

	const send = async (add: Partial<Record<AttrKey, number>>) => {
		const key = newClaimId();
		let reply = await requestCharacter(key, { action: 'allocate', add: add as Record<string, number> });
		if (reply.status === 'unavailable') reply = await requestCharacter(key, { action: 'allocate', add: add as Record<string, number> });
		// the server may not have seen the level yet (tile XP reaches it with the next upload): upload, and ask once more with a new key
		if (reply.status === 'ok' && !reply.value.ok && reply.value.reason === 'no_points') {
			const saver = currentCloudSaver();
			if (saver) {
				await saver.run();
				reply = await requestCharacter(newClaimId(), { action: 'allocate', add: add as Record<string, number> });
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
					toast(
						reply.value.reason === 'no_points' ? 'The server has not counted that level yet. Try again in a moment.' : 'The server did not take that point.',
					);
					if (!busy()) ver = 0; // the truth wins even when it is not newer
				}
				if (!busy()) applyAttrs(reply.value.attrs);
				else ver = Math.max(ver, reply.value.attrs.ver);
				return;
			}
			if (reply.status === 'unavailable') toast('Could not reach the server: the points will be checked at the next save.');
		});
	};

	/** A point was previewed: ask the server for it (a burst of clicks is one request). */
	const queuePoint = (stat: AttrKey) => {
		pending[stat] = (pending[stat] ?? 0) + 1;
		clearTimeout(timer);
		timer = setTimeout(flush, BATCH_MS);
	};

	/** Reads the server's allocation (when the game starts, and after anything that can change it elsewhere) and takes it, unless a change of our own is still on its way. */
	const syncAttrs = async () => {
		if (busy()) return;
		const mine = gen;
		const reply = await requestCharacter(null, { action: 'sync' });
		if (mine !== gen || busy() || reply.status !== 'ok') return;
		ver = 0;
		applyAttrs(reply.value.attrs);
	};

	/** A New Game or a rebirth starts the allocation again: nothing in flight is waited for. */
	const reset = () => {
		gen++;
		clearTimeout(timer);
		timer = undefined;
		pending = {};
		inFlight = 0;
		chain = Promise.resolve();
		ver = 0;
	};

	return { applyAttrs, queuePoint, syncAttrs, resetCharacterSync: reset };
};

export type CharacterSync = ReturnType<typeof createCharacterSync>;
