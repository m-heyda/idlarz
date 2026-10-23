import React from 'react';
import { cn } from '@/lib/utils';
import NotifyDot from './NotifyDot';

interface LevelOrbProps {
	/** The level shown inside the orb; leave out for a plain orb */
	level?: number | string;
	/** Integer multiple of the 24px sprite */
	scale?: number;
	/** Pins the notify dot to the orb (e.g. unassigned stat points) */
	notify?: boolean;
	notifyLabel?: string;
	className?: string;
}

/**
 * The purple level orb: a 6-frame glass sprite (sweep + glint) stepped through with CSS, the level number
 * centred in its dark socket. The same orb is the XP icon across the app.
 */
const LevelOrb: React.FC<LevelOrbProps> = ({ level, scale = 1, notify, notifyLabel, className }) => (
	<span
		className={cn('level-orb', className)}
		style={{ '--s': scale } as React.CSSProperties}
		data-digits={level === undefined ? 0 : String(level).length}
		role='img'
		aria-label={level === undefined ? 'Level' : `Level ${level}`}>
		{level !== undefined && <span className='level-orb-num'>{level}</span>}
		<NotifyDot show={!!notify} label={notifyLabel} />
	</span>
);

export default LevelOrb;
