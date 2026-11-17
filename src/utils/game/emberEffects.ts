// What the Ember shop levels of a save are worth: the one place a shop effect is read. Kept apart from utils/game/rebirth.ts so the merchant helpers can read Ember effects without an import cycle.
import { EMBER_DISABLED, EMBER_UPGRADES, type EmberUpgradeId } from '@/config/rebirth';
import type { PrestigeState } from '@/types/game';

export const emberLevel = (prestige: PrestigeState | undefined, id: EmberUpgradeId): number => prestige?.upgrades?.[id] ?? 0;

/** Effect of a shop upgrade as a fraction (or, for Provisions, as a number of starting bundles). */
export const emberEffect = (prestige: PrestigeState | undefined, id: EmberUpgradeId): number =>
	EMBER_DISABLED.has(id) ? 0 : Math.min(emberLevel(prestige, id), EMBER_UPGRADES[id].maxLevel) * EMBER_UPGRADES[id].effectPerLevel;

/** Whether a one-time shop upgrade (Potion Reflex, Eternal Vigil, Imperial Decree) is owned. */
export const emberOwned = (prestige: PrestigeState | undefined, id: EmberUpgradeId): boolean =>
	(emberLevel(prestige, id) > 0 || (prestige?.grants?.includes(id) ?? false)) && !EMBER_DISABLED.has(id);

/** Upgrades the shop shows but cannot sell yet (the quest system is not built). */
export const emberDisabled = (id: EmberUpgradeId): boolean => EMBER_DISABLED.has(id);
