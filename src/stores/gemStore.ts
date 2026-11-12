import { create } from 'zustand';
import { newClaimId } from '@/lib/offlineClient';
import type { GemsReply, GemsRequest } from '@/lib/offline/gemTypes';
import { requestGems } from '@/lib/rewardsClient';
import { QUERY_KEYS, invalidate } from '@/lib/queryClient';
import { signalNeedClaim } from '@/lib/serverSession';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';

// The browser's side of the gem shop (`POST /api/gems`): what the shop window shows, and the purchases. The balance, the prices, the cooldowns and every rule are the server's; the browser shows what the last answer said and never
// computes a balance. A purchase carries a fresh key, and a lost answer is asked again with the SAME key (the server replays it, it is never charged twice).

interface GemStoreState {
	/** The last answer of the server (null until it has been asked) */
	info: GemsReply | null;
	/** A request is on its way: the shop disables its buttons until the answer is here */
	busy: boolean;
	/** Why the last request was refused, for the shop to show */
	message: string | null;
	refresh: () => Promise<void>;
	claimDaily: () => Promise<GemsReply | null>;
	buy: (itemId: string, value?: string) => Promise<GemsReply | null>;
	reset: () => void;
}

/** Takes what an answer changes in the game: the balance, and a class or name that was just written. */
const applyReply = (reply: GemsReply) => {
	const game = useGameStore.getState();
	useGameStore.setState({ gems: reply.gems });
	if (reply.playerClass) invalidate(QUERY_KEYS.avatars); // another class has other starter faces
	if (reply.playerClass) game.setPlayerClass(reply.playerClass as Parameters<typeof game.setPlayerClass>[0]);
	if (reply.characterName) useGameStore.setState({ playerName: reply.characterName });
	if (reply.attrs) game.applyServerAttrs(reply.attrs);
};

export const useGemStore = create<GemStoreState>((set, get) => {
	const run = async (key: string | null, request: GemsRequest): Promise<GemsReply | null> => {
		set({ busy: true, message: null });
		try {
			let reply = await requestGems(key, request);
			if (reply.status === 'unavailable' && key) reply = await requestGems(key, request);
			if (reply.status === 'need_claim') {
				signalNeedClaim();
				set({ message: 'Collect your time away first, then try again.' });
				return null;
			}
			if (reply.status !== 'ok') {
				set({ message: 'Could not reach the server. Nothing was charged.' });
				return null;
			}
			applyReply(reply.value);
			set({ info: reply.value, message: reply.value.ok ? null : (reply.value.message ?? 'The server did not do that.') });
			return reply.value;
		} finally {
			set({ busy: false });
		}
	};

	return {
		info: null,
		busy: false,
		message: null,
		refresh: async () => {
			await run(null, { action: 'status' });
		},
		claimDaily: async () => {
			const reply = await run(newClaimId(), { action: 'daily' });
			if (reply?.ok && reply.paid) useUiStore.getState().showToast(`Daily bonus: +${reply.paid} gems`);
			return reply;
		},
		buy: async (itemId, value) => {
			if (get().busy) return null;
			const reply = await run(newClaimId(), { action: 'spend', itemId, ...(value !== undefined ? { value } : {}) });
			if (reply?.ok) useUiStore.getState().showToast('Done.');
			return reply;
		},
		reset: () => set({ info: null, busy: false, message: null }),
	};
});
