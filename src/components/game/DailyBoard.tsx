import React from 'react';
import { DAILY_BONUS_GEMS } from '@/config/gemShop';
import type { DailyInfo } from '@/lib/offline/gemTypes';
import GemIcon from './GemIcon';
import { Button, SectionLabel } from '../../../packages/design-system/src/components/primitives';

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
	<div className='ds-listrow' data-testid='gem-daily' style={{ gap: 12 }}>
		<div className='min-w-0'>
			<SectionLabel>Welcome back! Daily bonus</SectionLabel>
			<div className='ds-dim' style={{ fontSize: 12, marginTop: 4 }}>
				{dailyLine(daily)}
			</div>
		</div>
		<ol className='dd-days'>
			{DAILY_BONUS_GEMS.map((gemsPaid, i) => {
				const day = i + 1;
				const done = !!daily && day < (daily.available ? daily.step : daily.step + 1);
				const today = !!daily?.available && day === daily.step;
				const last = day === DAILY_BONUS_GEMS.length;
				return (
					<li key={day} className='dd-day' data-state={done ? 'done' : today ? 'today' : 'later'} data-last={last}>
						<span className='dd-day-name'>{last ? 'Day 7 bonus' : `Day ${day}`}</span>
						<span className='dd-day-gems'>
							+{gemsPaid} <GemIcon />
						</span>
						{today ? (
							<Button tone='gold' size='sm' disabled={busy} onClick={onClaim}>
								Claim
							</Button>
						) : (
							<span className='dd-day-note'>{done ? 'Claimed' : 'Locked'}</span>
						)}
					</li>
				);
			})}
		</ol>
	</div>
);

export default DailyBoard;
