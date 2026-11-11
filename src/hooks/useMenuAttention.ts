import { useAchievementStore } from '@/stores/achievementStore';
import { useGameStore } from '@/stores/gameStore';
import { farmHasPurchase } from '@/utils/game/farm';

/**
 * What in the header has something waiting: unspent stat points (the avatar, which opens the character window) an affordable animal or
 * farm upgrade (the Farm button) and an earned achievement not claimed yet (the Achievements button). Each window has its own flag; `any` is only for callers that want either. Booleans only, so subscribers re-render when a flag flips, not on every tick.
 */
export function useMenuAttention() {
	const stats = useGameStore((state) => state.characterStats.availablePoints > 0);
	const farm = useGameStore((state) => farmHasPurchase(state.resources, state.farmLevels, state.farmUpgrades));
	const achievements = useAchievementStore((state) => state.earned.some((id) => !state.claimed.includes(id)));
	return { stats, farm, achievements, any: stats || farm || achievements };
}
