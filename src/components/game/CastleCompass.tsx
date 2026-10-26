import React, { useLayoutEffect, useRef } from 'react';
import { compassArrow, type Insets } from '@/lib/castleFinder';
import { useViewStore } from '@/stores/viewStore';
import '@/styles/CastleCompass.css';

/** Breathing room (px) between the header and the free part of the screen */
const HEADER_FALLBACK_PX = 56;

/** The parts of the window the arrow must stay out of: the header on top and the minimap/statistics stack bottom right. */
const readInsets = (): Insets => {
	const header = parseFloat(document.documentElement.style.getPropertyValue('--header-h')) || HEADER_FALLBACK_PX;
	const stack = document.querySelector<HTMLElement>('[data-bottom-right-stack]');
	const box = stack?.getBoundingClientRect();
	return { top: header, right: 0, bottom: 0, left: 0, avoid: box && box.width > 0 ? { w: box.width + 16, h: box.height + 16 } : undefined };
};

/**
 * Lets the player find the castle on a map without edges. While the castle is off screen an arrow sits on the edge of the
 * screen pointing toward it (with the distance in tiles) and a "Back to castle" button hangs under the header; either one
 * moves the view back. Both are positioned straight in the DOM from the view store, so panning never re-renders React.
 */
const CastleCompass: React.FC = () => {
	const rootRef = useRef<HTMLDivElement>(null);
	const arrowRef = useRef<HTMLButtonElement>(null);
	const turnRef = useRef<HTMLSpanElement>(null);
	const distRef = useRef<HTMLSpanElement>(null);

	useLayoutEffect(() => {
		const update = () => {
			const root = rootRef.current;
			const arrowEl = arrowRef.current;
			if (!root || !arrowEl) return;
			const { x, y, zoom, w, h } = useViewStore.getState();
			const arrow = compassArrow({ x, y, zoom, w, h }, readInsets());
			root.dataset.away = arrow ? '1' : '0';
			if (!arrow) return;
			arrowEl.style.transform = `translate(${Math.round(arrow.x)}px, ${Math.round(arrow.y)}px) translate(-50%, -50%)`;
			if (turnRef.current) turnRef.current.style.transform = `rotate(${arrow.angle.toFixed(1)}deg)`;
			if (distRef.current) distRef.current.textContent = arrow.tiles >= 1000 ? `${(arrow.tiles / 1000).toFixed(1)}k` : String(arrow.tiles);
		};
		update();
		const unsubscribe = useViewStore.subscribe(update);
		// the minimap and statistics change size (shown, hidden, a different map): the arrow keeps out of their way
		const stack = document.querySelector('[data-bottom-right-stack]');
		const observer = typeof ResizeObserver !== 'undefined' && stack ? new ResizeObserver(update) : null;
		if (observer && stack) observer.observe(stack);
		return () => {
			unsubscribe();
			observer?.disconnect();
		};
	}, []);

	const home = () => useViewStore.getState().centerOnCastle();

	return (
		<div ref={rootRef} className='castle-compass' data-away='0'>
			<button ref={arrowRef} type='button' className='compass-arrow' onClick={home} title='Your castle is this way: click to go back' aria-label='Go back to the castle'>
				<span ref={turnRef} className='compass-turn' aria-hidden>
					<svg viewBox='0 0 24 24' width='26' height='26'>
						<path d='M3 8h10V3l9 9-9 9v-5H3z' fill='#ffd860' stroke='#15091f' strokeWidth='1.6' strokeLinejoin='round' />
					</svg>
				</span>
				<span className='compass-dist'>
					<span ref={distRef} />
					<span className='compass-unit'>tiles</span>
				</span>
			</button>
			<button type='button' className='px-btn px-btn-gold px-btn-sm compass-home' onClick={home}>
				Back to castle
			</button>
		</div>
	);
};

export default CastleCompass;
