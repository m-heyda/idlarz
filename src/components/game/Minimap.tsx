import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { TILE_SIZE } from '@/config/gameConfig';
import { CHEST_COLOR, MONSTER_COLOR, minimapLayout, minimapMarkers, minimapToTile, paintChestGlow, paintMinimap, viewRectangle } from '@/lib/minimap';
import { useUiStore } from '@/stores/uiStore';
import '@/styles/Minimap.css';
import { useMapGame, useMapView } from './mapSource';

/** Size of the overview (css px) */
const BOX = { w: 176, h: 132 };
/** The picture is repainted at most this often while the map changes (a purchase repaints one frame later, a flood of them is batched) */
const REPAINT_MS = 200;

const MinimapBody: React.FC = () => {
	const game = useMapGame();
	const view = useMapView();
	const tiles = game((state) => state.tiles);
	// Where the monsters stand, as one string: the monster list itself is a new array every tick (they age), their places rarely change
	const monsterPlaces = game((state) => state.monsters.map((m) => `${m.x},${m.y}`).join(';'));
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const glowRef = useRef<HTMLCanvasElement>(null);
	const viewRef = useRef<HTMLDivElement>(null);
	const lastPaint = useRef(0);
	const dragging = useRef(false);

	const layout = useMemo(() => minimapLayout(tiles.bounds, BOX), [tiles.bounds]);
	const monsters = useMemo(
		() => (monsterPlaces ? monsterPlaces.split(';').map((p) => ({ x: Number(p.split(',')[0]), y: Number(p.split(',')[1]) })) : []),
		[monsterPlaces]
	);
	const chestCount = tiles.stats.chests;

	useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext('2d');
		const glowCtx = glowRef.current?.getContext('2d');
		if (!canvas || !ctx) return;
		const paint = () => {
			lastPaint.current = performance.now();
			const markers = minimapMarkers(tiles, monsters, layout);
			const image = ctx.createImageData(layout.width, layout.height);
			paintMinimap(image.data, tiles, layout, markers);
			ctx.putImageData(image, 0, 0);
			if (glowCtx) {
				const glow = glowCtx.createImageData(layout.width, layout.height);
				paintChestGlow(glow.data, layout, markers.chests);
				glowCtx.putImageData(glow, 0, 0);
			}
		};
		const wait = REPAINT_MS - (performance.now() - lastPaint.current);
		if (wait <= 0) {
			paint();
			return;
		}
		const timer = setTimeout(paint, wait);
		return () => clearTimeout(timer);
	}, [tiles, monsters, layout]);

	// The outline of the part of the map on screen follows every pan frame, so it is moved straight in the DOM (no React render per frame)
	useLayoutEffect(() => {
		const place = () => {
			const el = viewRef.current;
			if (!el) return;
			const { x, y, zoom, w, h } = view.getState();
			const tilePx = TILE_SIZE * zoom;
			const rect = viewRectangle(layout, { minX: -x / tilePx, maxX: (w - x) / tilePx, minY: -y / tilePx, maxY: (h - y) / tilePx });
			el.style.left = `${rect.left}px`;
			el.style.top = `${rect.top}px`;
			el.style.width = `${Math.max(2, rect.width)}px`;
			el.style.height = `${Math.max(2, rect.height)}px`;
		};
		place();
		return view.subscribe(place);
	}, [layout, view]);

	const moveTo = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const box = canvasRef.current?.getBoundingClientRect();
			if (!box) return;
			const t = minimapToTile(layout, ((e.clientX - box.left) / box.width) * layout.width, ((e.clientY - box.top) / box.height) * layout.height);
			view.getState().centerOn(t.x * TILE_SIZE, t.y * TILE_SIZE);
		},
		[layout, view]
	);

	const summary = [
		monsters.length > 0 ? `${monsters.length} ${monsters.length === 1 ? 'enemy' : 'enemies'}` : '',
		chestCount > 0 ? `${chestCount} ${chestCount === 1 ? 'chest' : 'chests'}` : '',
	].filter(Boolean);

	return (
		<div
			className='minimap'
			style={{ width: BOX.w, height: BOX.h }}
			title={`Map overview: click or drag to move the view${summary.length ? ` (${summary.join(', ')})` : ''}`}
			aria-label={`Map overview${summary.length ? `, ${summary.join(', ')}` : ''}`}
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
			<canvas ref={glowRef} width={layout.width} height={layout.height} className='minimap-canvas minimap-glow' aria-hidden />
			<div ref={viewRef} className='minimap-view' />
			{(monsters.length > 0 || chestCount > 0) && (
				<div className='minimap-legend' aria-hidden>
					{monsters.length > 0 && (
						<span>
							<i style={{ background: MONSTER_COLOR }} />
							{monsters.length}
						</span>
					)}
					{chestCount > 0 && (
						<span>
							<i style={{ background: CHEST_COLOR, boxShadow: `0 0 4px ${CHEST_COLOR}` }} />
							{chestCount}
						</span>
					)}
				</div>
			)}
		</div>
	);
};

/** The overview of the whole explored map (bottom right), switched on and off in the global menu. */
const Minimap: React.FC = () => {
	const show = useUiStore((state) => state.showMinimap);
	return show ? <MinimapBody /> : null;
};

export default Minimap;
