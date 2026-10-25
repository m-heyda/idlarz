import { COMBAT } from '@/config/combatConfig';
import { CHEST } from '@/config/gameConfig';
import { ITEMS, isConsumable, isGear, lootPool, pickWeighted } from '@/catalog';
import { monsterStats } from '@/lib/monsters';
import type { ItemDef, Monster } from '@/types/game';

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
		const { setPieces, extraPieceChance, legendaryChance } = COMBAT.drops.king;
		const owned = new Set(ctx.owned ?? []);
		const isSetPiece = (def: ItemDef) => isGear(def) && def.rarity !== 'legendary';
		const pieces = lootPool('ratKing', monster.tier, isSetPiece).map((entry) => entry.id);
		const left = pieces.filter((id) => !owned.has(id));
		const count = setPieces + (rng() < extraPieceChance ? 1 : 0);
		for (let i = 0; i < count; i++) {
			const pool = (left.length ? left : pieces).map((id) => ({ id, weight: 1 })); // every piece owned: duplicates are still worth selling
			const id = pickWeighted(pool, rng);
			if (!id) break;
			items.push({ id, qty: 1 });
			const at = left.indexOf(id);
			if (at >= 0) left.splice(at, 1);
		}
		if (rng() < legendaryChance) {
			const id = pickWeighted(lootPool('ratKing', monster.tier, (def) => def.rarity === 'legendary'), rng);
			if (id) items.push({ id, qty: 1 });
		}
		for (const def of ITEMS) {
			const rule = def.drops?.ratKing;
			if (isConsumable(def) && rule && (rule.minTier ?? 1) <= monster.tier) items.push({ id: def.id, qty: rule.qty ?? 1 });
		}
		return { gold, xp, items };
	}

	const tierSteps = Math.max(0, monster.tier - 1);
	if (rng() < COMBAT.drops.gearBase + tierSteps * COMBAT.drops.gearTierBonus) {
		const id = pickWeighted(lootPool('rat', monster.tier, isGear), rng);
		if (id) items.push({ id, qty: 1 });
	}
	if (rng() < COMBAT.drops.potionBase + tierSteps * COMBAT.drops.potionTierBonus) {
		const id = pickWeighted(lootPool('rat', monster.tier, isConsumable), rng);
		if (id) items.push({ id, qty: 1 });
	}
	return { gold, xp, items };
};
