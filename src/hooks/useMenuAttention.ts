import { useGameStore } from '@/stores/gameStore';
import { farmHasPurchase } from '@/utils/game/farm';

/**
 * What in the header has something waiting: unspent stat points (the avatar, which opens the character window) and an affordable animal or
 * farm upgrade (the Farm button). Each window has its own flag; `any` is only for callers that want either. Booleans only, so subscribers re-render when a flag flips, not on every tick.
 */
export function useMenuAttention() {
	const stats = useGameStore((state) => state.characterStats.availablePoints > 0);
	const farm = useGameStore((state) => farmHasPurchase(state.resources, state.farmLevels, state.farmUpgrades));
	return { stats, farm, any: stats || farm };
}
