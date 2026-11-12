import React from 'react';
import { Modal } from '../../../packages/design-system/src/components/composites';
import { useModalRegistry } from './PixelModal';

/**
 * A game dialog drawn with the design system's `Modal` (stone frame, flanked title, close button). It takes the same props as the old `PixelModal` that matter (title, icon, size, onClose) and keeps its manners: Esc closes only the top modal,
 * and while one is open Esc does not close the windows behind it.
 */
const GameModal: React.FC<{
	title: React.ReactNode;
	icon?: React.ReactNode;
	size?: 'sm' | 'md' | 'lg';
	width?: number;
	onClose: () => void;
	closeOnBackdrop?: boolean;
	children: React.ReactNode;
}> = ({ onClose, ...rest }) => {
	useModalRegistry(onClose);
	return <Modal onClose={onClose} {...rest} />;
};

export default GameModal;
