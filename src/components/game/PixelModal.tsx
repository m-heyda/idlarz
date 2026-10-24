import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

// Open modals, oldest first: Esc closes only the one on top (e.g. the hero picker over the Character window)
const openModals: symbol[] = [];

interface PixelModalProps {
	title: React.ReactNode;
	icon?: React.ReactNode;
	onClose: () => void;
	/** sm 440px (confirmations), md 760px (pickers), lg 1080px x full height (windows) */
	size?: 'sm' | 'md' | 'lg';
	closeOnBackdrop?: boolean;
	hideClose?: boolean;
	className?: string;
	/** No body padding or scrolling: the content fills the whole window (the farm scene) */
	flush?: boolean;
	children: React.ReactNode;
}

/**
 * The one modal shell: bronze 9-slice frame over cracked stone, ornamented title bar, pixel close
 * button, Esc / backdrop to dismiss. Every window and dialog uses it so size and feel stay unified.
 */
const PixelModal: React.FC<PixelModalProps> = ({
	title,
	icon,
	onClose,
	size = 'md',
	closeOnBackdrop = true,
	hideClose = false,
	className,
	flush = false,
	children,
}) => {
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

	return (
		<div
			className='px-backdrop'
			onMouseDown={(e) => {
				if (closeOnBackdrop && e.target === e.currentTarget) onClose();
			}}>
			<div
				className={cn('px-modal', `px-modal-${size}`, className)}
				role='dialog'
				aria-modal='true'>
				{!hideClose && (
					<button className='px-close' onClick={onClose} aria-label='Close'>
						✕
					</button>
				)}
				<div className='px-modal-head'>
					<span className='px-title-line' />
					<h2 className='px-title'>
						{icon}
						{title}
					</h2>
					<span className='px-title-line rev' />
				</div>
				<div className={cn('px-modal-body', flush && 'px-modal-body-flush')}>{children}</div>
			</div>
		</div>
	);
};

export default PixelModal;
