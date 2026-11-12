import React from 'react';
import { ContextMenu as DsContextMenu } from '../../../packages/design-system/src/components/menu';
import audioManager from '@/utils/audioManager';
import { useUiStore } from '@/stores/uiStore';

/**
 * The one right-click / dropdown menu, drawn by the design system's `ContextMenu`. Whoever opens it (a tile, a bag slot, the game menu button, empty space) hands the store a position and its entries; they carry the same
 * fields as ever (hints, live countdown hints, tick boxes, disabled with a reason, danger, separators, submenus with Back, tooltips). It is kept on screen and closes on Escape, a press outside, a scroll, a resize or losing focus; the button that
 * opened it (`data-ctx-anchor`) closes it itself on its click, and every pressed entry plays the click sound.
 */
const ContextMenu: React.FC = () => {
	const menu = useUiStore((state) => state.contextMenu);
	const close = useUiStore((state) => state.closeContextMenu);
	return <DsContextMenu menu={menu} onClose={close} anchorSelector='[data-ctx-anchor]' onItemPress={() => audioManager.playSound('click')} />;
};

export default ContextMenu;
