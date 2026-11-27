import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TILE_SIZE } from '@/config/biomes';
import {
	CHEST_COLOR,
	MINIMAP_BOX_DEFAULT,
	MINIMAP_ZOOMS,
	MONSTER_COLOR,
	ORE_COLOR,
	clampMinimapBox,
	minimapLayout,
	minimapMarkers,
	minimapToTile,
	zoomedLayout,
	paintChestGlow,
	paintMinimap,
	viewRectangle,
} from '@/lib/minimap';
import { useRockStore } from '@/stores/rockStore';
import { readJsonPref, writeJsonPref } from '@/lib/uiPrefs';
import { useUiStore } from '@/stores/uiStore';
import '@/styles/Minimap.css';
import { useMapGame, useMapView } from './mapSource';

/** Where the dragged size is remembered (localStorage, see lib/uiPrefs) */
const SIZE_PREF = 'minimapSize';
/** Window space the overview must leave free: the header above it, the combat panel below and a gutter at the sides (css px) */
const RESERVED = { w: 48, h: 240 };

const room = (): { w: number; h: number } => ({ w: window.innerWidth - RESERVED.w, h: window.innerHeight - RESERVED.h });

/** The remembered size (or the default), held to the limits again in case the window got smaller since */
const readBox = () => {
	const saved = readJsonPref(SIZE_PREF) as { w?: unknown; h?: unknown } | null;
	const box = saved && typeof saved.w === 'number' && typeof saved.h === 'number' ? { w: saved.w, h: saved.h } : MINIMAP_BOX_DEFAULT;
	return clampMinimapBox(box, room());
};

/** The picture is repainted at most this often while the map changes (a purchase repaints one frame later, a flood of them is batched) */
const REPAINT_MS = 200;

const MinimapBody: React.FC = () => {
	const game = useMapGame();
	const view = useMapView();
	const tiles = game((state) => state.tiles);
	// Where the monsters stand, as one string: the monster list itself is a new array every tick (they age), their places rarely change
	const monsterPlaces = game((state) => state.monsters.map((m) => `${m.x},${m.y}`).join(';'));
	// the rocks the server put on the map, by their places (the store view changes with every click; the places do not)
	const orePlaces = useRockStore((state) =>
		Object.values(state.rocks)
			.map((r) => `${r.x},${r.y}`)
			.join(';'),
	);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const glowRef = useRef<HTMLCanvasElement>(null);
	const viewRef = useRef<HTMLDivElement>(null);
	const lastPaint = useRef(0);
	const dragging = useRef(false);
	// The box the player dragged the bottom left corner to (css px): the canvas is repainted at this size, so a bigger overview shows the map in finer detail
	const [box, setBox] = useState(readBox);
	const resize = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

	// Zoom (the + and - buttons): 1 shows the whole map, more zooms in on `focus` (a tile), which follows the screen when it leaves the zoomed part and can be dragged with the right mouse button
	const [zoom, setZoom] = useState(1);
	const [focus, setFocus] = useState({ x: 0, y: 0 });
	const panning = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);

	const fitLayout = useMemo(() => minimapLayout(tiles.bounds, box), [tiles.bounds, box]);
	const layout = useMemo(() => zoomedLayout(fitLayout, zoom, focus), [fitLayout, zoom, focus]);
	const monsters = useMemo(
		() => (monsterPlaces ? monsterPlaces.split(';').map((p) => ({ x: Number(p.split(',')[0]), y: Number(p.split(',')[1]) })) : []),
		[monsterPlaces],
	);
	const ores = useMemo(() => (orePlaces ? orePlaces.split(';').map((p) => ({ x: Number(p.split(',')[0]), y: Number(p.split(',')[1]) })) : []), [orePlaces]);
	const chestCount = tiles.stats.chests;

	useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext('2d');
		const glowCtx = glowRef.current?.getContext('2d');
		if (!canvas || !ctx) return;
		const paint = () => {
			lastPaint.current = performance.now();
			const markers = minimapMarkers(tiles, monsters, layout, ores);
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
	}, [tiles, monsters, ores, layout]);

	// The outline of the part of the map on screen follows every pan frame, so it is moved straight in the DOM (no React render per frame)
	useLayoutEffect(() => {
		const place = () => {
			const el = viewRef.current;
			if (!el) return;
			const { x, y, zoom, w, h } = view.getState();
			const tilePx = TILE_SIZE * zoom;
			const rect = viewRectangle(layout, { minX: -x / tilePx, maxX: (w - x) / tilePx, minY: -y / tilePx, maxY: (h - y) / tilePx });
			if (layout.scale > fitLayout.scale) {
				// zoomed in: when the middle of the screen leaves the zoomed part, it moves along
				const cx = (w / 2 - x) / tilePx;
				const cy = (h / 2 - y) / tilePx;
				const px = (cx - layout.x0) * layout.scale;
				const py = (cy - layout.y0) * layout.scale;
				if (px < 0 || py < 0 || px > layout.width || py > layout.height) setFocus({ x: cx, y: cy });
			}
			el.style.left = `${rect.left}px`;
			el.style.top = `${rect.top}px`;
			el.style.width = `${Math.max(2, rect.width)}px`;
			el.style.height = `${Math.max(2, rect.height)}px`;
		};
		place();
		return view.subscribe(place);
	}, [layout, fitLayout, view]);

	// A smaller window shrinks an overview that no longer fits
	useEffect(() => {
		const fitToWindow = () =>
			setBox((now) => {
				const next = clampMinimapBox(now, room());
				return next.w === now.w && next.h === now.h ? now : next;
			});
		window.addEventListener('resize', fitToWindow);
		return () => window.removeEventListener('resize', fitToWindow);
	}, []);

	const zoomBy = (dir: 1 | -1, toFit = false) => {
		const at = MINIMAP_ZOOMS.indexOf(zoom as (typeof MINIMAP_ZOOMS)[number]);
		const next = toFit ? 1 : MINIMAP_ZOOMS[Math.min(MINIMAP_ZOOMS.length - 1, Math.max(0, at + dir))];
		if (zoom === 1 && next > 1) {
			// zooming in from the whole map: on the part of the map that is on screen now
			const { x, y, zoom: z, w, h } = view.getState();
			const tilePx = TILE_SIZE * z;
			setFocus({ x: (w / 2 - x) / tilePx, y: (h / 2 - y) / tilePx });
		}
		setZoom(next);
	};

	const moveTo = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const box = canvasRef.current?.getBoundingClientRect();
			if (!box) return;
			const t = minimapToTile(layout, ((e.clientX - box.left) / box.width) * layout.width, ((e.clientY - box.top) / box.height) * layout.height);
			view.getState().centerOn(t.x * TILE_SIZE, t.y * TILE_SIZE);
		},
		[layout, view],
	);

	const summary = [
		monsters.length > 0 ? `${monsters.length} ${monsters.length === 1 ? 'enemy' : 'enemies'}` : '',
		chestCount > 0 ? `${chestCount} ${chestCount === 1 ? 'chest' : 'chests'}` : '',
		ores.length > 0 ? `${ores.length} ${ores.length === 1 ? 'ore' : 'ores'}` : '',
	].filter(Boolean);

	return (
		<div
			className='minimap ds-root ds-minimap'
			style={{ width: box.w, height: box.h }}
			title={`Map overview: click or drag to move the view, right-drag to pan when zoomed in${summary.length ? ` (${summary.join(', ')})` : ''}`}
			aria-label={`Map overview${summary.length ? `, ${summary.join(', ')}` : ''}`}
			onPointerDown={(e) => {
				if (e.button === 2 || e.button === 1) {
					// the right or middle button drags the zoomed part of the overview around (the screen stays where it is)
					panning.current = { x: e.clientX, y: e.clientY, fx: focus.x, fy: focus.y };
					e.currentTarget.setPointerCapture(e.pointerId);
					return;
				}
				if (e.button !== 0) return;
				dragging.current = true;
				e.currentTarget.setPointerCapture(e.pointerId);
				moveTo(e);
			}}
			onPointerMove={(e) => {
				const pan = panning.current;
				if (pan && zoom > 1) setFocus({ x: pan.fx - (e.clientX - pan.x) / layout.scale, y: pan.fy - (e.clientY - pan.y) / layout.scale });
				else if (dragging.current) moveTo(e);
			}}
			onPointerUp={() => {
				dragging.current = false;
				panning.current = null;
			}}
			onPointerCancel={() => {
				dragging.current = false;
				panning.current = null;
			}}
			onContextMenu={(e) => e.preventDefault()}
		>
			<canvas ref={canvasRef} width={layout.width} height={layout.height} className='minimap-canvas' />
			<canvas ref={glowRef} width={layout.width} height={layout.height} className='minimap-canvas minimap-glow' aria-hidden />
			<div ref={viewRef} className='minimap-view' />
			<div className='minimap-zoom' onPointerDown={(e) => e.stopPropagation()}>
				<button
					type='button'
					aria-label='Zoom the map overview in'
					data-glyph='plus'
					title='Zoom in'
					disabled={zoom >= MINIMAP_ZOOMS[MINIMAP_ZOOMS.length - 1]}
					onClick={() => zoomBy(1)}
				></button>
				<button
					type='button'
					aria-label='Zoom the map overview out'
					data-glyph='minus'
					title='Zoom out (Shift: fit the entire map)'
					disabled={zoom <= 1}
					onClick={(e) => zoomBy(-1, e.shiftKey)}
				></button>
			</div>
			{/* The grip: the overview hangs from the top right corner, so dragging its free bottom left corner out (left and down) makes it bigger, in (right and up) smaller */}
			<div
				className='minimap-grip'
				role='separator'
				aria-label='Resize the map overview'
				title='Drag to resize the map overview (double-click: back to the default size)'
				onPointerDown={(e) => {
					if (e.button !== 0) return;
					e.stopPropagation();
					resize.current = { x: e.clientX, y: e.clientY, w: box.w, h: box.h };
					e.currentTarget.setPointerCapture(e.pointerId);
				}}
				onPointerMove={(e) => {
					const start = resize.current;
					if (!start) return;
					e.stopPropagation();
					setBox(clampMinimapBox({ w: start.w + (start.x - e.clientX), h: start.h + (e.clientY - start.y) }, room()));
				}}
				onPointerUp={(e) => {
					e.stopPropagation();
					resize.current = null;
					writeJsonPref(SIZE_PREF, box);
				}}
				onPointerCancel={() => (resize.current = null)}
				onDoubleClick={() => {
					setBox(MINIMAP_BOX_DEFAULT);
					writeJsonPref(SIZE_PREF, MINIMAP_BOX_DEFAULT);
				}}
			/>
			<div className='ds-minimap-stats' aria-hidden>
				<span style={{ display: 'flex', gap: 8 }}>
					{monsters.length > 0 && (
						<span className='ds-bad' title='Enemies on the map'>
							<i className='minimap-dot' style={{ background: MONSTER_COLOR }} /> {monsters.length}
						</span>
					)}
					{ores.length > 0 && (
						<span style={{ color: ORE_COLOR }} title='Rocks and ores on the map'>
							<i className='minimap-dot' style={{ background: ORE_COLOR }} /> {ores.length}
						</span>
					)}
					{chestCount > 0 && (
						<span className='ds-gold-text' title='Chests on the map'>
							<i className='minimap-dot' style={{ background: CHEST_COLOR, boxShadow: `0 0 4px ${CHEST_COLOR}` }} /> {chestCount}
						</span>
					)}
				</span>
				<span className='ds-dim'>{tiles.stats.owned} tiles</span>
			</div>
		</div>
	);
};

/** The overview of the whole explored map (bottom right), switched on and off in the global menu. */
const Minimap: React.FC = () => {
	const show = useUiStore((state) => state.showMinimap);
	return show ? <MinimapBody /> : null;
};

export default Minimap;
