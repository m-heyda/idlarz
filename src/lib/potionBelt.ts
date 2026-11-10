import { COMBAT } from '@/config/combatConfig';
import type { StatTotals } from '@/catalog/stats';

// The potion belt (IDL-138 / IDL-153): the three stats only a belt carries, turned into the numbers a fight uses. Pure; the server reads them through
// `playerProfile`, the browser through `effectiveStats`, both from `aggregateStats`, so the hotkey bar and the fight agree.

type BeltGear = Pick<StatTotals, 'potionCooldownPct' | 'potionPowerPct' | 'potionSlots'>;

/**
 * The shared cooldown between potions inside a fight, shortened by the worn belt's Potion Cooldown and never below `COMBAT.potionCooldownMinSec` (4 s, -50 %).
 *
 * @category Combat/Potions and skills
 * @order 5
 * @formula
 * cooldown = max(potionCooldownMinSec, potionCooldownSec x (1 - potionCooldownPct / 100))       8 s base, 4 s floor
 */
export const potionCooldownSec = (gear: Pick<BeltGear, 'potionCooldownPct'>): number =>
	Math.max(COMBAT.potionCooldownMinSec, COMBAT.potionCooldownSec * (1 - Math.max(0, gear.potionCooldownPct) / 100));

/**
 * What a drunk potion's healing is multiplied by: the belt's Potion Power, capped at `COMBAT.potionPowerMaxPct`. It scales the HP and mana a potion restores and its heal over time, not the strength of a buff.
 *
 * @category Combat/Potions and skills
 * @order 6
 * @formula
 * power = 1 + min(potionPowerMaxPct, potionPowerPct) / 100
 */
export const potionPower = (gear: Pick<BeltGear, 'potionPowerPct'>): number => 1 + Math.min(COMBAT.potionPowerMaxPct, Math.max(0, gear.potionPowerPct)) / 100;

/**
 * Potion stacks on the hotkey bar: `potionBaseSlots` (3) plus the belt's Potion Slots, at most `potionMaxSlots` (5). Keys 1..N drink the first N potion stacks, the skills follow on the next keys.
 *
 * @category Combat/Potions and skills
 * @order 7
 * @formula
 * slots = min(potionMaxSlots, potionBaseSlots + potionSlots)
 */
export const potionSlotCount = (gear: Pick<BeltGear, 'potionSlots'>): number =>
	Math.min(COMBAT.potionMaxSlots, COMBAT.potionBaseSlots + Math.max(0, Math.floor(gear.potionSlots)));
