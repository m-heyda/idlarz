import type React from 'react';
import { BIOMES } from '@/config/biomes';
import { openMenuAt } from '@/lib/globalMenu';
import { tileMenuItems, type TileMenuContext } from '@/lib/tileMenuItems';
import '@/styles/ContextMenu.css';

/** Right click on an explored tile: {@link tileMenuItems}, then the global entries. Called from the tile's event handler. */
export function openTileMenu(e: React.MouseEvent, ctx: TileMenuContext) {
	e.preventDefault();
	openMenuAt(e.clientX, e.clientY, ctx.biome === 'castle' ? 'Castle' : (BIOMES[ctx.biome]?.label ?? ctx.biome), tileMenuItems(ctx));
}
