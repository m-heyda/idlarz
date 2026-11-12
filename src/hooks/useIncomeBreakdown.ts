import { useMemo } from 'react';
import { gearIncomePct } from '@/lib/gearEconomy';
import { useGameStore } from '@/stores/gameStore';
import { calculateResourceBreakdown } from '@/utils/game/income';

/**
 * The income of every resource split by source (`calculateResourceBreakdown`), recomputed only when one of its inputs changes (the map, the stats, the farm, the Embers, the merchant upgrades, the gear), never on a tick.
 * The header tooltips read the lines with `incomeSources` (IDL-314). Call it once where a tooltip is drawn, not per resource.
 */
export const useIncomeBreakdown = (): ReturnType<typeof calculateResourceBreakdown> => {
	const tiles = useGameStore((state) => state.tiles);
	const characterStats = useGameStore((state) => state.characterStats);
	const farmLevels = useGameStore((state) => state.farmLevels);
	const prestige = useGameStore((state) => state.prestige);
	const farmUpgrades = useGameStore((state) => state.farmUpgrades);
	const merchantUpgrades = useGameStore((state) => state.merchantUpgrades);
	const equipment = useGameStore((state) => state.equipment);
	return useMemo(
		() => calculateResourceBreakdown(tiles, characterStats, farmLevels, prestige, farmUpgrades, merchantUpgrades, gearIncomePct(equipment)),
		[tiles, characterStats, farmLevels, prestige, farmUpgrades, merchantUpgrades, equipment],
	);
};
