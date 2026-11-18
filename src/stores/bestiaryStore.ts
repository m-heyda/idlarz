import { create } from 'zustand';
import type { BestiaryReport } from '@/lib/offline/stats';
import { newClaimId } from '@/lib/offlineClient';
import { notify } from '@/lib/notices';
import { provideBestiarySink, requestMastery } from '@/lib/rewardsClient';
import { signalNeedClaim } from '@/lib/serverSession';
import { useGameStore } from '@/stores/gameStore';
import type { MasteryRequest } from '@/lib/offline/gemTypes';

/**
 * The monsters the player has met (the server's `stats.seen`, sent with every online answer) and the kills per type (`stats.kills`). The browser never decides: a monster type that is not in
 * `seen` shows as a "?" silhouette with no name and no tooltip until the first fight with it. `loaded` stays false until the first answer, so nothing flashes as unknown before the server has spoken.
 *
 * Bestiary groundwork: the kill counts are kept here for the later bestiary window (kill tiers 100 / 200 / 300 per type, see docs/plan/ROADMAP.md).
 */
interface BestiaryState {
	loaded: boolean;
	seen: ReadonlySet<string>;
	kills: Readonly<Record<string, number>>;
	/** Mastery tiers claimed per type, times beaten and the fastest win in ms (the server's; empty from an older server) */
	claimed: Readonly<Record<string, number>>;
	deaths: Readonly<Record<string, number>>;
	bestMs: Readonly<Record<string, number>>;
	/** Biome collection goals claimed per biome (the server's) */
	biomeClaimed: Readonly<Record<string, number>>;
	/** A claim is in flight (the window's buttons wait) */
	busy: boolean;
	/** Claims a tier, a biome goal or everything waiting: one request, the server judges it, the answer carries the new report */
	claim: (request: MasteryRequest) => Promise<boolean>;
	apply: (report: BestiaryReport) => void;
}

export const useBestiaryStore = create<BestiaryState>((set, get) => ({
	loaded: false,
	seen: new Set<string>(),
	kills: {},
	claimed: {},
	deaths: {},
	bestMs: {},
	biomeClaimed: {},
	busy: false,
	claim: async (request) => {
		if (get().busy) return false;
		set({ busy: true });
		try {
			const key = newClaimId();
			let reply = await requestMastery(key, request);
			if (reply.status === 'unavailable') reply = await requestMastery(key, request);
			if (reply.status === 'need_claim') {
				signalNeedClaim();
				notify('Collect your time away first, then claim.', 'error');
				return false;
			}
			if (reply.status !== 'ok') {
				notify('Could not reach the server. Nothing was claimed.', 'error');
				return false;
			}
			const value = reply.value;
			if (typeof value.gems === 'number') useGameStore.setState({ gems: value.gems });
			if (!value.ok) {
				notify(value.message ?? 'The server did not do that.', 'error');
				return false;
			}
			notify(value.paid ? `Claimed: +${value.paid} gems` : value.tiers > 1 ? `Claimed ${value.tiers} rewards` : 'Claimed');
			return true;
		} finally {
			set({ busy: false });
		}
	},
	apply: (report) =>
		set({
			loaded: true,
			seen: new Set(report.seen),
			kills: report.kills,
			claimed: report.claimed ?? {},
			deaths: report.deaths ?? {},
			bestMs: report.bestMs ?? {},
			biomeClaimed: report.biomeClaimed ?? {},
		}),
}));

/** The rule: a type is known once the server listed it (before the server's first answer every type counts as known, so the map never flashes silhouettes; the login claim and every online answer carry the list). */
export const isKnownType = (state: Pick<BestiaryState, 'loaded' | 'seen'>, type: string): boolean => !state.loaded || state.seen.has(type);

/** Hook: whether the monster type is known, see {@link isKnownType}. */
export const useIsDiscovered = (type: string): boolean => useBestiaryStore((state) => isKnownType(state, type));

/** The name to show for a monster type in text (menus, toasts, tooltips): its label once met, "Unknown monster" before. Reads the store at call time, so a menu or toast built after a fight is already right. */
export const monsterNameOf = (type: string, label: string): string => {
	return isKnownType(useBestiaryStore.getState(), type) ? label : 'Unknown monster';
};

provideBestiarySink((report) => useBestiaryStore.getState().apply(report));
