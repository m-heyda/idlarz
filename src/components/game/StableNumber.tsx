import React from 'react';
import { cn } from '@/lib/utils';

interface StableNumberProps {
	value: string;
	className?: string;
	/** Reserve room for at least this much text (CSS length), so a short number does not make the chip shrink and grow */
	minWidth?: string;
}

// Cell widths in em. Every character sits in a fixed cell, so a counter that ticks (1.99K -> 2.00K, 9 -> 10) only changes
// the glyphs inside its cells and never moves its neighbours.
const DIGIT_CELL = 'w-[0.62em]';
const POINT_CELL = 'w-[0.3em]';
const LETTER_CELL = 'w-[0.72em]';

const cellOf = (char: string) => (/\d/.test(char) ? DIGIT_CELL : char === '.' ? POINT_CELL : /[A-Za-z]/.test(char) ? LETTER_CELL : null);

/** Renders a pre-formatted number with every character in a fixed-width cell (and optionally in a fixed-width slot). */
const StableNumber: React.FC<StableNumberProps> = ({ value, className, minWidth }) => (
	<span className={cn('inline-flex whitespace-pre', className)} style={minWidth ? { minWidth } : undefined} aria-label={value}>
		{value.split('').map((char, i) => {
			const cell = cellOf(char);
			return cell ? (
				<span key={i} className={cn('inline-block text-center', cell)} aria-hidden>
					{char}
				</span>
			) : (
				<span key={i} aria-hidden>
					{char}
				</span>
			);
		})}
	</span>
);

export default StableNumber;
