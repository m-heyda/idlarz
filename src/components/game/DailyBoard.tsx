import React from 'react';
import { DAILY_BONUS_GEMS } from '@/config/gemShop';
import type { DailyInfo } from '@/lib/offline/gemTypes';
import GemIcon from './GemIcon';
import { Button } from '../../../packages/design-system/src/components/primitives';

/** The line under the board's title: what today pays, or when to come back. */
const dailyLine = (daily: DailyInfo | undefined): string => {
	if (!daily) return 'Checking...';
	const last = DAILY_BONUS_GEMS.length;
	return daily.available
		? `Day ${daily.step} of ${last}: +${daily.gems} gems. Come back every day: day ${last} pays the most.`
		: `Claimed today. Come back tomorrow (UTC); day ${last} pays the most. A missed day starts the week again.`;
};

/**
 * The 7-day daily bonus board, shared by the Gem shop and the daily bonus window: one cell per day of the ladder (`DAILY_BONUS_GEMS`), past days dimmed as claimed, today with a Claim button, later days locked, and day 7 marked as the bonus.
 * It only shows what the server's last answer (`daily`) says; `onClaim` asks the server to pay today's day.
 */
const DailyBoard: React.FC<{ daily: DailyInfo | undefined; busy: boolean; onClaim: () => void }> = ({ daily, busy, onClaim }) => (
	<div className='flex flex-col gap-2 px-3 py-3 border border-[#4a3a26] bg-[#2a2012]' data-testid='gem-daily'>
		<div className='min-w-0'>
			<div className='font-semibold text-[#ecdcb4]'>Welcome back! Daily bonus</div>
			<div className='text-xs text-[#a89878]'>{dailyLine(daily)}</div>
		</div>
		<ol className='grid grid-cols-7 gap-1.5'>
			{DAILY_BONUS_GEMS.map((gemsPaid, i) => {
				const day = i + 1;
				const done = !!daily && day < (daily.available ? daily.step : daily.step + 1);
				const today = !!daily?.available && day === daily.step;
				const last = day === DAILY_BONUS_GEMS.length;
				return (
					<li
						key={day}
						data-state={done ? 'done' : today ? 'today' : 'later'}
						className={`flex flex-col items-center gap-1 px-1 py-2 border text-center ${
							today ? 'border-[#f0d27a] bg-[#3a2c14]' : last ? 'border-[#9a7aff] bg-[#1f1830]' : 'border-[#4a3a26] bg-[#1a140c]'
						} ${done ? 'opacity-50' : ''}`}
					>
						<span className='text-[10px] uppercase tracking-wide text-[#a89878]'>{last ? 'Day 7 bonus' : `Day ${day}`}</span>
						<span className={`flex items-center gap-1 tabular-nums text-sm ${last ? 'text-[#c8b0ff]' : 'text-[#f1e6c8]'}`}>
							+{gemsPaid} <GemIcon />
						</span>
						{today ? (
							<Button tone='gold' size='sm' disabled={busy} onClick={onClaim}>
								Claim
							</Button>
						) : (
							<span className='text-[10px] text-[#7a6a52]'>{done ? 'Claimed' : 'Locked'}</span>
						)}
					</li>
				);
			})}
		</ol>
	</div>
);

export default DailyBoard;
