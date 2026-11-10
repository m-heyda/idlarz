import React, { useEffect, useState } from 'react';
import type { RebirthEntry } from '@/lib/cloudSave/rebirthHistory';
import { fetchRebirths } from '@/lib/rebirthClient';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatCompact, formatNumber, formatRate, formatTime } from '@/utils/formatters';

const date = (iso: string) => {
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/** One run as a card: the headline numbers of the run that ended with this rebirth. */
const Run: React.FC<{ entry: RebirthEntry; latest: boolean }> = ({ entry, latest }) => (
	<div className='px-card text-xs' data-latest={latest}>
		<div className='flex items-baseline justify-between gap-3 mb-1'>
			<span className='px-tip-title'>
				Rebirth {formatNumber(entry.rebirthNo)}
				{latest && <span className='ml-2 text-[#9be26a] normal-case'>last run</span>}
			</span>
			<span className='text-[#a89878]'>{date(entry.at)}</span>
		</div>
		<div className='grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-0.5'>
			<Stat label='Tiles' value={formatCompact(entry.tiles)} />
			<Stat label='Castle' value={`level ${entry.castleLevel}`} />
			<Stat label='Gold income' value={formatRate(entry.goldPerSec)} tone='text-yellow-300' />
			<Stat label='Gold held' value={formatNumber(entry.gold)} tone='text-yellow-400' />
			<Stat label='Run time' value={formatTime(entry.runSeconds)} />
			<Stat label='Level' value={formatCompact(entry.level)} />
			<Stat label='Click level' value={String(entry.clickLevel + 1)} />
			<Stat label='Embers gained' value={`+${formatCompact(entry.embersGained)}`} tone='text-purple-300' />
		</div>
	</div>
);

const Stat: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone = 'text-[#ecdcb4]' }) => (
	<div className='flex justify-between gap-2'>
		<span className='text-[#a89878]'>{label}</span>
		<span className={`tabular-nums ${tone}`}>{value}</span>
	</div>
);

/**
 * The Rebirths tab of the Character window: every rebirth the account did, newest first, with what the run that ended had (tiles,
 * income, castle, time) and what it paid. The server writes the history when it accepts a save that shows a new rebirth.
 */
const RebirthsPanel: React.FC = () => {
	const rebirths = useGameStore((state) => state.prestige.rebirths);
	const toggleRebirth = useUiStore((state) => state.toggleRebirth);
	// loaded when the tab opens, and again when a rebirth happens while it is open (the server writes it with the next save)
	const [entries, setEntries] = useState<RebirthEntry[] | null | undefined>(undefined);
	useEffect(() => {
		let live = true;
		void fetchRebirths().then((result) => live && setEntries(result));
		return () => {
			live = false;
		};
	}, [rebirths]);

	return (
		<div className='flex flex-col gap-3'>
			<div className='flex items-center justify-between gap-3 text-xs'>
				<span className='text-[#a89878]'>Every rebirth you did, with what that run had reached when it ended.</span>
				<button className='px-btn px-btn-sm' onClick={toggleRebirth}>
					Rebirth window
				</button>
			</div>
			{entries === undefined && <p className='text-xs text-[#a89878]'>Loading...</p>}
			{entries === null && <p className='text-xs text-[#a89878]'>The history could not be loaded. Check your connection and open this tab again.</p>}
			{entries && entries.length === 0 && (
				<p className='text-xs text-[#a89878]'>
					{rebirths > 0
						? 'Rebirths from before the history existed are not listed. The next one will be.'
						: 'No rebirth yet. Your runs are listed here once you start over.'}
				</p>
			)}
			{entries?.map((entry, index) => <Run key={entry.rebirthNo} entry={entry} latest={index === 0} />)}
		</div>
	);
};

export default RebirthsPanel;
