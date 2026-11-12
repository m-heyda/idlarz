import { create } from 'zustand';
import { newClaimId } from '@/lib/offlineClient';
import type { PetsReply } from '@/lib/offline/pets';
import { requestPets } from '@/lib/rewardsClient';

// The browser's side of the cosmetic pets (`POST /api/pets`): which pets the account owns and the welcome letter still to be shown. The server decides both; the browser draws what the last answer said.

interface PetStoreState {
	/** The pets the account owns (ids of the catalog); empty until the server answered */
	owned: string[];
	/** The welcome letter waiting to be shown, or null */
	letter: PetsReply['letter'];
	/** Asks the server (once per start of the game): this is also where the special pet is granted */
	sync: () => Promise<void>;
	/** The player closed the letter: the server records it so it never comes again */
	closeLetter: (petId: string) => Promise<void>;
	reset: () => void;
}

export const usePetStore = create<PetStoreState>((set) => ({
	owned: [],
	letter: null,
	sync: async () => {
		const reply = await requestPets(newClaimId(), { action: 'sync' });
		if (reply.status === 'ok') set({ owned: reply.value.owned, letter: reply.value.letter });
	},
	closeLetter: async (petId) => {
		// closed in the browser at once; the server keeps the record (a failed request only shows the letter once more at the next start)
		set({ letter: null });
		const reply = await requestPets(newClaimId(), { action: 'ack', id: petId });
		if (reply.status === 'ok') set({ owned: reply.value.owned });
	},
	reset: () => set({ owned: [], letter: null }),
}));
