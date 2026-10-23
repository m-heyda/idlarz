import { COMBAT, MONSTERS } from '@/config/combatConfig';
import type { MonsterType } from '@/types/game';

export interface MonsterStats {
	maxHp: number;
	attack: number;
	attackIntervalSec: number;
	rewardSec: number;
}

/** HP, attack and reward of a monster at a tier (the Rat King ignores the tier). */
export const monsterStats = (type: MonsterType, tier: number): MonsterStats => {
	if (type === 'ratKing') {
		const k = MONSTERS.ratKing;
		return { maxHp: k.hp, attack: k.attack, attackIntervalSec: k.attackIntervalSec, rewardSec: k.rewardSec };
	}
	const r = MONSTERS.rat;
	const t = Math.max(1, Math.min(COMBAT.maxTier, Math.floor(tier))) - 1;
	return {
		maxHp: Math.round(r.hp * Math.pow(r.hpGrowth, t)),
		attack: Math.round(r.attack * Math.pow(r.attackGrowth, t)),
		attackIntervalSec: r.attackIntervalSec,
		rewardSec: r.rewardSec * Math.pow(r.rewardGrowth, t),
	};
};
