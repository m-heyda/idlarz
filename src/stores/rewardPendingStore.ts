import { create } from 'zustand';

/**
 * How many rewards are on their way from the server (a chest being opened, a won fight whose result is not shown yet).
 * While it is above zero the small chest animation plays, so the wait before the loot appears does not feel like a stall.
 */
interface RewardPendingState {
	count: number;
	begin: () => void;
	end: () => void;
}

export const useRewardPendingStore = create<RewardPendingState>((set) => ({
	count: 0,
	begin: () => set((state) => ({ count: state.count + 1 })),
	end: () => set((state) => ({ count: Math.max(0, state.count - 1) })),
}));
