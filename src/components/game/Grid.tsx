/**
 * Rendering notes.
 *
 * - `Grid` mounts only the tiles that matter on screen: explored tiles and the unexplored ones touching them (what can be bought), inside the visible range plus two tiles. The list is rebuilt when that integer range or the map changes, not on every pixel of panning,
 *   and the elements of tiles already built are kept (same object, so React skips them): crossing a tile border creates only the new row or column.
 *   The pan / zoom position lives in `viewStore` and **never goes through React**: `Grid` subscribes to the store and writes `transform` and `--map-zoom` on the world div directly, and reads only the two tile ranges (as strings) so it renders when a range changes. The drag
 *   (last pointer, time, distance) lives in refs, and fling inertia keeps its velocity in a ref with friction; its rAF loop runs only while there is speed left. The world div is a zero-size origin placed with `translate() scale()`; everything inside is positioned in world pixels, negative ones included.
 * - **While panning** (from `PAN_THRESHOLD_PX` of drag until the fling has stopped) the root carries `data-panning`: tiles take no pointer events (no hover styles, tooltips or layout measures under the moving cursor) and every map animation is paused (`globals.css`). The fog drift,
 *   the water sprites, the castle range box-shadow and the sparkles repaint frame by frame; in Firefox that was 36 fps at 5,000 tiles, against 100+ fps with them paused (`scripts/perf-map.mjs`, the page `/map-perf`).
 * - **Wheel zoom** is stepped (0.75 / 1 / 1.5 / 2, one step per 50 px of wheel delta) so the pixel art stays crisp and zooms around the cursor. The zoom is exposed to CSS as `--map-zoom`; tile tooltips scale with it, castle dialogs do not.
 * - **Terrain**: the ground is drawn in **chunks** of 16 x 16 tiles (768 px, `CHUNK_TILES`), one `<canvas>` each (`TerrainLayer` / `TerrainChunk`), only for the chunks on screen plus a ring around them, by `terrainRenderer.ts` from the atlas in `public/pixel/terrain/`
 *   + `src/config/terrainAtlas.json`. A chunk's picture depends only on the ground inside the chunk plus `CHUNK_HALO` (5) tiles, so its `chunkSignature` (one character per tile of that window) decides when it is redrawn: a purchase redraws
 *   the chunks next to it, never pan, zoom or a chest toggle. A chunk is drawn in steps (one row of cells each, `drawChunkSteps`) into one shared back canvas and copied onto its own canvas when whole, within an 8 ms frame budget, so no frame pays for a whole chunk; flat colours show first and until the atlas loads and the picture is complete. Tiles are transparent hit areas that carry the castle,
 *   chest, '?' marker and hover overlays. Buyable unexplored tiles are drawn as the dark 'mist' sea. `tests/world/terrainChunks.test.ts` checks the halo is enough, that equal signatures mean equal pictures, and that nothing is cut at a border.
 * - **Highlight**: the tile menu's "Highlight this ... area" tints the connected same-biome area (`connectedCluster`, an iterative flood fill) with the biome's colour from `biomePalette.ts` for 3 s, drawn by `HighlightLayer` as one screen-space canvas.
 * - **Minimap**: `Minimap` paints one square per explored tile in its biome colour into one `ImageData` (`src/lib/minimap.ts`, repainted at most every 200 ms), a gold marker on the castle, and outlines the visible part.
 *   Click or drag centres the view there; it is outside the map's click area, so it never pays gold.
 * - **Building pads** (`allPads()` in `terrain.ts`, art in `terrain_pads.py`) are drawn under a tile that carries `Tile.building`. Nothing sets it since IDL-259; the per-biome building system (R7, IDL-91) will.
 * - Tile tooltips are portalled into `MapTipLayer`, a layer above the critters, because every tile is its own stacking context. `NotifyDot` is the one "needs attention" marker (unspent stat points, an affordable farm animal or upgrade).
 * - A `Tile` reads only primitives from the store and takes `canAfford` from `Grid`, which works the price of the next tile out once for all of them; unchanged tiles are skipped by `React.memo`, so panning mounts only the tiles that enter the view.
 * - `AmbientLife` spawns a critter every few seconds on an owned tile in view; they are purely decorative (no clicks, no rewards) and off when disabled in Settings, when the tab is hidden, and with `prefers-reduced-motion`.
 * - Tutorial, stat tooltips and cost lists are generated from config constants, so they cannot drift from the rules. Font: Mozilla Headline (self-hosted, `--font-pixel`).
 *
 * @title Rendering the map
 * @category Architecture/Rendering
 * @order 1
 */
import { paragonBonuses } from '@/lib/offline/paragon';
import React, { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo, JSX } from 'react';
import { TILE_SIZE } from '@/config/biomes';
import { castleLevelOf, castleRangeRadius } from '@/lib/castleWard';
import { visibleTileRange, type TileRange } from '@/lib/mapView';
import { pointerToTile } from '@/lib/dragPaint';
import { useMapSource } from './mapSource';
import { calculateTileCost, canAffordBundle, tileCostAsResources } from '@/utils/game/costs';
import { economyTiles } from '@/utils/game/tiles';
import { effectiveTileDiscount } from '@/utils/game/rebirth';
import { getTile, hasOwnedNeighbour, tileKey, type World } from '@/utils/world';
import Tile from './Tile';
import AmbientLife from './AmbientLife';
import { MapTipLayerContext } from './MapTipLayer';
import type { Viewport } from '@/lib/ambientLife';
import CastleRange from './CastleRange';
import TerrainLayer from './TerrainLayer';
import WaterLayer from './WaterLayer';
import HighlightLayer from './HighlightLayer';
import MapMarkers, { MapMarkerRings } from './MapMarkers';
import MapLoadingOverlay from './MapLoadingOverlay';
import RockLayer from './RockLayer';
import { reportCuriosity } from '@/lib/curiosityClient';
import { useUiStore } from '@/stores/uiStore';
import '@/styles/MapLoading.css';

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
const PAN_THRESHOLD_PX = 6; // a press that moves less than this is still a click: the tiles keep their pointer events
/**
 * Wheel zoom. Stepped (not continuous) so the pixel art stays crisp; the range is kept narrow enough that tiles stay
 * readable (0.75 = 36px tiles) and sprites never get blurry-big (2 = a clean 2x).
 */
const ZOOM_LEVELS = [0.75, 1, 1.5, 2];
const WHEEL_STEP_PX = 50; // accumulated wheel delta needed for one zoom step
const WHEEL_LOCKOUT_MS = 140; // swallow trackpad inertia after a step

const rangeKey = (r: TileRange): string => `${r.minX},${r.maxX},${r.minY},${r.maxY}`;
const parseRange = (key: string): TileRange => {
	const [minX, maxX, minY, maxY] = key.split(',').map(Number);
	return { minX, maxX, minY, maxY };
};

const Grid: React.FC = () => {
	const { game, view, drag } = useMapSource();
	const tiles = game((state) => state.tiles);
	const castleLevel = castleLevelOf(tiles);
	const rangeRadius = castleRangeRadius(castleLevel);
	// whether the next tile can be paid: the price is the same for every tile that can be bought, so it is worked out once here
	const canAffordNext = game((state) =>
		canAffordBundle(
			state.resources,
			tileCostAsResources(
				calculateTileCost(
					economyTiles(state.tiles, state.freeTiles),
					effectiveTileDiscount(
						state.characterStats,
						state.prestige,
						state.merchantUpgrades,
						state.playerClass,
						state.equipment,
						paragonBonuses(state.paragonSpent).tileDiscount,
					),
				),
			),
		),
	);
	const gridRef = useRef<HTMLDivElement>(null);
	// The position is not read here: panning moves the world div straight from the view store (see below), so a pan frame renders nothing in React.
	// What is read is the two tile ranges (as strings, so the render happens only when a range really changes).
	const paddedKey = view((s) => rangeKey(visibleTileRange({ x: s.x, y: s.y }, s.zoom, { w: s.w, h: s.h }, VISIBLE_PADDING)));
	const seenKey = view((s) => rangeKey(visibleTileRange({ x: s.x, y: s.y }, s.zoom, { w: s.w, h: s.h }, 1)));
	const worldRef = useRef<HTMLDivElement>(null);
	const velocityRef = useRef<Velocity>({ x: 0, y: 0 });
	// the drag lives in refs: a mouse move must not render the map
	const draggingRef = useRef(false);
	const lastPosRef = useRef<Position | null>(null);
	const lastTimeRef = useRef(0);
	const movedRef = useRef(0); // px travelled since the press: a click with a shaky hand is not a pan
	const animationFrameRef = useRef<number | null>(null);
	const wheelAccRef = useRef({ delta: 0, lockedUntil: 0 });
	const strokingRef = useRef(false);

	useEffect(() => {
		const updateWindowSize = () => view.getState().setSize(window.innerWidth, window.innerHeight);
		updateWindowSize();
		view.getState().centerOnCastle();
		window.addEventListener('resize', updateWindowSize);
		return () => {
			window.removeEventListener('resize', updateWindowSize);
		};
	}, [view]);

	// The pan and zoom go to the world div from here, not through React props: one style write per change, no render of the map.
	useLayoutEffect(() => {
		const place = (s: { x: number; y: number; zoom: number }) => {
			const el = worldRef.current;
			if (!el) return;
			el.style.transform = `translate(${s.x}px, ${s.y}px) scale(${s.zoom})`;
			el.style.setProperty('--map-zoom', String(s.zoom));
		};
		place(view.getState());
		return view.subscribe(place);
	}, [view]);

	// the explored land changed (a purchase at the edge, rebirth, reset, load): the view may no longer be allowed
	useEffect(() => {
		view.getState().reclamp();
	}, [tiles.bounds, view]);

	const pan = useCallback(
		(dx: number, dy: number) => {
			const v = view.getState();
			v.setPosition({ x: v.x + dx, y: v.y + dy });
		},
		[view],
	);

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

			const from = view.getState().zoom;
			const idx = ZOOM_LEVELS.indexOf(from);
			const base = idx === -1 ? ZOOM_LEVELS.findIndex((l) => l >= from) : idx;
			const next = ZOOM_LEVELS[Math.max(0, Math.min(ZOOM_LEVELS.length - 1, (base === -1 ? ZOOM_LEVELS.length - 1 : base) + dir))];
			if (next === from) return;
			// the most and the least the map can be zoomed are secret deeds
			if (next === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]) reportCuriosity('map_zoom_max');
			if (next === ZOOM_LEVELS[0]) reportCuriosity('map_zoom_min');

			velocityRef.current = { x: 0, y: 0 };
			view.getState().setZoom(next, { x: e.clientX, y: e.clientY });
		};
		el.addEventListener('wheel', onWheel, { passive: false });
		return () => el.removeEventListener('wheel', onWheel);
	}, [view]);

	// While the map is dragged or flung the tiles take no pointer events: nothing under the moving cursor gets hover styles, a tooltip or a layout measure (see `.map-root[data-panning]`)
	const setPanning = useCallback((on: boolean) => {
		const el = gridRef.current;
		if (!el) return;
		if (on) el.dataset.panning = '';
		else delete el.dataset.panning;
	}, []);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent | React.TouchEvent) => {
			// only the main (and the middle) button pans: a right press belongs to the context menu
			const middle = 'button' in e && e.button === 1;
			if ('button' in e && e.button !== 0 && !middle) return;
			e.preventDefault();
			const pos = 'touches' in e ? e.touches[0] : e;
			// a drawing tool owns the main button: the map holds still and the pointer's tiles go to the stroke
			if (drag && !middle) {
				velocityRef.current = { x: 0, y: 0 };
				const t = pointerToTile(pos.clientX, pos.clientY, view.getState(), TILE_SIZE);
				strokingRef.current = true;
				drag.begin(t.x, t.y);
				return;
			}
			draggingRef.current = true;
			lastPosRef.current = { x: pos.clientX, y: pos.clientY };
			lastTimeRef.current = performance.now();
			movedRef.current = 0;
			velocityRef.current = { x: 0, y: 0 };
		},
		[drag, view],
	);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent | React.TouchEvent) => {
			if (strokingRef.current && drag) {
				e.preventDefault();
				const pos = 'touches' in e ? e.touches[0] : e;
				const t = pointerToTile(pos.clientX, pos.clientY, view.getState(), TILE_SIZE);
				drag.move(t.x, t.y);
				return;
			}
			const last = lastPosRef.current;
			if (!draggingRef.current || !last) return;
			e.preventDefault();

			const pos = 'touches' in e ? e.touches[0] : e;
			const deltaX = pos.clientX - last.x;
			const deltaY = pos.clientY - last.y;
			const currentTime = performance.now();
			const deltaTime = currentTime - lastTimeRef.current;

			if (deltaTime > 0) {
				velocityRef.current = {
					x: (deltaX / deltaTime) * VELOCITY_SCALE,
					y: (deltaY / deltaTime) * VELOCITY_SCALE,
				};
			}

			movedRef.current += Math.abs(deltaX) + Math.abs(deltaY);
			if (movedRef.current > PAN_THRESHOLD_PX) setPanning(true);
			pan(deltaX, deltaY);

			lastPosRef.current = { x: pos.clientX, y: pos.clientY };
			lastTimeRef.current = currentTime;
		},
		[pan, drag, view, setPanning],
	);

	// The fling after a release: one frame at a time, only while there is speed left (no loop runs while the map is still)
	const animate = useCallback(() => {
		animationFrameRef.current = null;
		if (draggingRef.current) return;
		const vel = velocityRef.current;
		if (vel.x === 0 && vel.y === 0) {
			setPanning(false);
			return;
		}
		if (Math.abs(vel.x) < MIN_VELOCITY && Math.abs(vel.y) < MIN_VELOCITY) {
			velocityRef.current = { x: 0, y: 0 };
			setPanning(false);
			return;
		}
		pan(vel.x * FRAME_MS, vel.y * FRAME_MS);
		velocityRef.current = { x: vel.x * FRICTION, y: vel.y * FRICTION };
		animationFrameRef.current = requestAnimationFrame(animate);
	}, [pan, setPanning]);

	const handleMouseUp = useCallback(() => {
		if (strokingRef.current) {
			strokingRef.current = false;
			drag?.end();
		}
		const wasDragging = draggingRef.current;
		draggingRef.current = false;
		lastPosRef.current = null;
		if (performance.now() - lastTimeRef.current > FLING_MAX_IDLE_MS) {
			velocityRef.current = { x: 0, y: 0 };
		}
		if (!wasDragging) return;
		const vel = velocityRef.current;
		if (vel.x === 0 && vel.y === 0) setPanning(false);
		else if (animationFrameRef.current === null) animationFrameRef.current = requestAnimationFrame(animate);
	}, [drag, animate, setPanning]);

	useEffect(
		() => () => {
			if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
		},
		[],
	);

	// Which tiles are on screen right now (read by the ambient critters when they pick a spot)
	const [tipLayer, setTipLayer] = useState<HTMLElement | null>(null);
	const viewportRef = useRef<Viewport>({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
	const mapReady = useUiStore((state) => state.mapReady);
	// read when a critter picks its spot, from the live view (the render no longer follows every pixel of a pan)
	const getViewport = useCallback(() => {
		const v = view.getState();
		viewportRef.current = visibleTileRange({ x: v.x, y: v.y }, v.zoom, { w: v.w, h: v.h });
		return viewportRef.current;
	}, [view]);

	// Tile range on screen (one tile of slack): the terrain chunks and the water ripples render only inside it
	const seen = useMemo(() => parseRange(seenKey), [seenKey]);

	/**
	 * The tiles that exist on screen: explored ones and the unexplored ones that touch them (what can be bought). Rebuilt when the
	 * range of tiles changes or the map does, not on every pixel of panning.
	 */
	const { minX, maxX, minY, maxY } = useMemo(() => parseRange(paddedKey), [paddedKey]);
	// The elements of the tiles already built stay (same object, so React skips them): crossing a tile border only creates the new row or column. They are dropped when the map or the price changes.
	const built = useRef<{ tiles: World; canAfford: boolean; els: Map<number, JSX.Element | null> } | null>(null);
	const visibleTiles = useMemo(() => {
		let cache = built.current;
		if (!cache || cache.tiles !== tiles || cache.canAfford !== canAffordNext) cache = built.current = { tiles, canAfford: canAffordNext, els: new Map() };
		const next = new Map<number, JSX.Element | null>();
		const visible: JSX.Element[] = [];
		for (let y = minY; y < maxY; y++) {
			for (let x = minX; x < maxX; x++) {
				const key = tileKey(x, y);
				let el = cache.els.get(key);
				if (el === undefined) {
					const tile = getTile(tiles, x, y);
					el =
						!tile && !hasOwnedNeighbour(tiles, x, y) ? null : (
							<Tile key={`${x},${y}`} biome={tile ? tile.biome : 'empty'} isOwned={!!tile} x={x} y={y} level={tile?.level} canAfford={canAffordNext} />
						);
				}
				next.set(key, el);
				if (el) visible.push(el);
			}
		}
		cache.els = next;
		return visible;
	}, [minX, maxX, minY, maxY, tiles, canAffordNext]);

	return (
		<div
			ref={gridRef}
			data-click-area
			data-tutorial='map'
			className='fixed inset-0 overflow-hidden bg-gray-950 map-root'
			data-map-ready={mapReady}
			onMouseDown={handleMouseDown}
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
			onMouseLeave={handleMouseUp}
			onTouchStart={handleMouseDown}
			onTouchMove={handleMouseMove}
			onTouchEnd={handleMouseUp}
		>
			{/* Fog of war: drifting mist behind the map; far-away tiles are transparent so it shows through */}
			<div className='fog-layer fog-a' />
			<div className='fog-layer fog-b' />
			{/* The world: a zero-size origin, everything inside is placed in world px (negative ones too) */}
			<div ref={worldRef} className='absolute' style={{ left: 0, top: 0, width: 0, height: 0, transformOrigin: '0 0' }}>
				<TerrainLayer minX={seen.minX} maxX={seen.maxX} minY={seen.minY} maxY={seen.maxY} />
				<WaterLayer minX={seen.minX} maxX={seen.maxX} minY={seen.minY} maxY={seen.maxY} />
				<MapTipLayerContext.Provider value={tipLayer}>{visibleTiles}</MapTipLayerContext.Provider>
				<AmbientLife getViewport={getViewport} />
				<CastleRange radius={rangeRadius} />
				<RockLayer />
				<MapMarkerRings />
				<div ref={setTipLayer} className='map-tip-layer' />
			</div>
			<HighlightLayer />
			<MapMarkers />
			<MapLoadingOverlay show={!mapReady} />
		</div>
	);
};

export default Grid;
