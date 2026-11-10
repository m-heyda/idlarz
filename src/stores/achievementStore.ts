import { create } from 'zustand';
import { achievementById } from '@/catalog/achievements';
import type { AchievementReport } from '@/lib/offline/achievements';
import { provideAchievementSink } from '@/lib/rewardsClient';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';

/**
 * The achievements the server says the player has earned (an id list it sends with the spawn poll) and the toast when a request pays a new one. The browser never decides: it only shows
 * what the answers carry, and the gem balance in the answer replaces its own.
 */
interface AchievementState {
	earned: readonly string[];
	apply: (report: AchievementReport) => void;
}

export const useAchievementStore = create<AchievementState>((set) => ({
	earned: [],
	apply: (report) => {
		set({ earned: report.earned });
		if (report.fresh.length === 0) return;
		useGameStore.setState({ gems: report.gemsTotal });
		for (const unlock of report.fresh) {
			const title = achievementById(unlock.id)?.title ?? unlock.id;
			useUiStore.getState().showToast(`Achievement: ${title} (+${unlock.gems} gems)`);
		}
	},
}));

provideAchievementSink((report) => useAchievementStore.getState().apply(report));
