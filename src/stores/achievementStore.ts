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
	/** Deed points of the claimed tiers, the tiers waiting for Claim, the placeholder text of the deeds bonus and the number towards each deed (all from the server) */
	points: number;
	claimable: number;
	bonusText: string;
	progress: Readonly<Record<string, number>>;
	/** The id being claimed right now ('all' for Claim all; the buttons are disabled meanwhile) */
	busy: string | null;
	apply: (report: AchievementReport) => void;
	claim: (id: string) => Promise<boolean>;
	/** Claim all: one request for every earned tier that is waiting */
	claimAll: () => Promise<boolean>;
}

/** The report as an older server may send it: the claimed list and the times can be missing. */
type LooseReport = Pick<AchievementReport, 'fresh' | 'earned' | 'gemsTotal'> & {
	claimed?: string[];
	earnedAt?: Record<string, number>;
	claimedAt?: Record<string, number>;
	points?: number;
	claimable?: number;
	bonusText?: string;
	progress?: Record<string, number>;
};

export const useAchievementStore = create<AchievementState>((set, get) => ({
	earned: [],
	claimed: [],
	earnedAt: {},
	claimedAt: {},
	points: 0,
	claimable: 0,
	bonusText: '',
	progress: {},
	busy: null,
	apply: (report) => {
		const r = report as LooseReport;
		const claimed = r.claimed ?? r.earned;
		set((state) => ({
			earned: r.earned,
			claimed,
			earnedAt: r.earnedAt ?? {},
			claimedAt: r.claimedAt ?? {},
			points: r.points ?? state.points,
			claimable: r.claimable ?? r.earned.filter((id) => !claimed.includes(id)).length,
			bonusText: r.bonusText ?? state.bonusText,
			// a report without the numbers (an older server, or one made before the save is known) keeps what was shown
			progress: r.progress ?? state.progress,
		}));
		if (typeof r.gemsTotal === 'number') useGameStore.setState({ gems: r.gemsTotal });
		for (const unlock of r.fresh) {
			// the reward card (badge, Congratulations!, fanfare); an id the catalog does not know falls back to the plain message
			if (achievementById(unlock.id)) useUiStore.getState().pushAchievementNotice(unlock.id);
			else useUiStore.getState().showToast(`Achievement earned: ${unlock.id}.`);
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
	claimAll: async () => {
		if (get().busy !== null) return false;
		const toast = useUiStore.getState().showToast;
		set({ busy: 'all' });
		try {
			const key = newClaimId();
			let reply = await requestGems(key, { action: 'claimAll' });
			if (reply.status === 'unavailable') reply = await requestGems(key, { action: 'claimAll' });
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
