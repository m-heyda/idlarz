import React, { useEffect, useState } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { formatCompact, formatNumber, formatTime } from '@/utils/formatters';
import GameModal from '../GameModal';
import ResourceIcon from '../ResourceIcon';
import AwayBar from '../AwayBar';
import DailyBoard from '../DailyBoard';
import { useGameStore } from '@/stores/gameStore';
import { useGemStore } from '@/stores/gemStore';
import { offlineBar } from '@/lib/offlineBar';
import type { Resources } from '@/types/game';
import { Button, SectionLabel } from '../../../../packages/design-system/src/components/primitives';
import { RESOURCES } from '@/catalog';

const ORDER: (keyof Resources)[] = ['gold', 'wood', 'stone', 'coal', 'food', 'meat', 'eggs', 'milk', 'hide', 'wool', 'xp'];

/** Whether the away-time hint (Night Watch, Steward) is worth showing: only to a player who has been reborn and so owns the Ember shop. */
export const showsAwayHint = (rebirths: number): boolean => rebirths > 0;

/** "Hours as a number": 7.7 h, 30 min, so the cap and the time away read the same way. */
const hours = (seconds: number) => (seconds >= 3600 ? `${formatCompact(seconds / 3600, 1)} h` : formatTime(seconds));

/** A collapsible block of the welcome-back window: a header button with a chevron (and a short summary while closed), the body only while open. */
const Section: React.FC<{ title: string; open: boolean; onToggle: () => void; summary?: React.ReactNode; testId?: string; children: React.ReactNode }> = ({
	title,
	open,
	onToggle,
	summary,
	testId,
	children,
}) => (
	<section className='ds-listrow wb-section' data-open={open} data-testid={testId}>
		<button type='button' className='wb-section-head' aria-expanded={open} onClick={onToggle}>
			<span className='wb-chevron' aria-hidden='true'>
				{open ? '▾' : '▸'}
			</span>
			<SectionLabel>{title}</SectionLabel>
			{!open && summary ? <span className='wb-section-sum'>{summary}</span> : null}
		</button>
		{open && children}
	</section>
);

/**
 * The welcome-back window: how long the player was away (and the most the kingdom works for them), what it earned at which
 * efficiency, what finished and what arrived on the map. Everything shown is already applied; this only reports it.
 * Compact: the resources are always open, the other blocks fold. The daily bonus is a block of its own: open while today's bonus can be claimed, folded once it is claimed (the player can still toggle it).
 * Because it carries the daily bonus, `DailyBonusDialog` does not pop up a second time after this window.
 */
const OfflineDialog: React.FC = () => {
	const report = useUiStore((state) => state.offlineReport);
	const close = useUiStore((state) => state.closeOfflineReport);
	const rebirths = useGameStore((state) => state.prestige.rebirths);
	const daily = useGemStore((state) => state.info?.daily);
	const busy = useGemStore((state) => state.busy);
	// null = not toggled by the player yet, so the default for the block applies
	const [awayOpen, setAwayOpen] = useState<boolean | null>(null);
	const [dailyOpen, setDailyOpen] = useState<boolean | null>(null);
	const [eventsOpen, setEventsOpen] = useState<boolean | null>(null);
	const reportOpen = report !== null;

	useEffect(() => {
		if (reportOpen) void useGemStore.getState().refresh();
	}, [reportOpen]);

	if (!report) return null;
	const { grant } = report;
	const earned = ORDER.filter((key) => grant.resources[key] > 0);
	const awayIsOpen = awayOpen ?? true;
	const dailyIsOpen = dailyOpen ?? !!daily?.available;
	const eventsIsOpen = eventsOpen ?? true;
	const efficiencyPct = offlineBar(grant).efficiencyPct;

	return (
		<GameModal title='Welcome back!' width={600} onClose={close}>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
				<Section
					title='While you were away'
					open={awayIsOpen}
					onToggle={() => setAwayOpen(!awayIsOpen)}
					summary={`${hours(grant.gapSec)} away, ${efficiencyPct}% income`}
				>
					<div className='wb-away'>
						<div className='wb-hours'>{hours(grant.gapSec)}</div>
						<div className='wb-away-bar'>
							<AwayBar gapSec={grant.gapSec} capSec={grant.capSec} efficiency={grant.efficiency} countDown />
							<div className='ds-dim' style={{ fontSize: 11 }}>
								Your kingdom earns {efficiencyPct}% of its income while you are away
								{showsAwayHint(rebirths) && <div>Night Watch and Steward (Ember shop) raise the cap and the pay</div>}
							</div>
						</div>
					</div>
				</Section>

				{earned.length > 0 && (
					<div className='ds-listrow wb-section'>
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

				<Section
					title='Daily bonus'
					open={dailyIsOpen}
					onToggle={() => setDailyOpen(!dailyIsOpen)}
					summary={daily?.available ? 'Ready to claim' : daily ? 'Claimed today' : 'Checking...'}
					testId='offline-daily'
				>
					<DailyBoard bare daily={daily} busy={busy} onClaim={() => void useGemStore.getState().claimDaily()} />
				</Section>

				<Section title='What happened' open={eventsIsOpen} onToggle={() => setEventsOpen(!eventsIsOpen)}>
					<ul className='wb-events'>
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
				</Section>

				<div style={{ display: 'flex', justifyContent: 'center' }}>
					<Button tone='gold' style={{ minWidth: 180, minHeight: 36 }} onClick={close}>
						Continue
					</Button>
				</div>
			</div>
		</GameModal>
	);
};

export default OfflineDialog;
