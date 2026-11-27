import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TILE_SIZE } from '@/config/biomes';
import {
	CHEST_COLOR,
	MINIMAP_BOX_DEFAULT,
	MONSTER_COLOR,
	ORE_COLOR,
	clampMinimapBox,
	minimapLayout,
	minimapMarkers,
	minimapToTile,
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

/** One press of + or - (css px) */
const BOX_STEP = { w: 48, h: 36 };

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

	const layout = useMemo(() => minimapLayout(tiles.bounds, box), [tiles.bounds, box]);
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
			el.style.left = `${rect.left}px`;
			el.style.top = `${rect.top}px`;
			el.style.width = `${Math.max(2, rect.width)}px`;
			el.style.height = `${Math.max(2, rect.height)}px`;
		};
		place();
		return view.subscribe(place);
	}, [layout, view]);

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

	const step = (dir: 1 | -1) => {
		const next = clampMinimapBox({ w: box.w + dir * BOX_STEP.w, h: box.h + dir * BOX_STEP.h }, room());
		setBox(next);
		writeJsonPref(SIZE_PREF, next);
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
			onPointerCancel={() => (dragging.current = false)}
		>
			<canvas ref={canvasRef} width={layout.width} height={layout.height} className='minimap-canvas' />
			<canvas ref={glowRef} width={layout.width} height={layout.height} className='minimap-canvas minimap-glow' aria-hidden />
			<div ref={viewRef} className='minimap-view' />
			<div className='minimap-zoom' onPointerDown={(e) => e.stopPropagation()}>
				<button
					type='button'
					aria-label='Make the map overview bigger'
					title='Bigger'
					disabled={box.w >= clampMinimapBox({ w: 1e5, h: 1e5 }, room()).w && box.h >= clampMinimapBox({ w: 1e5, h: 1e5 }, room()).h}
					onClick={() => step(1)}
				>
					+
				</button>
				<button
					type='button'
					aria-label='Make the map overview smaller'
					title='Smaller'
					disabled={box.w <= MINIMAP_BOX_DEFAULT.w && box.h <= MINIMAP_BOX_DEFAULT.h}
					onClick={() => step(-1)}
				>
					-
				</button>
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
