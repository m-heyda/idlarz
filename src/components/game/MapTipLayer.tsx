import { createContext, useContext } from 'react';

/**
 * The layer that map tooltips are drawn into. Tiles are their own stacking contexts (they are positioned with a
 * transform), so a tooltip inside a tile could never rise above the ambient critters without lifting the whole
 * tile over them; tiles portal their tooltip here instead, above everything on the map.
 */
export const MapTipLayerContext = createContext<HTMLElement | null>(null);

export const useMapTipLayer = () => useContext(MapTipLayerContext);
