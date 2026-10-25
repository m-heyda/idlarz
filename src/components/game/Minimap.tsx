import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { TILE_SIZE } from '@/config/gameConfig';
import { minimapLayout, minimapToTile, paintMinimap, viewRectangle } from '@/lib/minimap';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { useViewStore } from '@/stores/viewStore';
import '@/styles/Minimap.css';

/** Size of the overview (css px) */
const BOX = { w: 176, h: 132 };
/** The picture is repainted at most this often while the map changes (a purchase repaints one frame later, a flood of them is batched) */
const REPAINT_MS = 200;

const MinimapBody: React.FC = () => {
	const tiles = useGameStore((state) => state.tiles);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const viewRef = useRef<HTMLDivElement>(null);
	const lastPaint = useRef(0);
	const dragging = useRef(false);

	const layout = useMemo(() => minimapLayout(tiles.bounds, BOX), [tiles.bounds]);

	useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext('2d');
		if (!canvas || !ctx) return;
		const paint = () => {
			lastPaint.current = performance.now();
			const image = ctx.createImageData(layout.width, layout.height);
			paintMinimap(image.data, tiles, layout);
			ctx.putImageData(image, 0, 0);
		};
		const wait = REPAINT_MS - (performance.now() - lastPaint.current);
		if (wait <= 0) {
			paint();
			return;
		}
		const timer = setTimeout(paint, wait);
		return () => clearTimeout(timer);
	}, [tiles, layout]);

	// The outline of the part of the map on screen follows every pan frame, so it is moved straight in the DOM (no React render per frame)
	useLayoutEffect(() => {
		const place = () => {
			const el = viewRef.current;
			if (!el) return;
			const { x, y, zoom, w, h } = useViewStore.getState();
			const tilePx = TILE_SIZE * zoom;
			const rect = viewRectangle(layout, { minX: -x / tilePx, maxX: (w - x) / tilePx, minY: -y / tilePx, maxY: (h - y) / tilePx });
			el.style.left = `${rect.left}px`;
			el.style.top = `${rect.top}px`;
			el.style.width = `${Math.max(2, rect.width)}px`;
			el.style.height = `${Math.max(2, rect.height)}px`;
		};
		place();
		return useViewStore.subscribe(place);
	}, [layout]);

	const moveTo = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const box = canvasRef.current?.getBoundingClientRect();
			if (!box) return;
			const t = minimapToTile(layout, ((e.clientX - box.left) / box.width) * layout.width, ((e.clientY - box.top) / box.height) * layout.height);
			useViewStore.getState().centerOn(t.x * TILE_SIZE, t.y * TILE_SIZE);
		},
		[layout]
	);

	return (
		<div
			className='minimap'
			style={{ width: BOX.w, height: BOX.h }}
			title='Map overview: click or drag to move the view'
			aria-label='Map overview'
			onPointerDown={(e) => {
				if (e.button !== 0) return;
				dragging.current = true;
				e.currentTarget.setPointerCapture(e.pointerId);
				moveTo(e);
			}}
			onPointerMove={(e) => dragging.current && moveTo(e)}
			onPointerUp={() => (dragging.current = false)}
			onPointerCancel={() => (dragging.current = false)}>
			<canvas ref={canvasRef} width={layout.width} height={layout.height} className='minimap-canvas' />
			<div ref={viewRef} className='minimap-view' />
		</div>
	);
};

/** The overview of the whole explored map (bottom right, above the statistics), switched on and off in the global menu. */
const Minimap: React.FC = () => {
	const show = useUiStore((state) => state.showMinimap);
	return show ? <MinimapBody /> : null;
};

export default Minimap;
