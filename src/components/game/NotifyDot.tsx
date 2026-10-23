import React from 'react';
import { cn } from '@/lib/utils';

interface NotifyDotProps {
	/** Render nothing when false, so callers can pass the condition straight through */
	show?: boolean;
	/** Screen-reader text; the dot is purely visual otherwise */
	label?: string;
	className?: string;
}

/**
 * The universal "something needs your attention" marker: a small, softly pulsing orange dot pinned to the top-right corner
 * of its nearest positioned ancestor (unspent stat points and affordable farm animals today; unclaimed rewards etc.
 * can reuse it). Only put it on header-level controls, never inside the windows they open.
 */
const NotifyDot: React.FC<NotifyDotProps> = ({ show = true, label = 'Needs attention', className }) => {
	if (!show) return null;
	return <i className={cn('notify-dot', className)} role='img' aria-label={label} />;
};

export default NotifyDot;
