import { IDOLS } from '@/catalog/idols';
import { standingIdols } from '@/lib/idolEconomy';
import type { PersistedGame } from '@/lib/sanitizeSave';

/**
 * The server's say over the Idol levels (the account's `idolLevels`). The ledger's `legacy.idols` is the trusted record; a save may claim a level above it only by one step per save and only
 * when that step is real: the Idol stands on the map at that level now and the save raised no `timer_jump` (a level above the remembered one needs a running upgrade, or the first build, behind it, which `verify.ts` judges).
 * Everything else is cut back to the trusted level, so an edited save cannot grant a level and a rebirth cannot lose one. A level the save holds below the record is raised to it (the server wins).
 *
 * @category Saves & Server/Accepting a save
 * @order 8
 * @formula
 * accepted[biome] = trusted                              when claimed <= trusted
 *                 = claimed                              when claimed = trusted + 1, the Idol stands at that level and no timer_jump was raised
 *                 = trusted                              otherwise
 */
export const settleIdols = (
	trusted: Record<string, number>,
	state: Pick<PersistedGame, 'tiles' | 'idolLevels'>,
	timerJumped: boolean,
): Record<string, number> => {
	const placed = standingIdols(state.tiles);
	const claimed = state.idolLevels ?? {};
	const out: Record<string, number> = {};
	for (const idol of IDOLS) {
		const t = trusted[idol.biome] ?? 0;
		const c = claimed[idol.biome] ?? 0;
		const accepted = c > t && !timerJumped && c === t + 1 && (placed[idol.biome] ?? 0) >= c ? c : t;
		if (accepted > 0) out[idol.biome] = accepted;
	}
	return out;
};

/** True when two Idol records are the same. */
export const sameIdols = (a: Record<string, number>, b: Record<string, number>): boolean => {
	const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
	for (const k of keys) if ((a[k] ?? 0) !== (b[k] ?? 0)) return false;
	return true;
};
