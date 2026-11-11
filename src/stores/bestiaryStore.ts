import { create } from 'zustand';
import type { BestiaryReport } from '@/lib/offline/stats';
import { provideBestiarySink } from '@/lib/rewardsClient';

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
	apply: (report: BestiaryReport) => void;
}

export const useBestiaryStore = create<BestiaryState>((set) => ({
	loaded: false,
	seen: new Set<string>(),
	kills: {},
	apply: (report) => set({ loaded: true, seen: new Set(report.seen), kills: report.kills }),
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
