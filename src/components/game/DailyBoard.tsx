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
		? `Day ${daily.step} of ${last}: +${daily.gems} gems${daily.step === last ? ' and a chest of materials' : ''}. Come back every day: day ${last} pays the most.`
		: `Claimed today. Come back tomorrow (UTC); day ${last} pays the most (gems and a chest of materials). A missed day starts the week again.`;
};

/**
 * The 7-day daily bonus board, shared by the Gem shop and the daily bonus window: one cell per day of the ladder (`DAILY_BONUS_GEMS`), past days dimmed as claimed, today with a Claim button, later days locked, and day 7 marked as the bonus.
 * `bare` drops the frame and title (the welcome-back window supplies its own section header). It only shows what the server's last answer (`daily`) says; `onClaim` asks the server to pay today's day.
 */
const DailyBoard: React.FC<{ daily: DailyInfo | undefined; busy: boolean; onClaim: () => void; bare?: boolean }> = ({ daily, busy, onClaim, bare }) => (
	<div className={bare ? 'flex flex-col' : 'ds-listrow'} data-testid='gem-daily' style={{ gap: 12 }}>
		<div className='min-w-0'>
			{!bare && <SectionLabel>Welcome back! Daily bonus</SectionLabel>}
			<div className='ds-dim' style={{ fontSize: 12, marginTop: bare ? 0 : 4 }}>
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
						<div className='dd-day-top'>
							<span className='dd-day-name'>{last ? 'Day 7 bonus' : `Day ${day}`}</span>
							{done ? (
								<span className='dd-day-check' aria-label='Claimed'>
									✓
								</span>
							) : null}
						</div>
						<div className='dd-day-body'>
							{last ? (
								<span className='dd-day-chest' role='img' aria-label='A gift of materials on top of the gems' title='A chest of materials on top of the gems' />
							) : null}
							<div className='dd-day-prize'>
								<span className='dd-day-gems'>
									+{gemsPaid} <GemIcon scale={0.75} />
								</span>
								{last ? <span className='dd-day-extra'>+ chest of materials</span> : null}
							</div>
						</div>
						{today ? (
							<Button tone='gold' size='sm' disabled={busy} onClick={onClaim} style={{ width: '100%' }}>
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
