import React, { useMemo, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { buildGroundGrid, terrainKey } from '@/utils/terrain';
import { buildRipples, buildShimmers, RIPPLE_FRAMES, RIPPLE_SIZE, SHIMMER } from '@/utils/water';
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
	const water = useMemo(() => {
		if (!tilesRef.current) return { ripples: [], shimmers: [] };
		const grid = buildGroundGrid(tilesRef.current);
		return { ripples: buildRipples(grid), shimmers: buildShimmers(grid) };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key]);
	const { ripples, shimmers } = water;

	if (!enabled) return null;
	return (
		<>
			{shimmers
				.filter((s) => s.tx >= minX && s.tx < maxX && s.ty >= minY && s.ty < maxY)
				.map((s) => (
					<span
						key={s.key}
						className='px-shine px-shimmer'
						aria-hidden
						style={
							{
								left: s.x,
								top: s.y,
								'--px-w': `${SHIMMER.size}px`,
								'--px-h': `${SHIMMER.size}px`,
								'--px-frames': SHIMMER.frames,
								'--px-ms': `${s.ms}ms`,
								'--px-sheet': `url(${pixelIconSrc('water_shimmer')})`,
								animationDelay: `-${s.offsetMs}ms`,
								transform: s.flip ? 'scaleX(-1)' : undefined,
							} as React.CSSProperties
						}
					/>
				))}
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
