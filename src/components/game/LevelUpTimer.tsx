import React, { useState, useEffect } from 'react';
import { formatTime, formatRate } from '@/utils/formatters';
import { xpBarOf } from '@/lib/xpBar';

// Level Up Timer Component that updates every second
export const LevelUpTimer: React.FC<{
	resourceRates: {
		total: {
			xp: number;
		};
	};
	resources: { xp: number };
	level: { level: number; progress: number };
}> = ({ resourceRates, resources, level }) => {
	const [timeRemaining, setTimeRemaining] = useState('Calculating...');
	const [next, setNext] = useState('level up');

	useEffect(() => {
		const updateTimer = () => {
			// Get current XP rate
			const xpRate = resourceRates?.total?.xp || 0;
			const bar = xpBarOf(level, resources.xp);
			setNext(bar.next);
			if (bar.track === 'paragon' && bar.remaining === 0) {
				setTimeRemaining('Max level');
				return;
			}
			if (xpRate <= 0) {
				setTimeRemaining('∞');
				return;
			}

			// Calculate time in seconds (the XP still to go in this level, or in this paragon level past level 100)
			const timeInSeconds = bar.remaining / xpRate;

			// Format the time
			setTimeRemaining(formatTime(timeInSeconds));
		};

		// Update immediately and set interval
		updateTimer();
		const timer = setInterval(updateTimer, 1000);
		return () => clearInterval(timer);
	}, [resourceRates, resources.xp, level]);

	return (
		<div className='mt-0 text-center text-xs'>
			<span className='text-green-400 mb-3 block'>{formatRate(resourceRates?.total?.xp || 0)} (XP)</span>
			<div className='text-gray-400 mb-0.5 block'>Time until {next}</div>
			<div className='text-yellow-400 text-sm font-medium'>{timeRemaining}</div>
		</div>
	);
};
