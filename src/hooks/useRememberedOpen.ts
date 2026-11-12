import { useState } from 'react';
import { scoped } from '@/lib/storageScope';

const storageKey = (id: string) => scoped(`idlarz.section.${id}`);

const readOpen = (id: string, defaultOpen: boolean): boolean => {
	try {
		const stored = localStorage.getItem(storageKey(id));
		return stored === null ? defaultOpen : stored !== 'closed';
	} catch {
		return defaultOpen;
	}
};

/**
 * Whether a folding block is open, remembered per `id` in this browser (the same keys the old Character window used, so a player's choices carry over). `defaultOpen` is what a first visit sees. Returns the state and a toggle.
 */
export const useRememberedOpen = (id: string, defaultOpen = true): [boolean, () => void] => {
	const [open, setOpen] = useState(() => readOpen(id, defaultOpen));
	const toggle = () => {
		const next = !open;
		setOpen(next);
		try {
			localStorage.setItem(storageKey(id), next ? 'open' : 'closed');
		} catch {
			// storage unavailable: the block still folds for this visit
		}
	};
	return [open, toggle];
};
