import { ATLAS, CELL, allSprites, cellLayers, type GroundGrid, type Placed } from '@/utils/terrain';

/**
 * Draws the whole map terrain onto one canvas (1 canvas px = 1 art px = 1 world px, scaled by the world div's CSS
 * transform, so pan and zoom never redraw). Per dual cell and layer: fill with the style's seamless texture (the
 * pattern is anchored at the world origin, so cells never show seams), cut it with the shape's body mask, then lay
 * the rim (bank, cliff face, foam...) over it. Sprites (trees, rocks, docks) are drawn last, bottom edge first.
 */
export interface TerrainAssets {
	tex: Record<string, HTMLImageElement>;
	shapes: Record<string, HTMLImageElement>;
	props: HTMLImageElement;
}

const BASE = '/pixel/terrain';

const loadImage = (src: string) =>
	new Promise<HTMLImageElement>((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(`failed to load ${src}`));
		img.src = src;
	});

let assetsPromise: Promise<TerrainAssets> | null = null;

export function loadTerrainAssets(): Promise<TerrainAssets> {
	if (!assetsPromise) {
		assetsPromise = (async () => {
			const tex: Record<string, HTMLImageElement> = {};
			const shapes: Record<string, HTMLImageElement> = {};
			const [props] = await Promise.all([
				loadImage(`${BASE}/props.png`),
				...ATLAS.styles.map(async (s) => {
					tex[s] = await loadImage(`${BASE}/tex_${s}.png`);
					shapes[s] = await loadImage(`${BASE}/shapes_${s}.png`);
				}),
			]);
			return { tex, shapes, props };
		})().catch((e) => {
			assetsPromise = null; // allow a retry on the next draw
			throw e;
		});
	}
	return assetsPromise;
}

/** Flat colours shown until the atlas has loaded (or if it fails), so the map is never blank. */
const FALLBACK: Record<string, string> = {
	mist: '#112248', coast: '#dcc791', plains: '#65a540', swamp: '#6c6b33', tundra: '#e3edf7', grounds: '#72502c',
	forest: '#317433', hills: '#709046', lake: '#35a6d8', yard: '#928068', castle: '#6045a0',
};

export function drawTerrain(canvas: HTMLCanvasElement, assets: TerrainAssets | null, g: GroundGrid, pads: Placed[] = [], built?: Set<string>): void {
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.globalCompositeOperation = 'source-over';
	ctx.imageSmoothingEnabled = false;
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	if (g.length === 0) return;

	if (!assets) {
		g.forEach((row, y) =>
			row.forEach((gr, x) => {
				if (!gr) return;
				ctx.fillStyle = FALLBACK[gr] ?? '#000';
				ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
			})
		);
		return;
	}

	const patterns: Record<string, CanvasPattern> = {};
	for (const [style, img] of Object.entries(assets.tex)) {
		const p = ctx.createPattern(img, 'repeat');
		if (p) patterns[style] = p;
	}
	const scratch = document.createElement('canvas');
	scratch.width = CELL;
	scratch.height = CELL;
	const sctx = scratch.getContext('2d');
	if (!sctx) return;
	sctx.imageSmoothingEnabled = false;

	// only the part of the map that has any terrain (the rest of the 2400 px canvas stays transparent)
	let minX = g[0].length, maxX = -1, minY = g.length, maxY = -1;
	g.forEach((row, y) =>
		row.forEach((gr, x) => {
			if (!gr) return;
			minX = Math.min(minX, x);
			maxX = Math.max(maxX, x);
			minY = Math.min(minY, y);
			maxY = Math.max(maxY, y);
		})
	);
	for (let cy = minY; cy <= maxY + 1; cy++) {
		for (let cx = minX; cx <= maxX + 1; cx++) {
			const ox = cx * CELL - CELL / 2;
			const oy = cy * CELL - CELL / 2;
			for (const { style, mask, variant } of cellLayers(g, cx, cy)) {
				const pattern = patterns[style];
				const shape = assets.shapes[style];
				if (!pattern || !shape) continue;
				if (mask === 15) {
					ctx.fillStyle = pattern;
					ctx.fillRect(ox, oy, CELL, CELL);
					continue;
				}
				sctx.globalCompositeOperation = 'source-over';
				sctx.setTransform(1, 0, 0, 1, 0, 0);
				sctx.clearRect(0, 0, CELL, CELL);
				sctx.setTransform(1, 0, 0, 1, -ox, -oy); // pattern phase = world origin
				sctx.fillStyle = pattern;
				sctx.fillRect(ox, oy, CELL, CELL);
				sctx.setTransform(1, 0, 0, 1, 0, 0);
				sctx.globalCompositeOperation = 'destination-in';
				sctx.drawImage(shape, mask * CELL, variant * 2 * CELL, CELL, CELL, 0, 0, CELL, CELL);
				ctx.drawImage(scratch, ox, oy);
				ctx.drawImage(shape, mask * CELL, (variant * 2 + 1) * CELL, CELL, CELL, ox, oy, CELL, CELL);
			}
		}
	}

	for (const s of [...pads, ...allSprites(g, undefined, built)]) {                   // foundation pads first, then sprites bottom edge first
		const [sx, sy, sw, sh] = ATLAS.sprites[s.id];
		ctx.drawImage(assets.props, sx, sy, sw, sh, s.x, s.bottom - sh, sw, sh);
	}
}
