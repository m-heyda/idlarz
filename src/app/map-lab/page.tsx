'use client';
/**
 * Map lab (`/map-lab`): a public, client-only page to look at and tweak the art. It renders the real map components (`Grid`, `Tile`, terrain, minimap) over a simulated world: no login, no `/api/*` call, nothing saved.
 * The panel offers biome painting, extending land, erasing, chests and monsters (by hand or random spawns), brush size, castle level, presets (start ring, rolled 60 / 400, every biome), undo (Ctrl+Z) and JSON export / import (a lab file, not a game save).
 *
 * - `components/game/mapSource.tsx`: the map components read their store from this context. The game gets the real `useGameStore` / `useViewStore` by default; the lab provides `stores/labStore.ts` and its own view store (`createViewStore`).
 * - `lib/dragPaint.ts` (pure): hold-and-drag drawing. `createStroke(apply)` turns pointer moves into the new cells of one stroke (line interpolation, brush, no repeats, capped).
 * - `lib/mapEdit.ts` (pure): `applyStroke(world, cells, tool)` plus the tools (`paintTool`, `extendTool`, `eraseTool`, `chestTool`, `extendRing`). A new tool is one more `(world, cell) => Tile | undefined | 'skip'` function.
 * - The lab's random chests use a plain picker on purpose: the game's weighted chest placement stays server-side (`tests/server/serverBoundary.test.ts`).
 *
 * @title Map lab
 * @category Architecture/Art
 * @order 2
 */

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
					{ brush, onEnd: () => (snapped = false) },
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
