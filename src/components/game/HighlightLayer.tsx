import React, { useEffect, useRef } from 'react';
import { TILE_SIZE } from '@/config/gameConfig';
import { highlightColor } from '@/config/biomePalette';
import { visibleTileRange } from '@/lib/mapView';
import { useUiStore, HIGHLIGHT_MS } from '@/stores/uiStore';
import { useViewStore } from '@/stores/viewStore';
import { tileKey } from '@/utils/world';

const FADE_IN_MS = 150;
const FADE_OUT_MS = 500;
const PULSE_MS = 1100;

/**
 * The "Highlight" tint: the tiles of the area chosen in the tile menu get a translucent colour of their biome for a few
 * seconds (a soft pulse, no border). One canvas the size of the screen, drawn in screen space from the view store, so it
 * costs the same for a 20-tile area as for a 20,000-tile one: only the tiles on screen are looked at.
 */
const HighlightLayer: React.FC = () => {
	const highlight = useUiStore((state) => state.highlight);
	const w = useViewStore((state) => state.w);
	const h = useViewStore((state) => state.h);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext('2d');
		if (!canvas || !ctx) return;
		const clear = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
		if (!highlight) {
			clear();
			return;
		}
		const color = highlightColor(highlight.biome);
		const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
		const started = performance.now();
		let raf = 0;
		const draw = (now: number) => {
			const elapsed = now - started;
			if (elapsed >= HIGHLIGHT_MS) {
				clear();
				return;
			}
			const fade = Math.min(1, elapsed / FADE_IN_MS, (HIGHLIGHT_MS - elapsed) / FADE_OUT_MS);
			const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin((elapsed / PULSE_MS) * Math.PI * 2);
			const alpha = (0.34 + 0.2 * pulse) * fade;

			const view = useViewStore.getState();
			const size = { w: view.w, h: view.h };
			const range = visibleTileRange({ x: view.x, y: view.y }, view.zoom, size, 1);
			const tilePx = TILE_SIZE * view.zoom;
			clear();
			ctx.globalAlpha = alpha;
			ctx.fillStyle = color;
			for (let ty = range.minY; ty < range.maxY; ty++) {
				for (let tx = range.minX; tx < range.maxX; tx++) {
					if (!highlight.cells.has(tileKey(tx, ty))) continue;
					const sx = Math.floor(view.x + tx * tilePx);
					const sy = Math.floor(view.y + ty * tilePx);
					// +1 px: neighbours overlap a little, so the area has no seams
					ctx.fillRect(sx, sy, Math.ceil(tilePx) + 1, Math.ceil(tilePx) + 1);
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
	}, [highlight]);

	return <canvas ref={canvasRef} className='highlight-layer' width={w} height={h} aria-hidden />;
};

export default HighlightLayer;
