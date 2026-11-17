import type { BuildingUpgradeState, CastleUpgradeState } from '@/types/game';

/** Builders at work: every running building upgrade plus the castle's. */
export const busyBuilders = (castleUpgrade: CastleUpgradeState | null, buildingUpgrades: readonly BuildingUpgradeState[]): number =>
	buildingUpgrades.length + (castleUpgrade ? 1 : 0);
