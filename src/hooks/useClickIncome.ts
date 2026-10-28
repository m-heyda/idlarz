import { useCallback, useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { emitFloat } from '@/lib/floatText';

/**
 * Click income: a real click on the map earns gold (rate limited in the store) and shows up as a popup under the cursor.
 * Clicks on windows, the header or buttons never pay, and neither do synthetic clicks.
 */
export function useClickIncome() {
	const clickForGold = useGameStore((state) => state.clickForGold);

	const handleGameClick = useCallback(
		(e: MouseEvent) => {
			const onMap = e.target instanceof Element && !!e.target.closest('[data-click-area]');
			if (!onMap) return;

			const goldToAdd = clickForGold({
				eventId: e.timeStamp,
				now: performance.now(),
				trusted: e.isTrusted,
			});
			if (goldToAdd <= 0) return;

			emitFloat({
				x: e.clientX,
				y: e.clientY,
				items: [{ resource: 'gold', amount: goldToAdd }],
			});
		},
		[clickForGold]
	);

	useEffect(() => {
		window.addEventListener('click', handleGameClick);
		return () => window.removeEventListener('click', handleGameClick);
	}, [handleGameClick]);
}
