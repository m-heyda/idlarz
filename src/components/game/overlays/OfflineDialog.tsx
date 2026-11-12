import React from 'react';
import { useUiStore } from '@/stores/uiStore';
import { formatCompact, formatNumber, formatTime } from '@/utils/formatters';
import GameModal from '../GameModal';
import ResourceIcon from '../ResourceIcon';
import AwayBar from '../AwayBar';
import { useGameStore } from '@/stores/gameStore';
import { offlineBar } from '@/lib/offlineBar';
import type { Resources } from '@/types/game';
import { Button } from '../../../../packages/design-system/src/components/primitives';

const ORDER: (keyof Resources)[] = ['gold', 'wood', 'stone', 'coal', 'food', 'meat', 'eggs', 'milk', 'hide', 'wool', 'xp'];

/** Whether the away-time hint (Night Watch, Steward) is worth showing: only to a player who has been reborn and so owns the Ember shop. */
export const showsAwayHint = (rebirths: number): boolean => rebirths > 0;

/** "Hours as a number": 7.7 h, 30 min, so the cap and the time away read the same way. */
const hours = (seconds: number) => (seconds >= 3600 ? `${formatCompact(seconds / 3600, 1)} h` : formatTime(seconds));

/**
 * The welcome-back window: how long the player was away (and the most the kingdom works for them), what it earned at which
 * efficiency, what finished and what arrived on the map. Everything shown is already applied; this only reports it.
 */
const OfflineDialog: React.FC = () => {
	const report = useUiStore((state) => state.offlineReport);
	const close = useUiStore((state) => state.closeOfflineReport);
	const rebirths = useGameStore((state) => state.prestige.rebirths);
	if (!report) return null;
	const { grant } = report;
	const earned = ORDER.filter((key) => grant.resources[key] > 0);

	return (
		<GameModal title='Welcome back!' size='md' onClose={close}>
			<div className='flex flex-col gap-5 px-3 pb-2 pt-1 text-base'>
				<div className='text-center'>
					<div className='text-[#a89878]'>While you were away</div>
					<div className='text-3xl text-[#f0d27a] tabular-nums mt-1'>{hours(grant.gapSec)}</div>
				</div>

				<AwayBar gapSec={grant.gapSec} capSec={grant.capSec} efficiency={grant.efficiency} countDown />
				<div className='text-center text-sm text-[#7a6a52] -mt-2'>
					Your kingdom earns {offlineBar(grant).efficiencyPct}% of its income while you are away
					{showsAwayHint(rebirths) && <div className='text-[#a89878]'>Night Watch and Steward (Ember shop) raise the cap and the pay</div>}
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

				<ul className='flex flex-col gap-1.5 text-center text-[#ecdcb4]'>
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

				<div className='flex justify-center'>
					<Button tone='gold' onClick={close}>
						Continue
					</Button>
				</div>
			</div>
		</GameModal>
	);
};

export default OfflineDialog;
