import React, { useEffect, useMemo, useRef } from 'react';
import { TILE_SIZE } from '@/config/biomes';
import { useRockStore } from '@/stores/rockStore';
import { useUiStore } from '@/stores/uiStore';
import { ownedRowMajor, type World } from '@/utils/world';
import { useMapGame, useMapSource, useMapView } from './mapSource';
import '@/styles/MapMarkers.css';

// The map markers (IDL-376): the buttons under the minimap (Chests, Ores, Monsters; one at a time) mark every one of that kind on the map. Two parts:
//  - `MapMarkerRings`: a soft pulsing ring on the tile of each one, inside the map's world, so it is exactly centred on its tile at every zoom and pan and lies under the tooltips (they are drawn in a layer above it);
//  - `MapMarkers` (default): for the nearest one that is out of view, a small arrow on the edge of the screen that points the way (a canvas, drawn from the view store).
// Nothing runs while all three are off.

export type MarkKind = 'chests' | 'ores' | 'monsters';
export const MARK_COLOURS: Record<MarkKind, string> = { chests: '#f6d77a', ores: '#b98cff', monsters: '#ff8f7d' };
const PULSE_MS = 1700;
/** The edge arrow keeps this far from the borders of the screen (the header is above, the dock below) */
const SIDE_INSET = 28;
const DOCK_INSET = 120;

const chestTiles = (world: World): { x: number; y: number }[] => {
	const spots: { x: number; y: number }[] = [];
	if (world.stats.chests > 0) for (const { x, y, tile } of ownedRowMajor(world)) if (tile.hasChest) spots.push({ x, y });
	return spots;
};

/** The kind that is switched on (at most one: the buttons are a choice), or null. */
export const markedKind = (marks: { markChests: boolean; markOres: boolean; markMonsters: boolean }): MarkKind | null =>
	marks.markChests ? 'chests' : marks.markOres ? 'ores' : marks.markMonsters ? 'monsters' : null;

/** The tiles of the marked kind. Chests are read off the map when it changes, monsters by their places (the list itself is a new array every tick), ores from the rock store. */
const useMarked = (kind: MarkKind | null): { x: number; y: number }[] => {
	const game = useMapGame();
	const tiles = game((state) => (kind === 'chests' ? state.tiles : null));
	const monsterPlaces = game((state) => (kind === 'monsters' ? state.monsters.map((m) => `${m.x},${m.y}`).join(';') : ''));
	const rocks = useRockStore((state) => (kind === 'ores' ? state.rocks : null));
	return useMemo(() => {
		if (kind === 'chests' && tiles) return chestTiles(tiles);
		if (kind === 'monsters') return monsterPlaces ? monsterPlaces.split(';').map((p) => ({ x: Number(p.split(',')[0]), y: Number(p.split(',')[1]) })) : [];
		if (kind === 'ores' && rocks) return Object.values(rocks).map(({ x, y }) => ({ x, y }));
		return [];
	}, [kind, tiles, monsterPlaces, rocks]);
};

const useKind = (): MarkKind | null => {
	const markChests = useUiStore((state) => state.markChests);
	const markOres = useUiStore((state) => state.markOres);
	const markMonsters = useUiStore((state) => state.markMonsters);
	return markedKind({ markChests, markOres, markMonsters });
};

/** The rings, in world pixels: mounted inside the map's world, before the tooltip layer. */
export const MapMarkerRings: React.FC = () => {
	const kind = useKind();
	const marked = useMarked(kind);
	if (!kind) return null;
	return (
		<>
			{marked.slice(0, 300).map(({ x, y }) => (
				<span
					key={`${x},${y}`}
					className='map-mark'
					data-kind={kind}
					style={{ left: x * TILE_SIZE, top: y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}
					aria-hidden
				>
					<i className='map-mark-ring' />
				</span>
			))}
		</>
	);
};

/** The edge arrow to the nearest marked thing that is out of view. */
const MapMarkers: React.FC = () => {
	const viewStore = useMapView();
	const { game } = useMapSource();
	const kind = useKind();
	const marked = useMarked(kind);
	const w = viewStore((state) => state.w);
	const h = viewStore((state) => state.h);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const markedRef = useRef(marked);
	markedRef.current = marked;

	useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext('2d');
		if (!canvas || !ctx) return;
		const clear = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
		if (!kind) {
			clear();
			return;
		}
		const colour = MARK_COLOURS[kind];
		const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
		let raf = 0;
		const draw = (now: number) => {
			const view = viewStore.getState();
			const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin((now / PULSE_MS) * Math.PI * 2);
			const px = TILE_SIZE * view.zoom;
			const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 56;
			clear();
			let nearest: { sx: number; sy: number; d: number } | null = null;
			for (const { x, y } of markedRef.current) {
				const sx = view.x + (x + 0.5) * px;
				const sy = view.y + (y + 0.5) * px;
				if (sx > -px && sx < view.w + px && sy > header - px && sy < view.h + px) continue; // on screen: its ring is enough
				const d = Math.hypot(sx - view.w / 2, sy - view.h / 2);
				if (!nearest || d < nearest.d) nearest = { sx, sy, d };
			}
			if (nearest) {
				// the arrow sits on the line from the middle of the screen to the target, clamped inside the margins
				const cx = view.w / 2;
				const cy = view.h / 2;
				const dx = nearest.sx - cx;
				const dy = nearest.sy - cy;
				const halfW = Math.max(1, cx - SIDE_INSET);
				const top = header + SIDE_INSET;
				const bottom = view.h - DOCK_INSET;
				const halfH = Math.max(1, Math.min(cy - top, bottom - cy));
				const k = Math.min(halfW / Math.max(1e-6, Math.abs(dx)), halfH / Math.max(1e-6, Math.abs(dy)));
				ctx.save();
				ctx.translate(cx + dx * k, cy + dy * k);
				ctx.rotate(Math.atan2(dy, dx));
				ctx.globalAlpha = 0.7 + 0.25 * pulse;
				ctx.fillStyle = colour;
				ctx.strokeStyle = 'rgba(0,0,0,0.65)';
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(12, 0);
				ctx.lineTo(-7, -8.5);
				ctx.lineTo(-2.5, 0);
				ctx.lineTo(-7, 8.5);
				ctx.closePath();
				ctx.stroke();
				ctx.fill();
				ctx.restore();
			}
			raf = requestAnimationFrame(draw);
		};
		raf = requestAnimationFrame(draw);
		return () => {
			cancelAnimationFrame(raf);
			clear();
		};
	}, [kind, viewStore, game]);

	return <canvas ref={canvasRef} className='map-markers-layer' width={w} height={h} aria-hidden />;
};

export default MapMarkers;
