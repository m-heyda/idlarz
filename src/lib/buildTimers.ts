import { buildingDef } from '@/catalog/buildings';
import { CASTLE_X, CASTLE_Y } from '@/config/castle';
import { buildingUpgradeDuration } from '@/lib/buildings';
import { castleUpgradeDuration } from '@/utils/game/castle';
import { castleTimerLabel } from '@/lib/castleTimer';
import type { BuildingUpgradeState, CastleUpgradeState, PrestigeState } from '@/types/game';

/** One running construction as the bottom-left timer list shows it. */
export interface BuildTimer {
	/** Stable key for the row (`castle`, or `building:x,y`) */
	key: string;
	kind: 'castle' | 'building';
	/** What is being built ("Castle", "Granary") */
	title: string;
	toLevel: number;
	/** Seconds left */
	remainingSec: number;
	/** "2h 5m", "4m 10s": never less than 1 s while it runs */
	label: string;
	/** 0..1 of the whole duration that is done */
	progress: number;
	/** The picture of a building (null for the castle, which has its own icon) */
	art: string | null;
	/** The tile to show on a click */
	x: number;
	y: number;
}

/** The text of a running timer; a started upgrade never shows less than 1 s. */
export const timerLabel = (remainingSec: number): string => castleTimerLabel({ remainingSec }) ?? '';

const progressOf = (remainingSec: number, totalSec: number): number => (totalSec > 0 ? Math.min(1, Math.max(0, 1 - remainingSec / totalSec)) : 0);

/**
 * Every construction that is running, soonest finished first: the castle upgrade and each building upgrade. Takes a list of building upgrades (today the builder works on one at a time, so the list has at most one entry; a game that builds several
 * at once passes all of them and the bottom-left list shows one row each). `tiles` is only used to name the building on each tile.
 */
export const activeBuildTimers = (input: {
	castleUpgrade: CastleUpgradeState | null;
	buildingUpgrades: readonly BuildingUpgradeState[];
	buildingAt: (x: number, y: number) => string | undefined;
	prestige: PrestigeState | undefined;
	buildTimePct: number;
}): BuildTimer[] => {
	const out: BuildTimer[] = [];
	const { castleUpgrade, buildingUpgrades, buildingAt, prestige, buildTimePct } = input;
	if (castleUpgrade) {
		const total = castleUpgradeDuration(castleUpgrade.toLevel - 1, prestige, buildTimePct);
		out.push({
			key: 'castle',
			kind: 'castle',
			title: 'Castle',
			toLevel: castleUpgrade.toLevel,
			label: timerLabel(castleUpgrade.remainingSec),
			progress: progressOf(castleUpgrade.remainingSec, total),
			art: null,
			x: CASTLE_X,
			y: CASTLE_Y,
			remainingSec: castleUpgrade.remainingSec,
		});
	}
	for (const up of buildingUpgrades) {
		const def = buildingDef(buildingAt(up.x, up.y));
		const total = buildingUpgradeDuration(up.toLevel - 1, prestige, buildTimePct);
		out.push({
			key: `building:${up.x},${up.y}`,
			kind: 'building',
			title: def?.label ?? 'Building',
			toLevel: up.toLevel,
			label: timerLabel(up.remainingSec),
			progress: progressOf(up.remainingSec, total),
			art: def?.art ?? null,
			x: up.x,
			y: up.y,
			remainingSec: up.remainingSec,
		});
	}
	return out.sort((a, b) => a.remainingSec - b.remainingSec);
};
