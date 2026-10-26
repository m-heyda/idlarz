import { ATLAS, CELL, CHUNK_TILES, cellLayers, chunkPads, chunkSprites, worldGround } from '@/utils/terrain';
import { BIOME_COLORS, MIST_COLOR, YARD_COLOR } from '@/config/biomePalette';
import type { World } from '@/utils/world';

/**
 * Draws the map terrain one chunk at a time (CHUNK_TILES x CHUNK_TILES tiles per canvas; 1 canvas px = 1 art px = 1 world
 * px, scaled by the world div's CSS transform, so pan and zoom never redraw). Per dual cell and layer: fill with the
 * style's seamless texture (the pattern is anchored at the world origin, so cells and chunks never show seams), cut it
 * with the shape's body mask, then lay the rim (bank, cliff face, foam...) over it. Sprites (trees, rocks, docks) are
 * drawn last, bottom edge first; a chunk also draws the sprites of the tiles around it that reach into it, so nothing is
 * cut at a chunk border.
 */
export interface TerrainAssets {
	tex: Record<string, HTMLImageElement>;
	shapes: Record<string, HTMLImageElement>;
	/** rim sheets of the tinted lake shores ('lake_frost', 'lake_bog'): column = corner bits, row = mask * 2 + variant */
	shores: Record<string, HTMLImageElement>;
	props: HTMLImageElement;
}

/** The tinted lake shores are lake cells (lake texture and body) with a rim of their own; their variant is the lake variant + 2 x the corner bits. */
const SHORES = ['lake_frost', 'lake_bog'];

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
			const shores: Record<string, HTMLImageElement> = {};
			const [props] = await Promise.all([
				loadImage(`${BASE}/props.png`),
				...SHORES.map(async (s) => {
					shores[s] = await loadImage(`${BASE}/shore_${s.slice(5)}.png`);
				}),
				...ATLAS.styles.map(async (s) => {
					tex[s] = await loadImage(`${BASE}/tex_${s}.png`);
					shapes[s] = await loadImage(`${BASE}/shapes_${s}.png`);
				}),
			]);
			return { tex, shapes, shores, props };
		})().catch((e) => {
			assetsPromise = null; // allow a retry on the next draw
			throw e;
		});
	}
	return assetsPromise;
}

/** Flat colours shown until the atlas has loaded (or if it fails), so the map is never blank. */
const FALLBACK: Record<string, string> = { ...BIOME_COLORS, mist: MIST_COLOR, yard: YARD_COLOR };

/** Side of the part of the map a chunk owns, in px. */
export const CHUNK_PX = CHUNK_TILES * CELL;
/**
 * A chunk canvas is a little larger than its part and continues into its right and lower neighbours (which draw the same
 * pixels there). Zoomed to a fraction the canvas edges fall between screen pixels, and without the overlap a hairline of
 * background would show along every chunk border.
 */
export const CHUNK_OVERLAP_PX = 2;
export const CHUNK_CANVAS_PX = CHUNK_PX + CHUNK_OVERLAP_PX;

const prepare = (canvas: HTMLCanvasElement, cx: number, cy: number): CanvasRenderingContext2D | null => {
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.globalCompositeOperation = 'source-over';
	ctx.imageSmoothingEnabled = false;
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	// from here on everything is drawn in world pixels
	ctx.setTransform(1, 0, 0, 1, -cx * CHUNK_PX, -cy * CHUNK_PX);
	return ctx;
};

/** The chunk as flat colours: shown until the atlas has loaded and as a cheap first picture. */
export function drawChunkFlat(canvas: HTMLCanvasElement, world: World, cx: number, cy: number): void {
	const ctx = prepare(canvas, cx, cy);
	if (!ctx) return;
	const g = worldGround(world);
	for (let y = cy * CHUNK_TILES; y <= (cy + 1) * CHUNK_TILES; y++) {
		for (let x = cx * CHUNK_TILES; x <= (cx + 1) * CHUNK_TILES; x++) {
			const gr = g(x, y);
			if (!gr) continue;
			ctx.fillStyle = FALLBACK[gr] ?? '#000';
			ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
		}
	}
}

let scratch: HTMLCanvasElement | null = null;

/** The ground textures as canvas patterns, made once per atlas: a pattern belongs to no context, so every chunk can fill with it. */
const patternCache = new WeakMap<TerrainAssets, Record<string, CanvasPattern>>();
const patternsOf = (assets: TerrainAssets, ctx: CanvasRenderingContext2D): Record<string, CanvasPattern> => {
	let patterns = patternCache.get(assets);
	if (!patterns) {
		patterns = {};
		for (const [style, img] of Object.entries(assets.tex)) {
			const p = ctx.createPattern(img, 'repeat');
			if (p) patterns[style] = p;
		}
		patternCache.set(assets, patterns);
	}
	return patterns;
};

/** The full picture of one chunk. Dual cells on the chunk's border are drawn by both chunks (each keeps its own half). */
export function drawChunk(canvas: HTMLCanvasElement, assets: TerrainAssets, world: World, cx: number, cy: number): void {
	const ctx = prepare(canvas, cx, cy);
	if (!ctx) return;
	const g = worldGround(world);

	const patterns = patternsOf(assets, ctx);
	if (!scratch) {
		scratch = document.createElement('canvas');
		scratch.width = CELL;
		scratch.height = CELL;
	}
	const sctx = scratch.getContext('2d');
	if (!sctx) return;
	sctx.imageSmoothingEnabled = false;

	const x0 = cx * CHUNK_TILES;
	const y0 = cy * CHUNK_TILES;
	for (let dy = y0; dy <= y0 + CHUNK_TILES; dy++) {
		for (let dx = x0; dx <= x0 + CHUNK_TILES; dx++) {
			const ox = dx * CELL - CELL / 2;
			const oy = dy * CELL - CELL / 2;
			for (const layer of cellLayers(g, dx, dy)) {
				const { mask } = layer;
				const tinted = SHORES.includes(layer.style); // a lake shore beside tundra or a swamp
				const style = tinted ? 'lake' : layer.style;
				const variant = tinted ? layer.variant & 1 : layer.variant;
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
				if (tinted) ctx.drawImage(assets.shores[layer.style], (layer.variant >> 1) * CELL, (mask * 2 + variant) * CELL, CELL, CELL, ox, oy, CELL, CELL);
				else ctx.drawImage(shape, mask * CELL, (variant * 2 + 1) * CELL, CELL, CELL, ox, oy, CELL, CELL);
			}
		}
	}

	for (const s of [...chunkPads(world, cx, cy), ...chunkSprites(world, cx, cy)]) {      // foundation pads first, then sprites bottom edge first
		const [sx, sy, sw, sh] = ATLAS.sprites[s.id];
		ctx.drawImage(assets.props, sx, sy, sw, sh, s.x, s.bottom - sh, sw, sh);
	}
}

// ---- spreading the work over frames ---------------------------------------------------------------------------------

/** Time a frame may spend on chunk drawing before the rest waits for the next frame (at least one chunk is always drawn) */
const FRAME_BUDGET_MS = 6;
const queue: (() => void)[] = [];
let frame = 0;

const runJobs = () => {
	frame = 0;
	const started = performance.now();
	do {
		queue.shift()?.();
	} while (queue.length > 0 && performance.now() - started < FRAME_BUDGET_MS);
	if (queue.length > 0) frame = requestAnimationFrame(runJobs);
};

/** Runs `job` on a later frame, as many per frame as fit in FRAME_BUDGET_MS, in order. Returns a function that cancels it. */
export function scheduleDraw(job: () => void): () => void {
	queue.push(job);
	if (!frame) frame = requestAnimationFrame(runJobs);
	return () => {
		const i = queue.indexOf(job);
		if (i >= 0) queue.splice(i, 1);
	};
}
