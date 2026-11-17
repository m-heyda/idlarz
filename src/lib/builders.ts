import type { BuildingUpgradeState, CastleUpgradeState, PrestigeState } from '@/types/game';

/**
 * Builders the Ember shop adds (builder #3 and up). Zero until that upgrade exists: the Ember shop PR replaces this body (`emberEffect(prestige, 'builders...')`), and every reader of {@link builderCount} follows.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const emberBuilders = (_prestige?: PrestigeState): number => 0;

/** Builders at work: every running building upgrade plus the castle's. */
export const busyBuilders = (castleUpgrade: CastleUpgradeState | null, buildingUpgrades: readonly BuildingUpgradeState[]): number =>
	buildingUpgrades.length + (castleUpgrade ? 1 : 0);
