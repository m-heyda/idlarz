import { createContext, useContext } from 'react';
import type { StoreApi, UseBoundStore } from 'zustand';
import { useGameStore } from '@/stores/gameStore';
import { useViewStore, type ViewStore } from '@/stores/viewStore';
import type { DragHandler } from '@/lib/dragPaint';
import type { GameState } from '@/types/game';

/**
 * What the map components read from the game. The game gives them its real store; the map lab (/map-lab) gives them a
 * simulated one, so the same Grid / Tile / terrain code can be looked at without an account, a save or the server.
 */
export type MapGameState = Pick<
	GameState,
	| 'tiles'
	| 'monsters'
	| 'resources'
	| 'characterStats'
	| 'prestige'
	| 'merchantUpgrades'
	| 'freeTiles'
	| 'castleUpgrade'
	| 'buyTile'
	| 'collectChest'
	| 'startFight'
>;

export type MapGameStore = UseBoundStore<StoreApi<MapGameState>>;

export interface MapSource {
	game: MapGameStore;
	view: ViewStore;
	/**
	 * Set by the lab: a click or right click on a tile goes here instead of the game's rules (buy, fight, open a chest, the
	 * castle dialog, the tile menu). `button` is 0 for a click, 2 for a right click.
	 */
	onTile?: (x: number, y: number, button: 0 | 2) => void;
	/**
	 * Hold the main button and drag to draw (see lib/dragPaint.ts). While set, the map does not pan with the main button
	 * (the middle button still pans), and a plain click is a stroke of one cell instead of the tile's own click.
	 */
	drag?: DragHandler;
}

// The real store has more fields than the map reads and its setState is typed for all of them: this is the narrowed view of it.
const GAME_SOURCE: MapSource = {
	game: useGameStore as unknown as MapGameStore,
	view: useViewStore,
};

const MapSourceContext = createContext<MapSource>(GAME_SOURCE);

export const MapSourceProvider = MapSourceContext.Provider;

export const useMapSource = (): MapSource => useContext(MapSourceContext);

/** The store the map reads the world from (the game's, or the lab's). */
export const useMapGame = (): MapGameStore => useContext(MapSourceContext).game;

/** The store with the pan and zoom of the map. */
export const useMapView = (): ViewStore => useContext(MapSourceContext).view;
