'use client';

import React, { useEffect, useState } from 'react';
import Grid from '@/components/game/Grid';
import { useGameStore } from '@/stores/gameStore';
import { useViewStore } from '@/stores/viewStore';
import { useUiStore } from '@/stores/uiStore';
import { syntheticWorld } from '@/utils/worldGen';
import { TICK_RATE } from '@/config/economy';
import '@idlarz/design-system';

/**
 * `/map-perf?n=5000&tick=1`: the real `Grid`, the real game store and the real 100 ms tick on a synthetic world of `n` explored tiles, with no account, save
 * or server. `scripts/perf-map.mjs` drives it in a browser and measures frame times while the map is panned. `tick=0` stops the tick, to tell the cost of
 * the per-tile store subscriptions from the cost of painting. Development only: the layout 404s in a production build unless it is built with `NEXT_PUBLIC_MAP_PERF=1` (that is how the numbers of a real build are taken).
 *
 * @title Map perf page (/map-perf)
 * @category Ops/Map performance
 * @order 1
 */
export default function MapPerfPage() {
	const [ready, setReady] = useState(false);

	useEffect(() => {
		const q = new URLSearchParams(window.location.search);
		const n = Number(q.get('n') ?? 5000);
		const ticking = q.get('tick') !== '0';
		const api = useGameStore.getState();
		api.resetGame();
		useGameStore.setState((s) => ({
			tiles: syntheticWorld(n, 1),
			freeTiles: 1,
			resources: { ...s.resources, gold: 1e12, wood: 1e12, stone: 1e12, coal: 1e12, food: 1e12 },
		}));
		useUiStore.setState({ mapReady: true });
		let last = performance.now();
		let id: ReturnType<typeof setInterval> | undefined;
		if (ticking) {
			id = setInterval(() => {
				const now = performance.now();
				useGameStore.getState().tick(now - last);
				last = now;
			}, TICK_RATE);
		}
		setReady(true);
		return () => clearInterval(id);
	}, []);

	useEffect(() => {
		if (ready) (window as unknown as { __mapPerf: unknown }).__mapPerf = { view: useViewStore, game: useGameStore };
	}, [ready]);

	return <div className='h-screen w-screen overflow-hidden relative'>{ready && <Grid />}</div>;
}
