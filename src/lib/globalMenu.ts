import { useGameStore } from '@/stores/gameStore';
import { useUiStore, type ContextMenuItem } from '@/stores/uiStore';
import { pickPersisted } from '@/lib/sanitizeSave';
import { exportSaveText, saveNow } from '@/lib/saveStorage';
import { copyText } from '@/lib/clipboard';
import { cloudHint, manualSaveMessage, saveGameEverywhere } from '@/lib/manualCloudSave';

/** Saves to this browser and, with an account signed in, to the cloud copy too (once every 10 minutes: the entry's hint counts it down). */
const saveGame = async () => {
	const result = await saveGameEverywhere({ saveLocal: () => saveNow(pickPersisted(useGameStore.getState())), now: () => Date.now() });
	useUiStore.getState().showToast(manualSaveMessage(result));
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
	const { combat } = useGameStore.getState();
	const items: ContextMenuItem[] = [
		...(full
			? [
					{ id: 'settings', label: 'Settings', onSelect: ui.toggleSettings },
					{ id: 'guide', label: 'Guide', onSelect: ui.openTutorial },
				]
			: []),
		{
			id: 'organize',
			label: 'Organize bag',
			onSelect: () => useUiStore.getState().showToast(useGameStore.getState().organizeBag() ? 'Bag organized' : 'Finish the fight first'),
		},
		{ id: 'save', label: 'Save game', separator: full, liveHint: () => cloudHint(Date.now()), onSelect: () => void saveGame() },
		{ id: 'export', label: 'Export game save', onSelect: () => void exportGame() },
		{ id: 'import', label: 'Import / backup...', onSelect: ui.toggleSaveMenu },
		// the battle switches are a section of their own, at the bottom above the view options (the combat window only shows during a fight;
		// a click on a monster starts a fight either way)
		{
			id: 'autoBattle',
			label: 'Auto-battle',
			separator: true,
			hint: 'monsters one by one',
			checked: combat.autoBattle,
			onSelect: () => useGameStore.getState().setAutoBattle(!combat.autoBattle),
		},
		{
			id: 'autoUse',
			label: 'Auto-use potions',
			hint: 'and skills',
			checked: combat.autoUse,
			onSelect: () => useGameStore.getState().setAutoUse(!combat.autoUse),
		},
		{
			id: 'minimap',
			label: 'Show minimap',
			separator: true,
			checked: ui.showMinimap,
			onSelect: () => ui.setPref('showMinimap', !ui.showMinimap),
		},
		{
			id: 'compactHeader',
			label: 'Show compact header',
			hint: 'icons only',
			checked: ui.compactHeader,
			onSelect: () => ui.setPref('compactHeader', !ui.compactHeader),
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
