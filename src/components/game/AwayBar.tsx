import React from 'react';
import { cappedLine, offlineBar, type OfflineBarInput } from '@/lib/offlineBar';

/**
 * The away-time bar (IDL-64): the time counted against the cap ("6 h 20 m of 8 h"), the stone bar from the XP bar and, when the bank is full, how much time earned nothing. Static; the numbers come
 * from the server (the claim's grant in the welcome-back window, the `away` block of `/api/auth/me` on the landing page). The efficiency line and the Night Watch / Steward hint are left to the caller.
 */
const AwayBar: React.FC<OfflineBarInput & { className?: string }> = ({ className, ...input }) => {
	const bar = offlineBar(input);
	const capped = cappedLine(bar);
	return (
		<div className={`away-bar${bar.capped ? ' is-capped' : ''}${className ? ` ${className}` : ''}`}>
			<div className='away-bar-label'>Away {bar.label}</div>
			<div
				className='away-bar-track'
				role='progressbar'
				aria-label='Away time against the cap'
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round(bar.fraction * 100)}
				style={{ '--pct': bar.fraction * 100 } as React.CSSProperties}
			>
				<div className='away-bar-fill' />
			</div>
			{capped && <div className='away-bar-capped'>{capped}</div>}
		</div>
	);
};

export default AwayBar;
