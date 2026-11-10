import React, { useEffect, useState } from 'react';
import '@/styles/Tutorial.css';
import type { FocusMode } from '@/catalog/tutorial';
import { clipPathFor, holesFor, sameRects, selectorFor, type Rect, type Viewport } from '@/lib/tutorial/geometry';

/** Measures every element that carries `data-tutorial="<target>"` on every animation frame; the state changes only when something moved. Empty when the target is not on screen. */
export const useTargetRects = (target: string | undefined): Rect[] => {
	const [rects, setRects] = useState<Rect[]>([]);
	useEffect(() => {
		if (!target || typeof document === 'undefined') {
			setRects([]);
			return;
		}
		let frame = 0;
		let last: Rect[] = [];
		const selector = selectorFor(target);
		const measure = () => {
			const view: Viewport = { width: window.innerWidth, height: window.innerHeight };
			const found = Array.from(document.querySelectorAll(selector)).map((el) => {
				const b = el.getBoundingClientRect();
				return { left: b.left, top: b.top, width: b.width, height: b.height };
			});
			const holes = holesFor(found, view);
			if (!sameRects(holes, last)) {
				last = holes;
				setRects(holes);
			}
			frame = requestAnimationFrame(measure);
		};
		measure();
		return () => cancelAnimationFrame(frame);
	}, [target]);
	return rects;
};

export interface FocusLayerProps {
	/** Transparent cut-outs, already padded and clipped to the screen (`holesFor`). None: the layer is not drawn and the game is never blocked. */
	holes: readonly Rect[];
	mode: FocusMode;
	view: Viewport;
	/** The intro dims the whole screen without a hole */
	intro?: boolean;
}

/**
 * The dim and blur over the whole game with a transparent cut-out around the target and a pulsing ring. `strict` catches every click outside the cut-out
 * (only the target is clickable); `soft` only dims. With no target on screen it draws nothing, so a missing element can never lock the game; the intro
 * is the one dim without a cut-out.
 */
const FocusLayer: React.FC<FocusLayerProps> = ({ holes, mode, view, intro = false }) => {
	if (!intro && holes.length === 0) return null;
	return (
		<>
			<div className='guide-focus' data-mode={intro ? 'strict' : mode} data-intro={intro} style={{ clipPath: clipPathFor(holes, view) }} aria-hidden />
			{holes.map((h, i) => (
				<div key={i} className='guide-ring' style={{ left: h.left, top: h.top, width: h.width, height: h.height }} aria-hidden />
			))}
		</>
	);
};

export default FocusLayer;
