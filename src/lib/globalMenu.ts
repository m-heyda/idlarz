import { useGameStore } from '@/stores/gameStore';
import { useUiStore, type ContextMenuItem } from '@/stores/uiStore';
import { pickPersisted } from '@/lib/sanitizeSave';
import { exportSaveText, saveNow } from '@/lib/saveStorage';
import { copyText } from '@/lib/clipboard';

const saveGame = async () => {
	const ok = await saveNow(pickPersisted(useGameStore.getState()));
	useUiStore.getState().showToast(ok ? 'Game saved' : 'Could not save: the browser blocked it, or another tab runs the game');
};

const exportGame = async () => {
	const ok = await copyText(exportSaveText(pickPersisted(useGameStore.getState())));
	useUiStore.getState().showToast(ok ? 'Save copied to the clipboard' : 'Could not copy: open Import / export and copy it by hand');
};

/**
 * The entries every menu ends with: saving and the view options. The header dropdown (`full`) also lists Settings and the
 * Guide, the right-click menu stays short.
 */
export const globalMenuItems = (full = false): ContextMenuItem[] => {
	const ui = useUiStore.getState();
	const items: ContextMenuItem[] = [
		...(full
			? [
					{ id: 'settings', label: 'Settings', onSelect: ui.toggleSettings },
					{ id: 'guide', label: 'Guide', onSelect: ui.openTutorial },
				]
			: []),
		{ id: 'save', label: 'Save game', separator: full, onSelect: () => void saveGame() },
		{ id: 'export', label: 'Export game save', onSelect: () => void exportGame() },
		{ id: 'import', label: 'Import / backup...', onSelect: ui.toggleSaveMenu },
		{
			id: 'minimap',
			label: 'Show minimap',
			separator: true,
			checked: ui.showMinimap,
			onSelect: () => ui.setPref('showMinimap', !ui.showMinimap),
		},
	];
	// the admin panel exists only in development builds
	if (process.env.NODE_ENV === 'development') {
		items.push({
			id: 'admin',
			label: 'Show admin mode',
			checked: ui.showAdmin,
			onSelect: () => ui.setPref('showAdmin', !ui.showAdmin),
		});
	}
	return items;
};

/** Opens the menu at a screen position: the given entries first, then the global ones below a rule. */
export const openMenuAt = (
	x: number,
	y: number,
	title: string | undefined,
	own: ContextMenuItem[] = [],
	full = false
): void => {
	const global = globalMenuItems(full);
	if (own.length) global[0] = { ...global[0], separator: true };
	useUiStore.getState().openContextMenu({ x, y, title, items: [...own, ...global] });
};
