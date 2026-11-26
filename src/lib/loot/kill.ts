import { COMBAT } from '@/config/combatConfig';
import { CHEST, LUCK } from '@/config/spawns';
import { isBoss, monsterDef, rewardLevelMult } from '@/lib/monsters';
import type { Rng } from '@/lib/rng';
import type { Drop, Monster } from '@/types/game';
import { MONSTER_CHEST, monsterChestItemId, type MonsterChestTier } from '@/config/monsterChests';
import { generateLoot } from './generate';
import { rollJunkLoot } from './junkDrops';

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
	/** Bestiary mastery against this monster (`masteryBonusesFor`), in %: extra kill gold, extra kill XP and a higher chance of the gear roll */
	masteryGoldPct?: number;
	masteryXpPct?: number;
	masteryLootPct?: number;
	/** The deed bonuses (`deedBonuses`, claimed point milestones), in %: extra kill gold and kill XP, on every monster */
	deedGoldPct?: number;
	deedXpPct?: number;
	/** The Paragon upgrades (docs/plan/paragon.md): percentage points more chance that a normal monster drops its chest, and a relative boost to the odds of rare-and-better gear */
	chestDropPts?: number;
	epicFindPct?: number;
}

export interface KillLoot {
	gold: number;
	xp: number;
	hide: number;
	items: Drop[];
	/** Crafting ingredients the kill dropped, for the crafting bag (key -> amount); they never touch the bag or the merchant */
	stash: Record<string, number>;
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
 * gold     = floor(max(10, goldBase x (1 + 0.005 x Luck) x (1 + Gold Find%)) x (lucky ? 3 : 1) x (1 + Kill Rewards%) x (1 + mastery gold%) x (1 + deed gold%))
 * xp       = max(5, min(xp/s x rewardSec, xpCap) x levelMult^(level - refLevel) x xpScale) x (lucky ? 3 : 1) x (1 + Kill Rewards%) x (1 + mastery XP%) x (1 + deed XP%)      (xpScale 3: kills carry the levelling, tile XP is small)      (xp/s includes the XP gain %)
 * hide     = floor(hide/s x rewardSec x levelMult^(level - refLevel) x 0.6 x (lucky ? 3 : 1))
 */
export const killIncome = (monster: Pick<Monster, 'type' | 'level'>, ctx: KillContext): { gold: number; xp: number; hide: number } => {
	const { reward } = monsterDef(monster.type);
	const levelMult = rewardLevelMult(monster.type, monster.level);
	const luckBonus = 1 + ctx.luck * CHEST.luckBonusPerPoint;
	const goldFind = 1 + (ctx.goldFind ?? 0) / 100;
	const bonus = ctx.lucky ? LUCK.goldenMonster.rewardMultiplier : 1;
	const kills = 1 + (ctx.killRewardPct ?? 0) / 100;
	const masteryGold = 1 + (ctx.masteryGoldPct ?? 0) / 100;
	const masteryXp = 1 + (ctx.masteryXpPct ?? 0) / 100;
	const deedGold = 1 + (ctx.deedGoldPct ?? 0) / 100;
	const deedXp = 1 + (ctx.deedXpPct ?? 0) / 100;
	// the monster's part first (income share, capped, times its level), the player's investment (Luck, Gold Find, Kill Rewards %) after the cap
	const goldBase = Math.min(ctx.goldPerSec * reward.gold.rewardSec, reward.gold.cap) * levelMult;
	const xpBase = Math.min(ctx.xpPerSec * reward.xp.rewardSec, reward.xp.cap) * levelMult * COMBAT.rewards.xpScale;
	return {
		gold: Math.floor(Math.max(COMBAT.rewards.minGold, goldBase * luckBonus * goldFind) * bonus * kills * masteryGold * deedGold),
		xp: Math.max(COMBAT.rewards.minXp, xpBase) * bonus * kills * masteryXp * deedXp,
		// pelts stay a share of the farm's hide income (uncapped; goods per family are a separate task)
		hide: Math.floor((ctx.hidePerSec ?? 0) * reward.gold.rewardSec * levelMult * COMBAT.rewards.hideShare * bonus),
	};
};

/**
 * The monster chests a kill drops (IDL-163, `MONSTER_CHEST`): a boss always a Royal chest, a golden (lucky) monster always an Arcane chest on top, a normal monster the chest of its biome's tier with a 2 % chance. Rolled **after** everything else of the kill (the gear and the junk),
 * so it adds drops and never changes the ones a kill had before; a boss and the golden chest draw no random number.
 *
 * @category Loot/Monster chests
 * @order 2
 */
export const rollChestDrops = (monster: Pick<Monster, 'type'>, ctx: Pick<KillContext, 'lucky' | 'chestDropPts'>, rng: Rng): Drop[] => {
	const chest = (tier: MonsterChestTier): Drop => ({ kind: 'consumable', id: monsterChestItemId(tier), qty: 1 });
	const drops: Drop[] = [];
	if (isBoss(monster.type)) drops.push(chest('royal'));
	else {
		const tier = MONSTER_CHEST.tierOfBiome[monsterDef(monster.type).spawn.biomes[0]];
		if (tier && rng() >= 1 - (MONSTER_CHEST.dropChance + (ctx.chestDropPts ?? 0) / 100)) drops.push(chest(tier));
	}
	if (ctx.lucky) drops.push(chest('arcane'));
	return drops;
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
			dropChancePct: ctx.masteryLootPct,
			epicFindPct: ctx.epicFindPct,
			extraGearRolls: ctx.lucky ? LUCK.goldenMonster.extraGearRolls : 0,
		},
		rng,
	);
	if (result.warnings.length) console.warn('[loot]', ...result.warnings);
	// junk materials come last, so the rest of the kill's rolls are untouched
	const junk = rollJunkLoot({ level: monster.level, gold, luck: ctx.luck, boss: isBoss(monster.type), lucky: !!ctx.lucky, type: monster.type }, rng);
	const chests = rollChestDrops(monster, ctx, rng);
	return { gold, xp, hide, items: [...result.drops, ...junk.drops, ...chests], stash: junk.stash, pity: result.pity };
};
