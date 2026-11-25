import type { MonsterFilter } from '@/config/mapMarks';
import { growthInfo, isBoss } from '@/lib/monsters';
import type { LimitContext } from '@/lib/limits';
import type { Monster } from '@/types/game';

/**
 * Whether a monster gets a ring under a map mark's monster filter (`MonsterFilter`): every monster, only bosses, only golden (lucky) ones, those at their growth limit or those still growing (`growthInfo`, the same test the Kingdom overview counts with),
 * or those at the highest level on the map (`highestLevel`, the level of the strongest). The ring count of a filter is the number the Kingdom overview shows on that tile.
 *
 * @category Architecture/Map markers
 */
export const monsterMatches = (
	filter: MonsterFilter,
	monster: Pick<Monster, 'type' | 'level' | 'lucky' | 'spawnLevel' | 'ageSec' | 'growCap'>,
	ctx: { limits: LimitContext; highestLevel: number },
): boolean => {
	switch (filter) {
		case 'all':
			return true;
		case 'bosses':
			return isBoss(monster.type);
		case 'golden':
			return !!monster.lucky;
		case 'grown':
			return growthInfo(monster, ctx.limits).maxed;
		case 'growing':
			return !growthInfo(monster, ctx.limits).maxed;
		case 'strongest':
			return ctx.highestLevel > 0 && monster.level >= ctx.highestLevel;
	}
};
