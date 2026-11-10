// What a rebirth unlocks: the biome whose `BIOME_RULES.unlockAfterRebirths` equals the new rebirth count (IDL-258).
import { BIOMES, REBIRTH_BIOME_OUTPUT } from '@/config/biomes';
import { BIOME_RULES } from '@/config/biomeRules';
import { BIOME_YIELD } from '@/config/economy';
import { MONSTERS } from '@/config/combatConfig';
import { REBIRTH } from '@/config/rebirth';
import { emberIncomeBonus } from '@/utils/game/rebirth';
import type { PrestigeState } from '@/types/game';

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
	/** Monsters that start to appear with this rebirth (`spawn.minRebirths` in `MONSTERS`): how many normal ones and bosses. Their names stay hidden until the player meets them (monster discovery). */
	monsters: { normal: number; boss: number };
	note: string;
}

/** Monsters whose `spawn.minRebirths` is exactly this rebirth: they appear on the new map from now on. */
export const monstersUnlockedAt = (rebirths: number): { normal: number; boss: number } => {
	const found = Object.values(MONSTERS).filter((def) => (def.spawn.minRebirths ?? 0) === rebirths && rebirths > 0);
	return { normal: found.filter((def) => def.grade !== 'boss').length, boss: found.filter((def) => def.grade === 'boss').length };
};

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
		monsters: monstersUnlockedAt(rebirths),
		note: REBIRTH_UNLOCK_NOTE,
	};
}

/** What the browser knew the moment before a rebirth wiped the run (`RebirthDialog` captures it). */
export interface RebirthRunInput {
	/** Purchased tiles (the economy count) and the castle level the run ended with */
	ownedTiles: number;
	castleLevel: number;
	level: number;
	/** Seconds played over the whole account (a rebirth keeps it) */
	playSeconds: number;
	/** Resource per second at the end of the run (`resourceRates`) */
	rates: Record<string, number>;
	/** Lifetime kills of every monster type, when known */
	kills?: number;
	before: PrestigeState;
	after: PrestigeState;
}

/** The result screen's numbers: what the rebirth paid and what the run had reached. */
export interface RebirthRunSummary {
	rebirths: number;
	/** Embers this rebirth gave, and the Embers now in hand and earned in all */
	embersGained: number;
	embersTotal: number;
	embersEverEarned: number;
	/** The permanent income bonus (fraction, 0.35 = +35%) before and after this rebirth */
	incomeBonusBefore: number;
	incomeBonusAfter: number;
	ownedTiles: number;
	castleLevel: number;
	level: number;
	playSeconds: number;
	/** The run's best production rates, highest first (at most four, zeros left out) */
	topRates: { resource: string; perSecond: number }[];
	kills: number | null;
	/** Tiles the next rebirth asks for */
	nextTilesNeeded: number;
}

/**
 * The numbers of the rebirth result screen, from what the run had reached and the prestige before and after. The Embers gained are read from the two prestige states
 * (what the player really got, whether the server or the browser named the amount), never recomputed here.
 *
 * @category Progression/Rebirth
 * @order 7
 */
export function rebirthRunSummary(input: RebirthRunInput): RebirthRunSummary {
	const { before, after } = input;
	return {
		rebirths: after.rebirths,
		embersGained: Math.max(0, after.legacyPoints - before.legacyPoints),
		embersTotal: after.legacyPoints,
		embersEverEarned: after.legacyEarned,
		incomeBonusBefore: emberIncomeBonus(before.legacyEarned),
		incomeBonusAfter: emberIncomeBonus(after.legacyEarned),
		ownedTiles: input.ownedTiles,
		castleLevel: input.castleLevel,
		level: input.level,
		playSeconds: input.playSeconds,
		topRates: Object.entries(input.rates)
			.filter(([, perSecond]) => perSecond > 0)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 4)
			.map(([resource, perSecond]) => ({ resource, perSecond })),
		kills: input.kills ?? null,
		nextTilesNeeded: REBIRTH.tilesNeeded(after.rebirths),
	};
}
