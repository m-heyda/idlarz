import { COMBAT } from '@/config/combatConfig';
import { CHEST } from '@/config/gameConfig';
import { BASIC_GEAR, RATTATUI_SET } from '@/config/itemCatalog';
import { monsterStats } from '@/lib/monsters';
import type { Monster } from '@/types/game';

export interface KillContext {
	goldPerSec: number;
	xpPerSec: number;
	luck: number;
	/** Item ids the player already has (bag + worn): the king prefers Rattatui pieces that are still missing */
	owned?: readonly string[];
}

/**
 * Rewards for a kill. Gold and XP are "seconds of income" (like chests) so they scale with the economy.
 * A rat can drop plain gear and a potion (one rng call each, one more to pick the gear piece). Only the Rat King
 * drops Rattatui set pieces.
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
	const items: { id: string; qty: number }[] = [];

	if (monster.type === 'ratKing') {
		const { setPieces, extraPieceChance, potions } = COMBAT.drops.king;
		const owned = new Set(ctx.owned ?? []);
		const left = RATTATUI_SET.pieces.filter((id) => !owned.has(id));
		const count = setPieces + (rng() < extraPieceChance ? 1 : 0);
		for (let i = 0; i < count; i++) {
			const pool = left.length ? left : RATTATUI_SET.pieces; // every piece owned: duplicates are still worth selling
			const id = pool[Math.floor(rng() * pool.length) % pool.length];
			items.push({ id, qty: 1 });
			const at = left.indexOf(id);
			if (at >= 0) left.splice(at, 1);
		}
		items.push({ id: 'potion_minor', qty: potions });
		return { gold, xp, items };
	}

	const tierSteps = Math.max(0, monster.tier - 1);
	if (rng() < COMBAT.drops.basicGearBase + tierSteps * COMBAT.drops.basicGearTierBonus) {
		items.push({ id: BASIC_GEAR[Math.floor(rng() * BASIC_GEAR.length) % BASIC_GEAR.length], qty: 1 });
	}
	if (rng() < COMBAT.drops.potionBase + tierSteps * COMBAT.drops.potionTierBonus) {
		items.push({ id: 'potion_minor', qty: 1 });
	}
	return { gold, xp, items };
};
