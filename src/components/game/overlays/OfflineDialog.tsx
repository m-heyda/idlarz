import React from 'react';
import { useUiStore } from '@/stores/uiStore';
import { formatCompact, formatNumber, formatTime } from '@/utils/formatters';
import PixelModal from '../PixelModal';
import ResourceIcon from '../ResourceIcon';
import GemIcon from '../GemIcon';
import type { Resources } from '@/types/game';

const ORDER: (keyof Resources)[] = ['gold', 'wood', 'stone', 'coal', 'food', 'meat', 'eggs', 'milk', 'hide', 'xp'];

/** "Hours as a number": 7.7 h, 30 min, so the cap and the time away read the same way. */
const hours = (seconds: number) => (seconds >= 3600 ? `${formatCompact(seconds / 3600, 1)} h` : formatTime(seconds));

/**
 * The welcome-back window: how long the player was away (and the most the kingdom works for them), what it earned at which
 * efficiency, what finished and what arrived on the map. Everything shown is already applied; this only reports it.
 */
const OfflineDialog: React.FC = () => {
	const report = useUiStore((state) => state.offlineReport);
	const close = useUiStore((state) => state.closeOfflineReport);
	if (!report) return null;
	const { grant } = report;
	const earned = ORDER.filter((key) => grant.resources[key] > 0);

	return (
		<PixelModal title='Welcome back!' size='sm' onClose={close}>
			<div className='px-card text-sm space-y-3'>
				<div className='text-center'>
					<div className='text-[#a89878]'>While you were away</div>
					<div className='text-2xl text-[#f0d27a] tabular-nums'>{hours(grant.gapSec)}</div>
					<div className='text-xs text-[#7a6a52]'>
						your kingdom works for up to {hours(grant.capSec)} at {Math.round(grant.efficiency * 100)}% of its income
						{grant.capped && <span className='text-[#d9a05a]'> - you were away longer than that</span>}
					</div>
				</div>

				{earned.length > 0 && (
					<div>
						<div className='text-[#a89878] mb-1'>Your kingdom earned</div>
						<div className='grid grid-cols-2 gap-x-4 gap-y-1'>
							{earned.map((key) => (
								<div key={key} className='flex items-center justify-between gap-2'>
									<span className='inline-flex items-center gap-1 text-[#d8c8a0]'>
										<ResourceIcon resource={key} /> {key === 'xp' ? 'XP' : key}
									</span>
									<span className='tabular-nums text-green-300'>+{formatNumber(grant.resources[key])}</span>
								</div>
							))}
						</div>
					</div>
				)}

				<ul className='space-y-1 text-[#ecdcb4]'>
					{report.levelsGained > 0 && (
						<li>
							You reached <span className='text-[#f0d27a]'>level +{report.levelsGained}</span> (stat points to spend)
						</li>
					)}
					{report.castleReached !== null && (
						<li>
							The castle upgrade finished: <span className='text-[#f0d27a]'>level {report.castleReached}</span>
						</li>
					)}
					{report.chestsPlaced > 0 && (
						<li>
							<span className='text-[#f0d27a]'>{report.chestsPlaced}</span> chest{report.chestsPlaced === 1 ? '' : 's'} appeared on your land
						</li>
					)}
					{report.monstersPlaced > 0 && (
						<li>
							<span className='text-[#f0d27a]'>{report.monstersPlaced}</span> monster{report.monstersPlaced === 1 ? '' : 's'} arrived (the strongest is level{' '}
							{formatCompact(report.strongestMonster)}), and the ones already there grew stronger
						</li>
					)}
					{report.monstersPlaced === 0 && <li className='text-[#a89878]'>The monsters on your land grew stronger while you were away</li>}
				</ul>

				<div className='flex items-center justify-between'>
					<span className='inline-flex items-center gap-1 text-[#a89878]'>
						<GemIcon /> {formatNumber(report.gems)} gems
					</span>
					<button className='px-btn px-btn-gold' onClick={close}>
						Continue
					</button>
				</div>
			</div>
		</PixelModal>
	);
};

export default OfflineDialog;
