import { IDOLS, idolDef } from '@/catalog/idols';
import { standingIdols } from '@/lib/idolEconomy';
import { forEachOwned, setTiles, type World } from '@/utils/world';
import type { PersistedGame } from '@/lib/sanitizeSave';
import type { Tile } from '@/types/game';

/**
 * The server's say over the Idol levels (the account's `idolLevels`). The ledger's `legacy.idols` is the trusted record; a save may claim a level above it only by one step per save and only
 * when that step is real: the Idol stands on the map at that level now and the save raised no `timer_jump` (a level above the remembered one needs a running upgrade, or the first build, behind it, which `verify.ts` judges).
 * Everything else is cut back to the trusted level, so an edited save cannot grant a level and a rebirth cannot lose one. A level the save holds below the record is raised to it (the server wins).
 *
 * @category Saves & Server/Accepting a save
 * @order 8
 * Several levels at once (`catchUp`, the same run as the previous save): an Idol that fell behind the record (the client keeps going while the server held a step back, or the browser was left open and two timers ended between saves) is accepted up to the level it stands at
 * once the timer check raised no `timer_jump`; that check already needs the real time to cover every level above what the previous save held.
 *
 * @formula
 * accepted[biome] = trusted                              when claimed <= trusted
 *                 = claimed                              when claimed = trusted + 1 (or more with `catchUp`), the Idol stands at that level and no timer_jump was raised
 *                 = trusted                              otherwise
 */
export const settleIdols = (
	trusted: Record<string, number>,
	state: Pick<PersistedGame, 'tiles' | 'idolLevels'>,
	timerJumped: boolean,
	catchUp = false,
): Record<string, number> => {
	const placed = standingIdols(state.tiles);
	const claimed = state.idolLevels ?? {};
	const out: Record<string, number> = {};
	for (const idol of IDOLS) {
		const t = trusted[idol.biome] ?? 0;
		const c = claimed[idol.biome] ?? 0;
		const accepted = c > t && !timerJumped && (c === t + 1 || catchUp) && (placed[idol.biome] ?? 0) >= c ? c : t;
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

/**
 * Cuts every standing Idol's tile level to the settled record, so that everything derived from the map alone (the farm bonus in the income rates, the stored world) is the server's number and not the claim: a tile above the record goes down to it
 * (an Idol the record knows nothing about, a forged build, is taken off the map). Only a level or a building nobody verified is taken away; an honest first build is accepted by {@link settleIdols} first.
 */
export const clampIdolTiles = (tiles: World, settled: Record<string, number>): World => {
	const changes: { x: number; y: number; tile: Tile }[] = [];
	forEachOwned(tiles, (tile, x, y) => {
		const idol = idolDef(tile.building);
		if (!idol) return;
		const allowed = settled[idol.biome] ?? 0;
		if ((tile.buildingLevel ?? 1) <= allowed) return;
		// an Idol the record knows is cut to its level; one it knows nothing about (a forged build) is taken off the map
		const { buildingLevel: _level, ...noLevel } = tile;
		const { building: _building, ...bare } = noLevel;
		void _level;
		void _building;
		changes.push({ x, y, tile: allowed > 1 ? { ...tile, buildingLevel: allowed } : allowed === 1 ? noLevel : bare });
	});
	return changes.length === 0 ? tiles : setTiles(tiles, changes);
};
