import { useCallback, useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { emitFloat, mergeItems, takeTileTap, FloatItem } from '@/lib/floatText';

/**
 * Click income: a real click on the map earns gold (rate limited in the store); a click on an owned tile also carries
 * that tile's tap bonus (already applied by the store). Both show up as one popup under the cursor.
 * Clicks on windows, the header or buttons never pay, and neither do synthetic clicks.
 */
export function useClickIncome() {
	const clickForGold = useGameStore((state) => state.clickForGold);

	const handleGameClick = useCallback(
		(e: MouseEvent) => {
			const items: FloatItem[] = [];

			const onMap = e.target instanceof Element && !!e.target.closest('[data-click-area]');
			if (onMap) {
				const goldToAdd = clickForGold({
					eventId: e.timeStamp,
					now: performance.now(),
					trusted: e.isTrusted,
				});
				if (goldToAdd > 0) items.push({ resource: 'gold', amount: goldToAdd });
			}

			const tap = takeTileTap();
			if (items.length === 0 && !tap) return;

			emitFloat({
				x: e.clientX,
				y: e.clientY,
				items: mergeItems(items, tap?.items ?? []),
				lucky: tap?.lucky,
			});
		},
		[clickForGold]
	);

	useEffect(() => {
		window.addEventListener('click', handleGameClick);
		return () => window.removeEventListener('click', handleGameClick);
	}, [handleGameClick]);
}
