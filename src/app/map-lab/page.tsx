'use client';

import React, { useEffect, useMemo } from 'react';
import Grid from '@/components/game/Grid';
import BottomRightStack from '@/components/game/BottomRightStack';
import { MapSourceProvider, type MapSource } from '@/components/game/mapSource';
import { createStroke } from '@/lib/dragPaint';
import { STROKE_TOOLS, useLabStore } from '@/stores/labStore';
import { createViewStore } from '@/stores/viewStore';
import { useUiStore } from '@/stores/uiStore';
import CombatPreview from './CombatPreview';
import LabPanel from './LabPanel';

/**
 * /map-lab: the real map components over a simulated world, for judging and tweaking the art. No account, no save, no
 * server: nothing here imports the game's sync hooks, and the lab store never persists.
 */
const labView = createViewStore(() => useLabStore.getState().tiles);

const MapLab: React.FC = () => {
	const tool = useLabStore((s) => s.tool);
	const brush = useLabStore((s) => s.brush);
	const previewing = useLabStore((s) => s.combatPreview !== null);

	const source = useMemo<MapSource>(() => {
		const lab = () => useLabStore.getState();
		let snapped = false;
		const stroke = STROKE_TOOLS.includes(tool)
			? createStroke(
					(cells) => {
						// one undo step per stroke, taken when it first draws
						if (!snapped) {
							snapped = true;
							lab().snapshot();
						}
						lab().drawCells(cells);
					},
					{ brush, onEnd: () => (snapped = false) }
				)
			: undefined;
		return {
			game: useLabStore,
			view: labView,
			drag: stroke,
			onTile: (x, y, button) => {
				if (button === 0) lab().clickTile(x, y);
			},
		};
	}, [tool, brush]);

	useEffect(() => {
		useUiStore.setState({ showMinimap: true });
		const onKey = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
				e.preventDefault();
				useLabStore.getState().undo();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	return (
		<MapSourceProvider value={source}>
			<Grid />
			{/* the real bottom right stack (combat window above the minimap); the combat window is the preview's mock */}
				<BottomRightStack combat={previewing ? <CombatPreview /> : null} />
			<LabPanel />
		</MapSourceProvider>
	);
};

export default MapLab;
