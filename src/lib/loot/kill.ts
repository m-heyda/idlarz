import { COMBAT } from '@/config/combatConfig';
import { CHEST, LUCK } from '@/config/spawns';
import { isBoss, monsterDef, rewardLevelMult } from '@/lib/monsters';
import type { Rng } from '@/lib/rng';
import type { Drop, Monster } from '@/types/game';
import { generateLoot } from './generate';
import { rollJunkDrops } from './junkDrops';

export interface KillContext {
	goldPerSec: number;
	xpPerSec: number;
	/** Hide per second of the farm; a kill pays a share of it (0 without pigs) */
	hidePerSec?: number;
	luck: number;
	/** Gold Find of the gear, in %: extra kill gold */
	goldFind?: number;
	/** Kill Rewards of the gear's set bonus, in %: extra kill gold and XP */
	killRewardPct?: number;
	/** Base item ids the player already has (bag + worn): a table with `preferMissing` favours the pieces that are still missing (no table uses it today) */
	owned?: readonly string[];
	/** Bad-luck counters from the save */
	pity?: Readonly<Record<string, number>>;
	/** A lucky monster: the gold and XP are multiplied and it adds a guaranteed gear roll */
	lucky?: boolean;
}

export interface KillLoot {
	gold: number;
	xp: number;
	hide: number;
	items: Drop[];
	/** The pity counters after this kill */
	pity: Record<string, number>;
}

/**
 * Rewards for a kill. Gold and XP are "seconds of income" (like chests) so they scale with the economy. The items come from
 * the shared loot pipeline (`generateLoot`): the monster's loot profile decides how many rolls, which rarities and which
 * item level; this adapter only adds the gold and XP and keeps the call the game and the tests have always made.
 *
 * What a kill pays. Luck, Gold Find and Kill Rewards are applied after the cap, so pay can exceed it. Minimums: 10 gold, 5 XP (`COMBAT.rewards`). `levelMult` is 1.08 per level for normal monsters and 1.03 for bosses.
 * Items: see {@link generateLoot}. Measured share of income: `docs/generated/kill-sim.md`.
 *
 * @category Monsters/Rewards
 * @formula
 * goldBase = min(gold/s x rewardSec, goldCap) x levelMult^(level - refLevel)
 * gold     = floor(max(10, goldBase x (1 + 0.005 x Luck) x (1 + Gold Find%)) x (lucky ? 3 : 1) x (1 + Kill Rewards%))
 * xp       = max(5, min(xp/s x rewardSec, xpCap) x levelMult^(level - refLevel)) x (lucky ? 3 : 1) x (1 + Kill Rewards%)      (xp/s includes the XP gain %)
 * hide     = floor(hide/s x rewardSec x levelMult^(level - refLevel) x 0.6 x (lucky ? 3 : 1))
 * @table kill-rewards
 */
export const killIncome = (monster: Pick<Monster, 'type' | 'level'>, ctx: KillContext): { gold: number; xp: number; hide: number } => {
	const { reward } = monsterDef(monster.type);
	const levelMult = rewardLevelMult(monster.type, monster.level);
	const luckBonus = 1 + ctx.luck * CHEST.luckBonusPerPoint;
	const goldFind = 1 + (ctx.goldFind ?? 0) / 100;
	const bonus = ctx.lucky ? LUCK.goldenMonster.rewardMultiplier : 1;
	const kills = 1 + (ctx.killRewardPct ?? 0) / 100;
	// the monster's part first (income share, capped, times its level), the player's investment (Luck, Gold Find, Kill Rewards %) after the cap
	const goldBase = Math.min(ctx.goldPerSec * reward.gold.rewardSec, reward.gold.cap) * levelMult;
	const xpBase = Math.min(ctx.xpPerSec * reward.xp.rewardSec, reward.xp.cap) * levelMult;
	return {
		gold: Math.floor(Math.max(COMBAT.rewards.minGold, goldBase * luckBonus * goldFind) * bonus * kills),
		xp: Math.max(COMBAT.rewards.minXp, xpBase) * bonus * kills,
		// pelts stay a share of the farm's hide income (uncapped; goods per family are a separate task)
		hide: Math.floor((ctx.hidePerSec ?? 0) * reward.gold.rewardSec * levelMult * COMBAT.rewards.hideShare * bonus),
	};
};

export const rollKillLoot = (monster: Pick<Monster, 'type' | 'level'>, ctx: KillContext, rng: Rng): KillLoot => {
	const { gold, xp, hide } = killIncome(monster, ctx);

	const result = generateLoot(
		{
			sourceId: monsterDef(monster.type).lootSourceId,
			level: monster.level,
			owned: ctx.owned,
			pity: ctx.pity,
			luck: ctx.luck,
			extraGearRolls: ctx.lucky ? LUCK.goldenMonster.extraGearRolls : 0,
		},
		rng,
	);
	if (result.warnings.length) console.warn('[loot]', ...result.warnings);
	// junk materials come last, so the rest of the kill's rolls are untouched
	const junk = rollJunkDrops({ level: monster.level, gold, luck: ctx.luck, boss: isBoss(monster.type), lucky: !!ctx.lucky }, rng);
	return { gold, xp, hide, items: [...result.drops, ...junk], pity: result.pity };
};
