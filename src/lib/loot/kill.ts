import { COMBAT } from '@/config/combatConfig';
import { CHEST, LUCK } from '@/config/gameConfig';
import { monsterDef, monsterStats } from '@/lib/monsters';
import type { Rng } from '@/lib/rng';
import type { Drop, Monster } from '@/types/game';
import { generateLoot } from './generate';

export interface KillContext {
	goldPerSec: number;
	xpPerSec: number;
	luck: number;
	/** Gold Find of the gear, in %: extra kill gold */
	goldFind?: number;
	/** Base item ids the player already has (bag + worn): the king prefers Rattatui pieces that are still missing */
	owned?: readonly string[];
	/** Bad-luck counters from the save */
	pity?: Readonly<Record<string, number>>;
	/** A lucky monster: the gold and XP are multiplied and it adds a guaranteed gear roll */
	lucky?: boolean;
}

export interface KillLoot {
	gold: number;
	xp: number;
	items: Drop[];
	/** The pity counters after this kill */
	pity: Record<string, number>;
}

/**
 * Rewards for a kill. Gold and XP are "seconds of income" (like chests) so they scale with the economy. The items come from
 * the shared loot pipeline (`generateLoot`): the monster's loot profile decides how many rolls, which rarities and which
 * item level; this adapter only adds the gold and XP and keeps the call the game and the tests have always made.
 */
export const rollKillLoot = (
	monster: Pick<Monster, 'type' | 'level'>,
	ctx: KillContext,
	rng: Rng
): KillLoot => {
	const { rewardSec } = monsterStats(monster.type, monster.level);
	const luckBonus = 1 + ctx.luck * CHEST.luckBonusPerPoint;
	const goldFind = 1 + (ctx.goldFind ?? 0) / 100;
	const bonus = ctx.lucky ? LUCK.luckyRat.rewardMultiplier : 1;
	const gold = Math.floor(Math.max(COMBAT.rewards.minGold, ctx.goldPerSec * rewardSec * luckBonus * goldFind) * bonus);
	const xp = Math.max(COMBAT.rewards.minXp, ctx.xpPerSec * rewardSec) * bonus;

	const result = generateLoot(
		{ sourceId: monsterDef(monster.type).lootSourceId, level: monster.level, owned: ctx.owned, pity: ctx.pity, luck: ctx.luck, extraGearRolls: ctx.lucky ? LUCK.luckyRat.extraGearRolls : 0 },
		rng
	);
	if (result.warnings.length) console.warn('[loot]', ...result.warnings);
	return { gold, xp, items: result.drops, pity: result.pity };
};
