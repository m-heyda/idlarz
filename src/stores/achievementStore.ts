import { create } from 'zustand';
import { achievementById } from '@/catalog/achievements';
import type { AchievementReport } from '@/lib/offline/achievements';
import { newClaimId } from '@/lib/offlineClient';
import { provideAchievementSink, requestGems } from '@/lib/rewardsClient';
import { signalNeedClaim } from '@/lib/serverSession';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';

/**
 * The achievements the server says the player has earned and claimed, with the times (all from the answers; the browser never decides). Earning one unlocks its avatar and title at once;
 * its gems (and any later claimable reward) are paid when the player presses Claim (`POST /api/gems` `{ action: 'claim' }`), and the balance in the answer replaces the browser's own.
 */
interface AchievementState {
	earned: readonly string[];
	claimed: readonly string[];
	earnedAt: Readonly<Record<string, number>>;
	claimedAt: Readonly<Record<string, number>>;
	/** The id being claimed right now (the buttons are disabled meanwhile) */
	busy: string | null;
	apply: (report: AchievementReport) => void;
	claim: (id: string) => Promise<boolean>;
}

/** The report as an older server may send it: the claimed list and the times can be missing. */
type LooseReport = Pick<AchievementReport, 'fresh' | 'earned' | 'gemsTotal'> & {
	claimed?: string[];
	earnedAt?: Record<string, number>;
	claimedAt?: Record<string, number>;
};

export const useAchievementStore = create<AchievementState>((set, get) => ({
	earned: [],
	claimed: [],
	earnedAt: {},
	claimedAt: {},
	busy: null,
	apply: (report) => {
		const r = report as LooseReport;
		set({ earned: r.earned, claimed: r.claimed ?? r.earned, earnedAt: r.earnedAt ?? {}, claimedAt: r.claimedAt ?? {} });
		if (typeof r.gemsTotal === 'number') useGameStore.setState({ gems: r.gemsTotal });
		for (const unlock of r.fresh) {
			const title = achievementById(unlock.id)?.title ?? unlock.id;
			useUiStore.getState().showToast(`Achievement earned: ${title}. Claim it in the Achievements window.`);
		}
	},
	claim: async (id) => {
		if (get().busy !== null) return false;
		const toast = useUiStore.getState().showToast;
		set({ busy: id });
		try {
			const key = newClaimId();
			let reply = await requestGems(key, { action: 'claim', id });
			if (reply.status === 'unavailable') reply = await requestGems(key, { action: 'claim', id });
			if (reply.status === 'need_claim') {
				signalNeedClaim();
				toast('Collect your time away first, then claim.');
				return false;
			}
			if (reply.status !== 'ok') {
				toast('Could not reach the server. Nothing was claimed.');
				return false;
			}
			const value = reply.value;
			if (typeof value.gems === 'number') useGameStore.setState({ gems: value.gems });
			if (!value.ok) {
				toast(value.message ?? 'The server did not do that.');
				return false;
			}
			toast(value.paid ? `+${value.paid} gems` : 'Claimed');
			return true;
		} finally {
			set({ busy: null });
		}
	},
}));

provideAchievementSink((report) => useAchievementStore.getState().apply(report));
