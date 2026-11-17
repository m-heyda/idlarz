import React, { useLayoutEffect, useRef, useState } from 'react';
import { TIP_TOP_INSET } from '../../../packages/design-system/src/logic';

/**
 * A hover card on the map, kept on screen. The map's tooltips are drawn inside the zoomed, panned map layer above (or below) their tile, so near the top of the screen they would slide under the resource bar and near the
 * sides they would be cut off. After every render the card is measured (screen pixels) and nudged just enough to sit inside the window and below the top bar; the nudge is in screen pixels because the card counter-scales the map zoom (`.map-tip`).
 * `className` places the card next to its tile (it is the class the card had before).
 */
const MapTip: React.FC<{ className: string; children: React.ReactNode }> = ({ className, children }) => {
	const inner = useRef<HTMLDivElement>(null);
	const [shift, setShift] = useState({ x: 0, y: 0 });
	useLayoutEffect(() => {
		const el = inner.current;
		if (!el) return;
		const measure = () => {
			const r = el.getBoundingClientRect();
			const margin = 8;
			// where the card would be without the nudge it already has
			const left = r.left - shift.x;
			const top = r.top - shift.y;
			const x = Math.max(margin - left, Math.min(0, window.innerWidth - margin - (left + r.width)));
			const y = Math.max(TIP_TOP_INSET - top, Math.min(0, window.innerHeight - margin - (top + r.height)));
			if (Math.abs(x - shift.x) > 0.5 || Math.abs(y - shift.y) > 0.5) setShift({ x, y });
		};
		measure();
		// the card grows or shrinks while it is shown (a timer line appears): measure again
		if (typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	}, [shift.x, shift.y]);
	return (
		<div className={className}>
			<div ref={inner} style={{ transform: `translate(${shift.x}px, ${shift.y}px)` }}>
				{children}
			</div>
		</div>
	);
};

export default MapTip;
