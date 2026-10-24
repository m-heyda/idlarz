import React, { useMemo, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { buildGroundGrid, terrainKey } from '@/utils/terrain';
import { buildRipples, RIPPLE_FRAMES, RIPPLE_SIZE } from '@/utils/water';
import { pixelIconSrc } from '@/config/pixelIcons';

interface WaterLayerProps {
	/** Visible tile range (inclusive-exclusive), so only the ripples on screen are in the DOM */
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
}

/**
 * Ripples on lakes and swamp pools: small stepped sprite sheets laid over the terrain canvas. They are placed by hash
 * (utils/water.ts), recomputed only when the terrain changes, culled to the screen, and follow the Ambient life setting
 * and prefers-reduced-motion.
 */
const WaterLayer: React.FC<WaterLayerProps> = React.memo(({ minX, maxX, minY, maxY }) => {
	const tiles = useGameStore((state) => state.tiles);
	const enabled = useSettingsStore((state) => state.ambientLife);
	const key = useMemo(() => terrainKey(tiles), [tiles]);
	const tilesRef = useRef(tiles);
	tilesRef.current = tiles;
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const ripples = useMemo(() => (tilesRef.current ? buildRipples(buildGroundGrid(tilesRef.current)) : []), [key]);

	if (!enabled) return null;
	return (
		<>
			{ripples
				.filter((r) => r.tx >= minX && r.tx < maxX && r.ty >= minY && r.ty < maxY)
				.map((r) => {
					const [w, h] = RIPPLE_SIZE[r.kind];
					return (
						<span
							key={r.key}
							className='px-shine px-ripple'
							aria-hidden
							style={
								{
									left: r.x,
									top: r.y,
									'--px-w': `${w}px`,
									'--px-h': `${h}px`,
									'--px-frames': RIPPLE_FRAMES,
									'--px-ms': `${r.ms}ms`,
									'--px-sheet': `url(${pixelIconSrc(r.kind === 'lake' ? 'water_ripple' : 'water_ripple_swamp')})`,
									animationDelay: `-${r.offsetMs}ms`,
								} as React.CSSProperties
							}
						/>
					);
				})}
		</>
	);
});
WaterLayer.displayName = 'WaterLayer';

export default WaterLayer;
