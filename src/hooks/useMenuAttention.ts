import { useGameStore } from '@/stores/gameStore';
import { farmHasPurchase } from '@/utils/gameUtils';

/**
 * Which tabs of the main menu have something waiting: unspent stat points (Stats) and an affordable animal or
 * farm upgrade (Farm). Booleans only, so subscribers re-render when a flag flips, not on every tick.
 */
export function useMenuAttention() {
	const stats = useGameStore((state) => state.characterStats.availablePoints > 0);
	const farm = useGameStore((state) => farmHasPurchase(state.resources, state.farmLevels, state.farmUpgrades));
	return { stats, farm, any: stats || farm };
}
