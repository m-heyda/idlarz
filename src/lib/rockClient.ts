import { INGREDIENT_COMPONENTS } from '@/catalog/ingredients';
import { RESOURCE_CAP } from '@/config/economy';
import { ROCK_TIERS } from '@/config/rocks';
import { formatCompact } from '@/utils/formatters';
import { notify } from '@/lib/notices';
import { newClaimId } from '@/lib/offlineClient';
import type { RockReply } from '@/lib/offline/types';
import { requestRock, type Reply } from '@/lib/rewardsClient';
import { signalNeedClaim } from '@/lib/serverSession';
import { useCraftStore } from '@/stores/craftStore';
import { useGameStore } from '@/stores/gameStore';
import { rockKey, useRockStore } from '@/stores/rockStore';
import audioManager from '@/utils/audioManager';

// The browser's side of mining a rock (IDL-376). Every click is counted and shown at once; the clicks are sent to the server in batches (about one a second, and at once when the count reaches what the rock needs).
// The server decides how many it lets in, keeps the rock's progress and, when the rock breaks, rolls and pays the drops: nothing here decides a reward.

/** How long clicks are gathered before a batch is sent. Every batch is a read and a write of the player's ledger on the server, so they are not sent more than once in two seconds (at the 24 clicks/s the server allows that is 48 clicks, exactly its burst), and one at a time across all rocks */
export const FLUSH_MS = 2000;
/** The most clicks one request may carry (the server's `ROCK.maxBatch`) */
const BATCH = 200;
/** The shortest gap between two chop sounds: a fast clicker gets a roll of hits, not a wall of noise */
const SOUND_GAP_MS = 60;

const unsent = new Map<string, number>();
const inflight = new Set<string>();
/** One batch on its way at a time, whatever the rock: two rocks clicked in turn do not make two requests at once (they would race for the same ledger row) */
let busy = false;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let lastSound = 0;

/** What a broken rock gives the player: the stone and coal go into the resources at once (the server has already counted them as granted), ingredients are told and the crafting bag is read again. */
const received = (x: number, y: number, reply: Extract<RockReply, { ok: true; broken: true }>) => {
	const { stone, coal, stash } = reply.loot;
	useGameStore.setState((state) => ({
		resources: {
			...state.resources,
			stone: Math.min(RESOURCE_CAP, state.resources.stone + stone),
			coal: Math.min(RESOURCE_CAP, state.resources.coal + coal),
		},
	}));
	useRockStore.getState().pushBurst({ x, y, tier: reply.tier, stone, coal, stash });
	// one notice says what the rock gave (the pieces themselves fall on the map, see RockLayer)
	const found = Object.entries(stash).map(([id, amount]) => `${INGREDIENT_COMPONENTS[id]?.name ?? id} x${amount}`);
	const gave = [stone > 0 ? `${formatCompact(stone)} stone` : '', coal > 0 ? `${formatCompact(coal)} coal` : '', ...found].filter(Boolean);
	notify(`${ROCK_TIERS[reply.tier].label} broken: ${gave.join(', ')}`);
	if (Object.keys(stash).length > 0) {
		const craft = useCraftStore.getState();
		if (craft.craft) void craft.refresh();
	}
};

const flush = async (x: number, y: number): Promise<void> => {
	const key = rockKey(x, y);
	const timer = timers.get(key);
	if (timer) clearTimeout(timer);
	timers.delete(key);
	if (inflight.has(key)) return;
	const waiting = unsent.get(key) ?? 0;
	if (waiting <= 0) return;
	if (busy) {
		// another rock's batch is on its way: try again shortly
		timers.set(
			key,
			setTimeout(() => void flush(x, y), 250),
		);
		return;
	}
	const sent = Math.min(BATCH, waiting);
	unsent.set(key, waiting - sent);
	inflight.add(key);
	busy = true;
	const claim = newClaimId();
	let reply: Reply<RockReply>;
	try {
		reply = await requestRock(claim, x, y, sent);
		if (reply.status === 'unavailable') reply = await requestRock(claim, x, y, sent);
	} finally {
		inflight.delete(key);
		busy = false;
	}

	const store = useRockStore.getState();
	if (reply.status === 'ok') {
		if (reply.value.ok) {
			store.ack(x, y, sent, reply.value.hits, reply.value.broken, reply.value.need);
			if (reply.value.broken) {
				unsent.delete(key);
				received(x, y, reply.value);
				return;
			}
		} else {
			unsent.delete(key);
			store.remove(x, y);
			notify('The rock crumbled: it was not a real one.', 'error');
			return;
		}
	} else {
		store.lose(x, y, sent);
		if (reply.status === 'need_claim') {
			signalNeedClaim();
			notify('Catching up with the server, try again in a moment.', 'error');
		} else if (reply.status === 'no_save') notify('Your progress is still being saved to the server: try mining again in a moment.', 'error');
		else notify('Could not reach the server: your last hits were not counted.', 'error');
	}
	// clicks made while the batch was on its way
	if ((unsent.get(key) ?? 0) > 0 && useRockStore.getState().rocks[key]) {
		if (useRockStore.getState().rocks[key].breaking) void flush(x, y);
		else schedule(x, y);
	}
};

const schedule = (x: number, y: number) => {
	const key = rockKey(x, y);
	if (timers.has(key)) return;
	timers.set(
		key,
		setTimeout(() => void flush(x, y), FLUSH_MS),
	);
};

/** One click on the rock at (x, y): counted and drawn at once, sent with the next batch. False when there is no rock to hit. */
export const hitRockAt = (x: number, y: number): boolean => {
	const rock = useRockStore.getState().localHit(x, y);
	if (!rock) return false;
	const now = Date.now();
	if (now - lastSound >= SOUND_GAP_MS) {
		lastSound = now;
		audioManager.playOverlap('mining', 0.94 + Math.random() * 0.14);
	}
	const key = rockKey(x, y);
	unsent.set(key, (unsent.get(key) ?? 0) + 1);
	if (rock.breaking) void flush(x, y);
	else schedule(x, y);
	return true;
};

/** The clicks a rock needs, for a label that has no live rock (the tooltip of a tier). */
export const clicksFor = (tier: keyof typeof ROCK_TIERS): number => ROCK_TIERS[tier].clicks;
