import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { Box } from '@/lib/tipPlacement';
import { FloatingTip } from '../../ItemSlot';

/**
 * A small button with a hover card (the price, the gold a sale pays ...), in the look of the item hover cards. The wrapper takes the hover:
 * a disabled button swallows mouse events, and the card still says why it is off.
 */
export const TipButton: React.FC<{
	label: React.ReactNode;
	tip: React.ReactNode;
	onClick: () => void;
	disabled?: boolean;
	className?: string;
	ariaLabel?: string;
}> = ({ label, tip, onClick, disabled, className = 'px-btn px-btn-sm', ariaLabel }) => {
	const [anchor, setAnchor] = useState<Box | null>(null);
	return (
		<span
			className='tip-btn-wrap'
			onMouseEnter={(e) => {
				const { left, top, right, bottom } = e.currentTarget.getBoundingClientRect();
				setAnchor({ left, top, right, bottom });
			}}
			onMouseLeave={() => setAnchor(null)}>
			<button className={`${className} tip-btn`} disabled={disabled} aria-label={ariaLabel} onClick={onClick}>
				{label}
			</button>
			{anchor &&
				createPortal(
					<FloatingTip anchor={anchor}>
						<div className='px-tooltip text-sm'>{tip}</div>
					</FloatingTip>,
					document.body
				)}
		</span>
	);
};
