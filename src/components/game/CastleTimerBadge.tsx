import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { castleTimerLabel } from '@/lib/castleTimer';

/**
 * The castle upgrade's remaining time, drawn on the castle tile (no need to open the dialog). Only the castle tile mounts it and it
 * re-renders when the shown text changes (every second, or minute), never on the other income ticks.
 */
const CastleTimerBadge: React.FC = () => {
	const label = useGameStore((state) => castleTimerLabel(state.castleUpgrade));
	if (!label) return null;
	return (
		<span className='tile-timer' title='Castle upgrade in progress' aria-label={`Castle upgrade: ${label} left`}>
			{label}
		</span>
	);
};

export default CastleTimerBadge;
