import { COMBAT } from '@/config/combatConfig';
import { aggregateStats } from '@/lib/inventory';
import type { Equipment } from '@/types/game';

// What a worn belt does beyond its numbers (IDL-138/139): shorter potion cooldowns, stronger potions, more potion hotkey slots and more
// bag slots. The stats are summed like every other (aggregateStats); this file turns the totals into the numbers the fights and the bag use.
// The server (lib/offline/profile.ts, inventory ops) and the browser (effectiveStats, the combat widget) both read these.

/** The shared potion cooldown in seconds after the worn belt's cut, never under the floor. */
export const potionCooldownSec = (equipment: Equipment): number =>
	Math.max(COMBAT.potionCooldownMinSec, COMBAT.potionCooldownSec * (1 - aggregateStats(equipment).potionCooldownPct / 100));

/** What a potion heals is multiplied by this (1 without a belt). */
export const potionPower = (equipment: Equipment): number => 1 + aggregateStats(equipment).potionPowerPct / 100;

/** The potion hotkey slots: the base three plus the belt's. */
export const potionSlotCount = (equipment: Equipment): number => COMBAT.potionSlots + aggregateStats(equipment).potionSlots;

/** The potion slot a number key drinks: 1-3 are the first three slots, 4 and 5 are the skills, 6 and up are the slots a belt adds. -1: not a potion key. */
export const potionIndexOfKey = (key: number): number => (key >= 1 && key <= 3 ? key - 1 : key >= 6 ? key - 3 : -1);
