import React from 'react';

/** The eight pixels of the spinner ring (8 px squares on a 64 px grid); each one lights up a step after the one before it (see `.map-spinner` in MapLoading.css). */
const PIXELS: readonly (readonly [number, number])[] = [
	[28, 4],
	[44, 12],
	[52, 28],
	[44, 44],
	[28, 52],
	[12, 44],
	[4, 28],
	[12, 12],
];

/**
 * The spinner over the map while the game waits for the monsters and chests the server puts on it. The map itself is grey meanwhile (`.map-root[data-map-ready='false']` in MapLoading.css) and fades back to colour over 1.6 s once `show` turns false;
 * the spinner fades out at the same moment and is then removed. It never takes a click: the map under it works as usual.
 */
const MapLoadingOverlay: React.FC<{ show: boolean }> = ({ show }) => {
	// stays mounted for the fade-out
	const [mounted, setMounted] = React.useState(show);
	React.useEffect(() => {
		if (show) {
			setMounted(true);
			return;
		}
		const t = setTimeout(() => setMounted(false), 500);
		return () => clearTimeout(t);
	}, [show]);
	if (!mounted) return null;
	return (
		<div className='map-loading' data-show={show} role='status' aria-label='Loading the map'>
			<svg className='map-spinner' viewBox='0 0 64 64' aria-hidden='true' shapeRendering='crispEdges'>
				{PIXELS.map(([x, y], i) => (
					<rect key={i} x={x} y={y} width={8} height={8} style={{ '--i': i } as React.CSSProperties} />
				))}
			</svg>
			<span className='map-loading-text'>Waking your realm...</span>
		</div>
	);
};

export default MapLoadingOverlay;
