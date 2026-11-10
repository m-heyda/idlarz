// What a rebirth unlocks: the biome whose `BIOME_RULES.unlockAfterRebirths` equals the new rebirth count (IDL-258).
import { BIOMES, REBIRTH_BIOME_OUTPUT } from '@/config/biomes';
import { BIOME_RULES } from '@/config/biomeRules';
import { BIOME_YIELD } from '@/config/economy';

/** The "what you unlocked" screen shown after a rebirth. */
export interface RebirthUnlockIntro {
	/** The rebirth that was just completed (1 = the first). */
	rebirths: number;
	biome: string;
	label: string;
	/** Output of one tile against the basic tile it is measured against (1.5 = half as much again) */
	multiplier: number;
	measuredAgainst: string;
	/** What one tile really makes per second (config output x `BIOME_YIELD.scale`, before neighbours and bonuses) */
	outputs: { resource: string; perSecond: number }[];
	note: string;
}

export const REBIRTH_UNLOCK_NOTE = 'Monsters and buildings for this land follow in a later update.';

/**
 * The biome a rebirth unlocks, with what its tiles make, for the small modal shown right after the rebirth. `null` when that rebirth unlocks nothing (the sixth and later).
 *
 * @category Progression/Rebirth
 * @order 6
 */
export function rebirthUnlockIntro(rebirths: number): RebirthUnlockIntro | null {
	const biome = Object.keys(BIOME_RULES.unlockAfterRebirths).find((b) => BIOME_RULES.unlockAfterRebirths[b] === rebirths);
	if (!biome || !BIOMES[biome]) return null;
	return {
		rebirths,
		biome,
		label: BIOMES[biome].label,
		multiplier: REBIRTH_BIOME_OUTPUT[biome]?.multiplier ?? 1,
		measuredAgainst: REBIRTH_BIOME_OUTPUT[biome]?.measuredAgainst ?? '',
		outputs: Object.entries(BIOMES[biome].resourceGeneration).map(([resource, rate]) => ({
			resource,
			perSecond: Math.round((rate as number) * BIOME_YIELD.scale * 1e3) / 1e3,
		})),
		note: REBIRTH_UNLOCK_NOTE,
	};
}
