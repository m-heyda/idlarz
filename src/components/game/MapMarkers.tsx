import React, { useEffect, useRef } from 'react';
import { TILE_SIZE } from '@/config/biomes';
import { useRockStore } from '@/stores/rockStore';
import { useUiStore } from '@/stores/uiStore';
import { ownedRowMajor, type World } from '@/utils/world';
import { useMapSource, useMapView } from './mapSource';

// The map markers (IDL-376): the three buttons under the map (Chests, Ores, Monsters) turn on a soft pulsing ring around every one of that kind on screen and, for the nearest one that is off screen, a small arrow on the edge of the map that points the way.
// One screen-space canvas, drawn from the view store like HighlightLayer: only what is on screen is looked at, and nothing runs while all three are off. Quiet on purpose: thin rings, low alpha, a slow pulse.

type Kind = 'chests' | 'ores' | 'monsters';
const COLOURS: Record<Kind, string> = { chests: '#f0d27a', ores: '#8fd3ff', monsters: '#ff8f7d' };
const PULSE_MS = 1700;
/** The edge arrow keeps this far from the borders of the screen (the dock is below, the header above) */
const SIDE_INSET = 28;
const DOCK_INSET = 120;

const chestTiles = (world: World): { x: number; y: number }[] => {
	const spots: { x: number; y: number }[] = [];
	if (world.stats.chests > 0) for (const { x, y, tile } of ownedRowMajor(world)) if (tile.hasChest) spots.push({ x, y });
	return spots;
};

const MapMarkers: React.FC = () => {
	const viewStore = useMapView();
	const { game } = useMapSource();
	const chests = useUiStore((state) => state.markChests);
	const ores = useUiStore((state) => state.markOres);
	const monsters = useUiStore((state) => state.markMonsters);
	const w = viewStore((state) => state.w);
	const h = viewStore((state) => state.h);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext('2d');
		if (!canvas || !ctx) return;
		const clear = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
		if (!chests && !ores && !monsters) {
			clear();
			return;
		}
		const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
		let raf = 0;
		let cachedTiles: World | null = null;
		let cachedChests: { x: number; y: number }[] = [];
		const draw = (now: number) => {
			const view = viewStore.getState();
			const state = game.getState();
			const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin((now / PULSE_MS) * Math.PI * 2);
			const px = TILE_SIZE * view.zoom;
			const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 56;
			clear();

			const lists: [Kind, boolean, () => { x: number; y: number }[]][] = [
				[
					'chests',
					chests,
					() => {
						if (state.tiles !== cachedTiles) {
							cachedTiles = state.tiles;
							cachedChests = chestTiles(state.tiles);
						}
						return cachedChests;
					},
				],
				['ores', ores, () => Object.values(useRockStore.getState().rocks)],
				['monsters', monsters, () => state.monsters],
			];
			for (const [kind, on, list] of lists) {
				if (!on) continue;
				const colour = COLOURS[kind];
				let nearest: { sx: number; sy: number; d: number } | null = null;
				for (const { x, y } of list()) {
					const sx = view.x + (x + 0.5) * px;
					const sy = view.y + (y + 0.5) * px;
					const onScreen = sx > -px && sx < view.w + px && sy > -px && sy < view.h + px;
					if (onScreen) {
						ctx.globalAlpha = 0.28 + 0.3 * pulse;
						ctx.strokeStyle = colour;
						ctx.lineWidth = 2;
						ctx.beginPath();
						ctx.arc(sx, sy, px * 0.62 + pulse * 3, 0, Math.PI * 2);
						ctx.stroke();
						ctx.globalAlpha = 0.07 + 0.05 * pulse;
						ctx.fillStyle = colour;
						ctx.fill();
					} else {
						const d = Math.hypot(sx - view.w / 2, sy - view.h / 2);
						if (!nearest || d < nearest.d) nearest = { sx, sy, d };
					}
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
					const ax = cx + dx * k;
					const ay = cy + dy * k;
					ctx.save();
					ctx.translate(ax, ay);
					ctx.rotate(Math.atan2(dy, dx));
					ctx.globalAlpha = 0.55 + 0.25 * pulse;
					ctx.fillStyle = colour;
					ctx.strokeStyle = 'rgba(0,0,0,0.55)';
					ctx.lineWidth = 1.5;
					ctx.beginPath();
					ctx.moveTo(10, 0);
					ctx.lineTo(-6, -7);
					ctx.lineTo(-2, 0);
					ctx.lineTo(-6, 7);
					ctx.closePath();
					ctx.stroke();
					ctx.fill();
					ctx.restore();
				}
			}
			ctx.globalAlpha = 1;
			raf = requestAnimationFrame(draw);
		};
		raf = requestAnimationFrame(draw);
		return () => {
			cancelAnimationFrame(raf);
			clear();
		};
	}, [chests, ores, monsters, viewStore, game]);

	return <canvas ref={canvasRef} className='map-markers-layer' width={w} height={h} aria-hidden />;
};

export default MapMarkers;
