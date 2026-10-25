import React, {
	useRef,
	useEffect,
	useState,
	useCallback,
	useMemo,
	JSX,
} from 'react';
import { useGameStore } from '@/stores/gameStore';
import { CASTLE_FORTRESS } from '@/config/gameConfig';
import { castleLevelOf } from '@/lib/castleWard';
import { visibleTileRange } from '@/lib/mapView';
import { useViewStore } from '@/stores/viewStore';
import { calculateTileCost, canAffordBundle, economyTiles, effectiveTileDiscount, tileCostAsResources } from '@/utils/gameUtils';
import { getTile, hasOwnedNeighbour } from '@/utils/world';
import Tile from './Tile';
import AmbientLife from './AmbientLife';
import { MapTipLayerContext } from './MapTipLayer';
import type { Viewport } from '@/lib/ambientLife';
import CastleRange from './CastleRange';
import CastleFortress from './CastleFortress';
import TerrainLayer from './TerrainLayer';
import WaterLayer from './WaterLayer';
import HighlightLayer from './HighlightLayer';

interface Velocity {
	x: number;
	y: number;
}

interface Position {
	x: number;
	y: number;
}

const MIN_VELOCITY = 0.02; // px/ms below which the fling stops
const VELOCITY_SCALE = 1;
const FRAME_MS = 8; // converts px/ms to px/frame (tuned so a flick travels ~80x its speed)
const FRICTION = 0.9; // per-frame velocity decay while flinging
const FLING_MAX_IDLE_MS = 100; // releasing after pausing longer than this does not fling
const VISIBLE_PADDING = 2;
// Wheel zoom. Stepped (not continuous) so the pixel art stays crisp; the range is kept narrow enough that tiles stay
// readable (0.75 = 36px tiles) and sprites never get blurry-big (2 = a clean 2x).
const ZOOM_LEVELS = [0.75, 1, 1.5, 2];
const WHEEL_STEP_PX = 50; // accumulated wheel delta needed for one zoom step
const WHEEL_LOCKOUT_MS = 140; // swallow trackpad inertia after a step

const Grid: React.FC = () => {
	const tiles = useGameStore((state) => state.tiles);
	// whether the next tile can be paid: the price is the same for every tile that can be bought, so it is worked out once here
	const canAffordNext = useGameStore((state) =>
		canAffordBundle(
			state.resources,
			tileCostAsResources(
				calculateTileCost(economyTiles(state.tiles, state.freeTiles), effectiveTileDiscount(state.characterStats, state.prestige, state.merchantUpgrades))
			)
		)
	);
	const gridRef = useRef<HTMLDivElement>(null);
	const { x: viewX, y: viewY, zoom, w: windowW, h: windowH } = useViewStore();
	const velocityRef = useRef<Velocity>({ x: 0, y: 0 });
	const [isDragging, setIsDragging] = useState(false);
	const [lastMousePos, setLastMousePos] = useState<Position | null>(null);
	const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
	const animationFrameRef = useRef<number | null>(null);
	const wheelAccRef = useRef({ delta: 0, lockedUntil: 0 });

	useEffect(() => {
		const updateWindowSize = () => useViewStore.getState().setSize(window.innerWidth, window.innerHeight);
		updateWindowSize();
		useViewStore.getState().centerOnCastle();
		window.addEventListener('resize', updateWindowSize);
		return () => {
			window.removeEventListener('resize', updateWindowSize);
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
		};
	}, []);

	// the explored land changed (a purchase at the edge, rebirth, reset, load): the view may no longer be allowed
	useEffect(() => {
		useViewStore.getState().reclamp();
	}, [tiles.bounds]);

	const pan = useCallback((dx: number, dy: number) => {
		const v = useViewStore.getState();
		v.setPosition({ x: v.x + dx, y: v.y + dy });
	}, []);

	// Wheel zoom around the cursor. Native listener: React's onWheel is passive and cannot stop the page zooming.
	useEffect(() => {
		const el = gridRef.current;
		if (!el) return;
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			const acc = wheelAccRef.current;
			const now = performance.now();
			if (now < acc.lockedUntil) return;
			acc.delta += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
			if (Math.abs(acc.delta) < WHEEL_STEP_PX) return;
			const dir = acc.delta < 0 ? 1 : -1; // wheel up zooms in
			acc.delta = 0;
			acc.lockedUntil = now + WHEEL_LOCKOUT_MS;

			const from = useViewStore.getState().zoom;
			const idx = ZOOM_LEVELS.indexOf(from);
			const base = idx === -1 ? ZOOM_LEVELS.findIndex((l) => l >= from) : idx;
			const next = ZOOM_LEVELS[Math.max(0, Math.min(ZOOM_LEVELS.length - 1, (base === -1 ? ZOOM_LEVELS.length - 1 : base) + dir))];
			if (next === from) return;

			velocityRef.current = { x: 0, y: 0 };
			useViewStore.getState().setZoom(next, { x: e.clientX, y: e.clientY });
		};
		el.addEventListener('wheel', onWheel, { passive: false });
		return () => el.removeEventListener('wheel', onWheel);
	}, []);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent | React.TouchEvent) => {
			// only the main button pans: a right press belongs to the context menu
			if ('button' in e && e.button !== 0) return;
			e.preventDefault();
			const pos = 'touches' in e ? e.touches[0] : e;
			setIsDragging(true);
			setLastMousePos({ x: pos.clientX, y: pos.clientY });
			velocityRef.current = { x: 0, y: 0 };
		},
		[]
	);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent | React.TouchEvent) => {
			if (!isDragging || !lastMousePos) return;
			e.preventDefault();

			const pos = 'touches' in e ? e.touches[0] : e;
			const deltaX = pos.clientX - lastMousePos.x;
			const deltaY = pos.clientY - lastMousePos.y;
			const currentTime = performance.now();
			const deltaTime = currentTime - lastUpdateTime;

			if (deltaTime > 0) {
				velocityRef.current = {
					x: (deltaX / deltaTime) * VELOCITY_SCALE,
					y: (deltaY / deltaTime) * VELOCITY_SCALE,
				};
			}

			pan(deltaX, deltaY);

			setLastMousePos({ x: pos.clientX, y: pos.clientY });
			setLastUpdateTime(currentTime);
		},
		[isDragging, lastMousePos, lastUpdateTime, pan]
	);

	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
		setLastMousePos(null);
		if (performance.now() - lastUpdateTime > FLING_MAX_IDLE_MS) {
			velocityRef.current = { x: 0, y: 0 };
		}
	}, [lastUpdateTime]);

	const animate = useCallback(() => {
		const vel = velocityRef.current;
		if (!isDragging && (vel.x !== 0 || vel.y !== 0)) {
			if (Math.abs(vel.x) < MIN_VELOCITY && Math.abs(vel.y) < MIN_VELOCITY) {
				velocityRef.current = { x: 0, y: 0 };
			} else {
				pan(vel.x * FRAME_MS, vel.y * FRAME_MS);
				velocityRef.current = { x: vel.x * FRICTION, y: vel.y * FRICTION };
			}
		}

		animationFrameRef.current = requestAnimationFrame(animate);
	}, [isDragging, pan]);

	useEffect(() => {
		animationFrameRef.current = requestAnimationFrame(animate);

		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
		};
	}, [animate]);

	// Which tiles are on screen right now (read by the ambient critters when they pick a spot)
	const [tipLayer, setTipLayer] = useState<HTMLElement | null>(null);
	const viewportRef = useRef<Viewport>({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
	const size = { w: windowW, h: windowH };
	viewportRef.current = visibleTileRange({ x: viewX, y: viewY }, zoom, size);
	const getViewport = useCallback(() => viewportRef.current, []);

	// Tile range on screen (one tile of slack): the terrain chunks and the water ripples render only inside it
	const seen = visibleTileRange({ x: viewX, y: viewY }, zoom, size, 1);

	// The tiles that exist on screen: explored ones and the unexplored ones that touch them (what can be bought). Rebuilt when the
	// range of tiles changes or the map does, not on every pixel of panning.
	const padded = visibleTileRange({ x: viewX, y: viewY }, zoom, size, VISIBLE_PADDING);
	const { minX, maxX, minY, maxY } = padded;
	const visibleTiles = useMemo(() => {
		const visible: JSX.Element[] = [];
		for (let y = minY; y < maxY; y++) {
			for (let x = minX; x < maxX; x++) {
				const tile = getTile(tiles, x, y);
				if (!tile && !hasOwnedNeighbour(tiles, x, y)) continue;
				visible.push(
					<Tile
						key={`${x},${y}`}
						biome={tile ? tile.biome : 'empty'}
						isOwned={!!tile}
						x={x}
						y={y}
						level={tile?.level}
						building={tile?.building}
						canAfford={canAffordNext}
					/>
				);
			}
		}
		return visible;
	}, [minX, maxX, minY, maxY, tiles, canAffordNext]);

	return (
		<div
			ref={gridRef}
			data-click-area
			className='fixed inset-0 overflow-hidden bg-gray-950'
			onMouseDown={handleMouseDown}
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
			onMouseLeave={handleMouseUp}
			onTouchStart={handleMouseDown}
			onTouchMove={handleMouseMove}
			onTouchEnd={handleMouseUp}>
			{/* Fog of war: drifting mist behind the map; far-away tiles are transparent so it shows through */}
			<div className='fog-layer fog-a' />
			<div
				className='fog-layer fog-b'
				style={{ backgroundPosition: `${viewX * 0.35}px ${viewY * 0.35}px` }}
			/>
			{/* The world: a zero-size origin, everything inside is placed in world px (negative ones too) */}
			<div
				className='absolute'
				style={{
					left: 0,
					top: 0,
					width: 0,
					height: 0,
					transform: `translate(${viewX}px, ${viewY}px) scale(${zoom})`,
					transformOrigin: '0 0',
					'--map-zoom': zoom,
				} as React.CSSProperties}>
				<TerrainLayer minX={seen.minX} maxX={seen.maxX} minY={seen.minY} maxY={seen.maxY} />
				<WaterLayer minX={seen.minX} maxX={seen.maxX} minY={seen.minY} maxY={seen.maxY} />
				<MapTipLayerContext.Provider value={tipLayer}>{visibleTiles}</MapTipLayerContext.Provider>
				<AmbientLife getViewport={getViewport} />
				{castleLevelOf(tiles) >= CASTLE_FORTRESS.fromLevel ? (
					<CastleFortress level={castleLevelOf(tiles)} />
				) : (
					<CastleRange />
				)}
				<div ref={setTipLayer} className='map-tip-layer' />
			</div>
			<HighlightLayer />
		</div>
	);
};

export default Grid;
