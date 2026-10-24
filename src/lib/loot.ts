import { COMBAT } from '@/config/combatConfig';
import { CHEST } from '@/config/gameConfig';
import { RATTATUI_SET } from '@/config/itemCatalog';
import { monsterStats } from '@/lib/monsters';
import type { Monster } from '@/types/game';

export interface KillContext {
	goldPerSec: number;
	xpPerSec: number;
	luck: number;
}

/**
 * Rewards for a kill. Gold and XP are "seconds of income" (like chests) so they scale with the economy;
 * a set piece and a potion are rolled independently (one rng call each, one more to pick the piece).
 */
export const rollKillLoot = (
	monster: Pick<Monster, 'type' | 'tier'>,
	ctx: KillContext,
	rng: () => number
): { gold: number; xp: number; items: { id: string; qty: number }[] } => {
	const { rewardSec } = monsterStats(monster.type, monster.tier);
	const luckBonus = 1 + ctx.luck * CHEST.luckBonusPerPoint;
	const gold = Math.floor(Math.max(COMBAT.rewards.minGold, ctx.goldPerSec * rewardSec * luckBonus));
	const xp = Math.max(COMBAT.rewards.minXp, ctx.xpPerSec * rewardSec);

	const tierSteps = Math.max(0, monster.tier - 1);
	const items: { id: string; qty: number }[] = [];
	if (rng() < COMBAT.drops.setPieceBase + tierSteps * COMBAT.drops.setPieceTierBonus) {
		const pieces = RATTATUI_SET.pieces;
		items.push({ id: pieces[Math.floor(rng() * pieces.length) % pieces.length], qty: 1 });
	}
	if (rng() < COMBAT.drops.potionBase + tierSteps * COMBAT.drops.potionTierBonus) {
		items.push({ id: 'potion_minor', qty: 1 });
	}
	return { gold, xp, items };
};
