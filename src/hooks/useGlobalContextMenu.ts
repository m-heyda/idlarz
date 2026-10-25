import { useEffect } from 'react';
import { openMenuAt } from '@/lib/globalMenu';

/**
 * Takes over the right click for the whole page: the browser's own menu never shows (except in text fields, where paste still
 * works). A tile or bag slot that handled the click itself has already called preventDefault and opened its own menu; anything
 * else gets the global menu.
 */
export const useGlobalContextMenu = (): void => {
	useEffect(() => {
		const onContextMenu = (e: MouseEvent) => {
			if ((e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable="true"]')) return;
			if (e.defaultPrevented) return;
			e.preventDefault();
			openMenuAt(e.clientX, e.clientY, 'Menu');
		};
		document.addEventListener('contextmenu', onContextMenu);
		return () => document.removeEventListener('contextmenu', onContextMenu);
	}, []);
};
