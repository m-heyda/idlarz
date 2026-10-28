import React from 'react';
import { cn } from '@/lib/utils';

interface HeaderTipProps {
	/** Which edge of the control the card lines up with: the first chips and the avatar sit at the left edge of the screen, the buttons at the right */
	align?: 'center' | 'start' | 'end';
	/** Card width in px */
	width?: number;
	children: React.ReactNode;
}

/**
 * The hover card of a header control, in the same skin as every other tooltip (.px-tooltip). Put it as a direct child of an
 * element with the `hdr-has-tip` class: it shows while that element is hovered or has data-pinned="true".
 */
const HeaderTip: React.FC<HeaderTipProps> = ({ align = 'center', width = 220, children }) => (
	<div className={cn('hdr-tip', align === 'start' && 'hdr-tip--start', align === 'end' && 'hdr-tip--end')} role='tooltip'>
		<div className='px-tooltip text-sm' style={{ width }}>
			{children}
		</div>
	</div>
);

/** One "label ... value" row of a header tooltip */
export const TipLine: React.FC<{ label: string; value: React.ReactNode; accent?: boolean }> = ({ label, value, accent }) => (
	<div className={cn('flex justify-between gap-4', accent && 'text-[#f0d27a]')}>
		<span className={accent ? '' : 'px-tip-muted'}>{label}</span>
		<span>{value}</span>
	</div>
);

export default HeaderTip;
