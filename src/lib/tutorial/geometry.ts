// The focus layer's maths, pure: a dim over the whole screen with transparent cut-outs around the target element(s). The layer is one full-screen
// element clipped with an even-odd `clip-path`, so the holes are really holes (clicks reach what is under them) and the rest catches every click in
// strict mode. Measured from the elements' bounding rectangles; a target that is not on screen yields no hole and the layer is not drawn.

export interface Rect {
	left: number;
	top: number;
	width: number;
	height: number;
}

export interface Viewport {
	width: number;
	height: number;
}

/** Room around the target, in px */
export const CUTOUT_PAD = 6;
/** More matching elements than this are ignored (a field of buyable tiles): the nearest ones are enough */
export const MAX_HOLES = 24;

/** The rectangle grown by `pad` on every side. */
export const padRect = (r: Rect, pad = CUTOUT_PAD): Rect => ({ left: r.left - pad, top: r.top - pad, width: r.width + 2 * pad, height: r.height + 2 * pad });

/** The part of `r` that lies inside the viewport, or null when none of it does (or it has no area). */
export const clipToViewport = (r: Rect, view: Viewport): Rect | null => {
	const left = Math.max(0, r.left);
	const top = Math.max(0, r.top);
	const right = Math.min(view.width, r.left + r.width);
	const bottom = Math.min(view.height, r.top + r.height);
	return right - left >= 1 && bottom - top >= 1 ? { left, top, width: right - left, height: bottom - top } : null;
};

/** The holes for the measured rectangles: padded, clipped to the screen, empty ones dropped. At most {@link MAX_HOLES}. */
export const holesFor = (rects: readonly Rect[], view: Viewport, pad = CUTOUT_PAD): Rect[] => {
	const holes: Rect[] = [];
	for (const r of rects) {
		if (!(r.width > 0 && r.height > 0)) continue;
		const clipped = clipToViewport(padRect(r, pad), view);
		if (clipped) holes.push(clipped);
		if (holes.length >= MAX_HOLES) break;
	}
	return holes;
};

const px = (n: number) => `${Math.round(n * 10) / 10}`;

/** `clip-path: path(evenodd, ...)`: the whole screen minus the holes. With no hole it is the whole screen. */
export const clipPathFor = (holes: readonly Rect[], view: Viewport): string => {
	const outer = `M0 0H${px(view.width)}V${px(view.height)}H0Z`;
	const inner = holes.map((h) => `M${px(h.left)} ${px(h.top)}h${px(h.width)}v${px(h.height)}h${px(-h.width)}Z`).join('');
	return `path(evenodd, '${outer}${inner}')`;
};

/** True when two lists of rectangles are the same to the pixel (the measuring loop only updates the state when something moved). */
export const sameRects = (a: readonly Rect[], b: readonly Rect[]): boolean =>
	a.length === b.length &&
	a.every(
		(r, i) =>
			Math.round(r.left) === Math.round(b[i].left) &&
			Math.round(r.top) === Math.round(b[i].top) &&
			Math.round(r.width) === Math.round(b[i].width) &&
			Math.round(r.height) === Math.round(b[i].height),
	);

/** The CSS selector of a target id. */
export const selectorFor = (id: string): string => `[data-tutorial="${id.replace(/[^A-Za-z0-9_-]/g, '')}"]`;

/** Whether the point (x, y) lies inside any hole: what strict mode lets through. */
export const pointInHoles = (x: number, y: number, holes: readonly Rect[]): boolean =>
	holes.some((h) => x >= h.left && x < h.left + h.width && y >= h.top && y < h.top + h.height);
