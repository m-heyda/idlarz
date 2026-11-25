import { chooseMark, MARK_PREFS, type MarkPref } from '@/config/mapMarks';
import { useUiStore } from '@/stores/uiStore';

/**
 * The state of the map marks (chests, ores, monsters and the monster kinds) and the one way to press them: `choose(pref)` follows `chooseMark` (one at a time, the lit one switches off). The buttons under the minimap and the tiles of the Kingdom overview
 * both use it, so they always show the same choice.
 */
export const useMapMarks = (): { on: Record<MarkPref, boolean>; choose: (pref: MarkPref) => void } => {
	const markChests = useUiStore((state) => state.markChests);
	const markOres = useUiStore((state) => state.markOres);
	const markMonsters = useUiStore((state) => state.markMonsters);
	const markBosses = useUiStore((state) => state.markBosses);
	const markGolden = useUiStore((state) => state.markGolden);
	const markGrown = useUiStore((state) => state.markGrown);
	const markGrowing = useUiStore((state) => state.markGrowing);
	const markStrongest = useUiStore((state) => state.markStrongest);
	const setPref = useUiStore((state) => state.setPref);
	const on: Record<MarkPref, boolean> = { markChests, markOres, markMonsters, markBosses, markGolden, markGrown, markGrowing, markStrongest };
	const choose = (pref: MarkPref) => {
		const next = chooseMark(on, pref);
		for (const key of MARK_PREFS) if (next[key] !== on[key]) setPref(key, next[key]);
	};
	return { on, choose };
};
