import React, { useMemo } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { CHUNK_TILES, chunkOf, chunkSignature, worldGround } from '@/utils/terrain';
import { tileRipples, tileShimmer, RIPPLE_FRAMES, RIPPLE_SIZE, SHIMMER, type Ripple, type Shimmer } from '@/utils/water';
import { ownedBounds, type World } from '@/utils/world';
import { pixelIconSrc } from '@/config/pixelIcons';

interface WaterLayerProps {
	/** Visible tile range (inclusive-exclusive), so only the ripples on screen are in the DOM */
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
}

/**
 * Ripples on lakes and swamp pools and the glitter on open water: small stepped sprite sheets laid over the terrain. They
 * are placed by hash (utils/water.ts), built per chunk and rebuilt only when that chunk's terrain changes, culled to the
 * screen, and follow the Ambient life setting and prefers-reduced-motion.
 */
interface WaterChunkProps extends WaterLayerProps {
	cx: number;
	cy: number;
	tiles: World;
}

const WaterChunk: React.FC<WaterChunkProps> = React.memo(({ cx, cy, tiles, minX, maxX, minY, maxY }) => {
	const signature = useMemo(() => chunkSignature(tiles, cx, cy), [tiles, cx, cy]);
	const water = useMemo(() => {
		const g = worldGround(tiles);
		const ripples: Ripple[] = [];
		const shimmers: Shimmer[] = [];
		for (let y = cy * CHUNK_TILES; y < (cy + 1) * CHUNK_TILES; y++) {
			for (let x = cx * CHUNK_TILES; x < (cx + 1) * CHUNK_TILES; x++) {
				if (!g(x, y)) continue;
				ripples.push(...tileRipples(g, x, y));
				const s = tileShimmer(g, x, y);
				if (s) shimmers.push(s);
			}
		}
		return { ripples, shimmers };
		// the picture of the chunk (its signature) is all the water depends on
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [signature, cx, cy]);

	return (
		<>
			{water.shimmers
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
			{water.ripples
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
WaterChunk.displayName = 'WaterChunk';

const WaterLayer: React.FC<WaterLayerProps> = React.memo(({ minX, maxX, minY, maxY }) => {
	const tiles = useGameStore((state) => state.tiles);
	const enabled = useSettingsStore((state) => state.ambientLife);
	const bounds = ownedBounds(tiles);
	if (!enabled || !bounds) return null;

	// only the chunks that overlap the screen and the explored land
	const chunks: { cx: number; cy: number }[] = [];
	const c0x = Math.max(chunkOf(minX), chunkOf(bounds.minX - 1));
	const c1x = Math.min(chunkOf(maxX - 1), chunkOf(bounds.maxX + 1));
	const c0y = Math.max(chunkOf(minY), chunkOf(bounds.minY - 1));
	const c1y = Math.min(chunkOf(maxY - 1), chunkOf(bounds.maxY + 1));
	for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) chunks.push({ cx, cy });

	return (
		<>
			{chunks.map(({ cx, cy }) => (
				<WaterChunk key={`${cx},${cy}`} cx={cx} cy={cy} tiles={tiles} minX={minX} maxX={maxX} minY={minY} maxY={maxY} />
			))}
		</>
	);
});
WaterLayer.displayName = 'WaterLayer';

export default WaterLayer;
