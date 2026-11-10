import { create } from 'zustand';
import { GUIDE_NAME } from '@/catalog/tutorial';
import { RESOURCE_CAP } from '@/config/economy';
import { newClaimId } from '@/lib/offlineClient';
import { requestTutorial, type Reply } from '@/lib/rewardsClient';
import type { TutorialReply, TutorialRequest } from '@/lib/offline/tutorial';
import { emptyProgress, mergeProgress, withDone, withLesson, withSkip, type TutorialProgress } from '@/lib/tutorial/engine';
import { emptyCounters, type TutorialCounters } from '@/lib/tutorial/facts';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';

/** How long to wait before asking again when the server could not confirm a step yet (its last saved copy lags the browser's) or could not be reached. */
const RETRY_MS = 20_000;
const MAX_TRIES = 30;

interface TutorialStoreState {
	/** The account's progress: the server's answer, with the player's own moves applied at once */
	progress: TutorialProgress;
	/** The server's progress has arrived (nothing is shown before: a second browser must not replay the intro) */
	loaded: boolean;
	counters: TutorialCounters;
	/** The intro page on show */
	introPage: number;
	/** A lesson that just fired and is still on show */
	shownLesson: string | null;
	setCounters: (counters: TutorialCounters) => void;
	nextIntroPage: () => void;
	load: () => Promise<void>;
	/** Marks the intro or a step done (at once here, then on the server, which may pay a bundle) */
	completeStep: (id: string) => void;
	/** A lesson fired: it goes into the journal and stays on show until the player closes it */
	showLesson: (id: string) => void;
	closeLesson: () => void;
	skip: () => void;
	reset: () => void;
}

const pending = new Set<string>();

/** Puts what a bundle paid into the game: gold and wood now (the server has counted them as granted), items arrive with the inventory in the answer. */
const receivePaid = (reply: TutorialReply) => {
	if (reply.inv) useGameStore.getState().applyServerInventory(reply.inv);
	const paid = reply.paid;
	if (!paid) return;
	const state = useGameStore.getState();
	const resources = { ...state.resources };
	if (paid.gold) resources.gold = Math.min(resources.gold + paid.gold, RESOURCE_CAP);
	if (paid.wood) resources.wood = Math.min(resources.wood + paid.wood, RESOURCE_CAP);
	useGameStore.setState({ resources });
	const parts = [
		paid.gold ? `${paid.gold} gold` : '',
		paid.wood ? `${paid.wood} wood` : '',
		...(paid.items ?? []).map((i) => `${i.qty} ${i.id === 'potion_minor' ? 'minor potions' : i.id}`),
	].filter(Boolean);
	useUiStore.getState().showToast(`${GUIDE_NAME} gives you ${parts.join(', ')}.`);
};

export const useTutorialStore = create<TutorialStoreState>((set, get) => {
	/** Sends one request; a step the server cannot confirm yet, or a server that cannot be reached, is asked again later with the same key. */
	const send = async (request: TutorialRequest, tag: string, key = newClaimId(), tries = 1): Promise<void> => {
		let reply: Reply<TutorialReply>;
		try {
			reply = await requestTutorial(key, request);
		} catch {
			reply = { status: 'unavailable' };
		}
		if (reply.status === 'ok' && reply.value.ok) {
			set((s) => ({ progress: mergeProgress(s.progress, reply.value.progress) }));
			receivePaid(reply.value);
			pending.delete(tag);
			return;
		}
		const final = reply.status === 'ok' && reply.value.reason === 'unknown';
		if (final || reply.status === 'not_configured' || tries >= MAX_TRIES) {
			pending.delete(tag);
			return;
		}
		// not_yet, an outage, a claim still due: the local progress stands and the same request is repeated
		setTimeout(() => void send(request, tag, key, tries + 1), RETRY_MS);
	};

	const record = (request: TutorialRequest, tag: string) => {
		if (pending.has(tag)) return;
		pending.add(tag);
		void send(request, tag);
	};

	return {
		progress: emptyProgress(),
		loaded: false,
		counters: emptyCounters(),
		introPage: 0,
		shownLesson: null,
		setCounters: (counters) => set({ counters }),
		nextIntroPage: () => set((s) => ({ introPage: s.introPage + 1 })),
		load: async () => {
			const reply = await requestTutorial(newClaimId(), { action: 'sync' });
			if (reply.status === 'ok') set((s) => ({ progress: mergeProgress(s.progress, reply.value.progress), loaded: true }));
			// a brand-new account has no cloud save for a moment (its first upload is on its way): the server holds no progress either, so the intro must not wait for it
			else if (reply.status === 'no_save') set({ loaded: true });
			else setTimeout(() => void get().load(), RETRY_MS);
		},
		completeStep: (id) => {
			if (get().progress.done.includes(id)) return;
			set((s) => ({ progress: withDone(s.progress, id) }));
			record({ action: 'done', id }, `done:${id}`);
		},
		showLesson: (id) => {
			set((s) => ({ progress: withLesson(s.progress, id), shownLesson: id }));
			record({ action: 'lesson', id }, `lesson:${id}`);
		},
		closeLesson: () => set({ shownLesson: null }),
		skip: () => {
			set((s) => ({ progress: withSkip(s.progress), shownLesson: null }));
			record({ action: 'skip' }, 'skip');
		},
		reset: () => {
			pending.clear();
			set({ progress: emptyProgress(), loaded: false, counters: emptyCounters(), introPage: 0, shownLesson: null });
		},
	};
});
