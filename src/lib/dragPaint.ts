import { COORD_LIMIT, inRange } from '@/utils/world';

/**
 * Press, hold and drag over the map to draw on it: the pure half. No React, no stores, no game rules, so the map lab uses
 * it now and the real game can use it later (roads, extending land). The React half is `Grid`, which hands the pointer's
 * tiles to a `DragHandler` and keeps the map from panning while a stroke is on.
 *
 * What a caller writes is one function: `createStroke(apply)`. `apply` gets the cells to draw each time the pointer reaches
 * new ones, so a road tool is "createStroke((cells) => build road on cells)".
 */

export interface Cell {
	x: number;
	y: number;
}

/** What the map calls while the main button is held. `Grid` converts the pointer to tiles. */
export interface DragHandler {
	begin: (x: number, y: number) => void;
	move: (x: number, y: number) => void;
	end: () => void;
}

/** A stroke never draws more than this many cells (a runaway drag cannot freeze the page). */
export const MAX_STROKE_CELLS = 5000;

/** The tile under a screen point, given the view (screen position of the world origin, zoom) and the tile size in px. */
export const pointerToTile = (clientX: number, clientY: number, view: { x: number; y: number; zoom: number }, tileSize: number): Cell => ({
	x: Math.floor((clientX - view.x) / (tileSize * view.zoom)),
	y: Math.floor((clientY - view.y) / (tileSize * view.zoom)),
});

/** Every cell on the straight line between two cells, both ends included (Bresenham), so a fast drag leaves no gaps. */
export const lineCells = (a: Cell, b: Cell): Cell[] => {
	const cells: Cell[] = [];
	let x = a.x;
	let y = a.y;
	const dx = Math.abs(b.x - a.x);
	const dy = -Math.abs(b.y - a.y);
	const sx = a.x < b.x ? 1 : -1;
	const sy = a.y < b.y ? 1 : -1;
	let err = dx + dy;
	// at most dx + |dy| + 1 steps; the cap only guards against absurd input
	for (let i = 0; i <= dx - dy && i < 4 * COORD_LIMIT; i++) {
		cells.push({ x, y });
		if (x === b.x && y === b.y) break;
		const e2 = 2 * err;
		if (e2 >= dy) {
			err += dy;
			x += sx;
		}
		if (e2 <= dx) {
			err += dx;
			y += sy;
		}
	}
	return cells;
};

/** The square brush around a cell: size 1 is the cell, 3 is 3x3, and so on (even sizes lean to the top left). */
export const brushCells = (c: Cell, size: number): Cell[] => {
	const n = Math.max(1, Math.floor(size));
	const lo = -Math.floor((n - 1) / 2);
	const out: Cell[] = [];
	for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) out.push({ x: c.x + lo + dx, y: c.y + lo + dy });
	return out;
};

export interface StrokeOptions {
	/** Brush size in tiles (default 1) */
	brush?: number;
	/** Called after the last batch when the stroke ends */
	onEnd?: () => void;
}

export interface Stroke extends DragHandler {
	/** Whether the button is held */
	active: () => boolean;
}

/**
 * One drag as a state machine. `apply` is called with the cells not yet drawn in this stroke (each cell at most once per
 * stroke, in drag order, inside the map limits). The first batch comes on `begin`, so a plain click draws too.
 */
export const createStroke = (apply: (cells: Cell[]) => void, options: StrokeOptions = {}): Stroke => {
	let last: Cell | null = null;
	let drawn = new Set<number>();
	const key = (c: Cell) => (c.y + COORD_LIMIT) * (2 * COORD_LIMIT + 1) + (c.x + COORD_LIMIT);

	const emit = (centers: Cell[]) => {
		const fresh: Cell[] = [];
		for (const center of centers) {
			for (const c of brushCells(center, options.brush ?? 1)) {
				if (!inRange(c.x, c.y) || drawn.size + fresh.length >= MAX_STROKE_CELLS) continue;
				const k = key(c);
				if (drawn.has(k)) continue;
				drawn.add(k);
				fresh.push(c);
			}
		}
		if (fresh.length) apply(fresh);
	};

	return {
		active: () => last !== null,
		begin: (x, y) => {
			drawn = new Set();
			last = { x, y };
			emit([last]);
		},
		move: (x, y) => {
			if (!last || (last.x === x && last.y === y)) return;
			const to = { x, y };
			emit(lineCells(last, to).slice(1));
			last = to;
		},
		end: () => {
			if (!last) return;
			last = null;
			drawn = new Set();
			options.onEnd?.();
		},
	};
};
