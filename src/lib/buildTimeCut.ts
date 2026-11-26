import type { ParagonId } from '@/config/paragon';
import { gearBuildTimePct } from '@/lib/gearEconomy';
import { idolEconomy } from '@/lib/idolEconomy';
import type { Equipment } from '@/types/game';
import type { World } from '@/utils/world';

/**
 * The % off build timers that does not come from the Ember shop (IDL-145): the standing Dwarf Statue plus a legendary's build-time perk (Runeforged Titanhammer, -25 %). This is the number every duration function
 * takes as `idolBuildTimePct`; `buildTimeReduction` adds the Ember upgrade of the timer's kind and cuts the sum at the 60 % cap, so Embers, Idols and gear share one ceiling. The browser and the server both read it
 * through here, so a timer is the same length on both sides.
 *
 * @category Economy/Buildings
 * @order 7
 * @formula
 * extra = Dwarf Statue % + worn gear build time % + Paragon Build speed %        reduction = min(60 %, Ember upgrade of the kind + extra)
 */
export const buildTimeCutPct = (
	tiles: World,
	idolLevels: Record<string, number> | undefined,
	equipment: Equipment,
	paragon?: Partial<Record<ParagonId, number>>,
): number => idolEconomy(tiles, idolLevels ?? {}, paragon).buildTimePct + gearBuildTimePct(equipment);
