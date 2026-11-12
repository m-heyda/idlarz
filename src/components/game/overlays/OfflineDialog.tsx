import React from 'react';
import { useUiStore } from '@/stores/uiStore';
import { formatCompact, formatNumber, formatTime } from '@/utils/formatters';
import GameModal from '../GameModal';
import ResourceIcon from '../ResourceIcon';
import AwayBar from '../AwayBar';
import { useGameStore } from '@/stores/gameStore';
import { offlineBar } from '@/lib/offlineBar';
import type { Resources } from '@/types/game';
import { Button, SectionLabel } from '../../../../packages/design-system/src/components/primitives';
import { RESOURCES } from '@/catalog';

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
		<GameModal title='Welcome back!' width={600} onClose={close}>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
				<div className='ds-listrow' style={{ alignItems: 'center', textAlign: 'center' }}>
					<SectionLabel>While you were away</SectionLabel>
					<div className='wb-hours'>{hours(grant.gapSec)}</div>
					<AwayBar gapSec={grant.gapSec} capSec={grant.capSec} efficiency={grant.efficiency} countDown />
					<div className='ds-dim' style={{ fontSize: 12 }}>
						Your kingdom earns {offlineBar(grant).efficiencyPct}% of its income while you are away
						{showsAwayHint(rebirths) && <div>Night Watch and Steward (Ember shop) raise the cap and the pay</div>}
					</div>
				</div>

				{earned.length > 0 && (
					<div className='ds-listrow'>
						<SectionLabel>Your kingdom earned</SectionLabel>
						<div className='wb-earned'>
							{earned.map((key) => (
								<div key={key} className='wb-earned-row'>
									<span className='wb-res'>
										<ResourceIcon resource={key} /> {key === 'xp' ? 'XP' : (RESOURCES[key]?.label ?? key)}
									</span>
									<span className='wb-gain'>+{formatNumber(grant.resources[key])}</span>
								</div>
							))}
						</div>
					</div>
				)}

				<ul className='ds-listrow wb-events'>
					{report.levelsGained > 0 && (
						<li>
							You reached <b>level +{report.levelsGained}</b> (stat points to spend)
						</li>
					)}
					{report.castleReached !== null && (
						<li>
							The castle upgrade finished: <b>level {report.castleReached}</b>
						</li>
					)}
					{report.chestsPlaced > 0 && (
						<li>
							<b>{report.chestsPlaced}</b> chest{report.chestsPlaced === 1 ? '' : 's'} appeared on your land
						</li>
					)}
					{report.monstersPlaced > 0 && (
						<li>
							<b>{report.monstersPlaced}</b> monster{report.monstersPlaced === 1 ? '' : 's'} arrived (the strongest is level{' '}
							{formatCompact(report.strongestMonster)}), and the ones already there grew stronger
						</li>
					)}
					{report.monstersPlaced === 0 && <li className='ds-dim'>The monsters on your land grew stronger while you were away</li>}
				</ul>

				<div style={{ display: 'flex', justifyContent: 'center' }}>
					<Button tone='gold' style={{ minWidth: 200, minHeight: 44 }} onClick={close}>
						Continue
					</Button>
				</div>
			</div>
		</GameModal>
	);
};

export default OfflineDialog;
