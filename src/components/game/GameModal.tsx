import React, { useEffect, useRef } from 'react';
import { Modal } from '../../../packages/design-system/src/components/composites';

// Open modals, oldest first: Esc closes only the one on top (e.g. the hero picker over the Character window)
const openModals: symbol[] = [];

/** True while a real modal (a confirmation, settings ...) is open: Esc belongs to it before it belongs to a window */
export const hasOpenModal = (): boolean => openModals.length > 0;

/** Registers a modal while it is mounted and closes it on Esc when it is the top one (the shell of every game dialog, `GameModal`, uses this). */
export const useModalRegistry = (onClose: () => void): void => {
	const id = useRef(Symbol('modal')).current;
	useEffect(() => {
		openModals.push(id);
		return () => {
			const at = openModals.indexOf(id);
			if (at >= 0) openModals.splice(at, 1);
		};
	}, [id]);
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && openModals[openModals.length - 1] === id) onClose();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onClose, id]);
};

/**
 * A game dialog drawn with the design system's `Modal` (stone frame, flanked title, close button). It takes title, icon, size and onClose, and keeps the manners every dialog has: Esc closes only the top modal,
 * and while one is open Esc does not close the windows behind it.
 */
const GameModal: React.FC<{
	title: React.ReactNode;
	icon?: React.ReactNode;
	size?: 'sm' | 'md' | 'lg';
	width?: number;
	onClose: () => void;
	closeOnBackdrop?: boolean;
	hideClose?: boolean;
	children: React.ReactNode;
}> = ({ onClose, ...rest }) => {
	useModalRegistry(onClose);
	return <Modal onClose={onClose} {...rest} />;
};

export default GameModal;
