import React, { useEffect, useState } from 'react';
import { AWAY_COUNT_MS, barDuration, cappedLine, countdownLeft, offlineBar, type OfflineBarInput } from '@/lib/offlineBar';

/** 1 until it has run, then counts down to 0; stays at 0 for a player who asked for reduced motion. */
const useCountdown = (enabled: boolean): number => {
	const [left, setLeft] = useState(1);
	useEffect(() => {
		if (!enabled) return;
		if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			setLeft(0);
			return;
		}
		let frame = 0;
		let start: number | null = null;
		const tick = (now: number) => {
			start ??= now;
			const value = countdownLeft(now - start, AWAY_COUNT_MS);
			setLeft(value);
			if (value > 0) frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [enabled]);
	return enabled ? left : 1;
};

/**
 * The away-time bar (IDL-64): the time counted against the cap ("6 h 20 m of 8 h"), the stone bar from the XP bar and, when the bank is full, how much time earned nothing. The numbers come
 * from the server (the claim's grant in the welcome-back window, the `away` block of `/api/auth/me` on the landing page). The efficiency line and the Night Watch / Steward hint are left to the caller.
 * With `countDown` (the welcome-back window) the bar starts at the time away and drains to empty while the label counts down, as if the time was being turned into the income listed below; without it the bar is static.
 */
const AwayBar: React.FC<OfflineBarInput & { className?: string; countDown?: boolean }> = ({ className, countDown = false, ...input }) => {
	const bar = offlineBar(input);
	const capped = cappedLine(bar);
	const left = useCountdown(countDown);
	const counted = Math.min(Math.max(0, input.gapSec), Math.max(0, input.capSec));
	const label = countDown ? `${barDuration(counted * left)} of ${barDuration(input.capSec)}` : bar.label;
	const fraction = bar.fraction * left;
	return (
		<div className={`away-bar${bar.capped ? ' is-capped' : ''}${className ? ` ${className}` : ''}`}>
			<div className='away-bar-label'>Away {label}</div>
			<div
				className='away-bar-track'
				role='progressbar'
				aria-label='Away time against the cap'
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round(fraction * 100)}
				style={{ '--pct': fraction * 100 } as React.CSSProperties}
			>
				<div className='away-bar-fill' />
			</div>
			{capped && <div className='away-bar-capped'>{capped}</div>}
		</div>
	);
};

export default AwayBar;
