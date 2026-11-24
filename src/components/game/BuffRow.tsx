import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { BUFF_FAMILIES } from '@/catalog/buffs';

/** More buffs than this fold into one "Buffs (N)" line (IDL-157) */
const COLLAPSE_ABOVE = 3;

const clock = (sec: number): string => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** The potion buffs running, each with the time left (the server's list from the last combat answer, counted down by this browser's clock). */
const BuffRow: React.FC = () => {
	const buffs = useGameStore((state) => state.combat.buffs);
	const [nowSec, setNowSec] = React.useState(() => Date.now() / 1000);
	React.useEffect(() => {
		if (buffs.length === 0) return;
		const timer = setInterval(() => setNowSec(Date.now() / 1000), 1000);
		return () => clearInterval(timer);
	}, [buffs.length]);
	const [open, setOpen] = React.useState(false);
	const running = buffs.filter((buff) => buff.untilSec > nowSec);
	if (running.length === 0) return null;
	// more than three buffs: one line ("Buffs (5)") that opens the list on a click, so the combat window stays calm
	const collapsed = running.length > COLLAPSE_ABOVE && !open;
	return (
		<div className='flex flex-wrap items-center justify-center gap-x-3 text-xs px-tip-muted mb-2' aria-label='Active potion effects'>
			{collapsed ? (
				<button type='button' className='underline decoration-dotted' onClick={() => setOpen(true)} title='Show every active potion effect'>
					Buffs ({running.length})
				</button>
			) : (
				<>
					{running.map((buff) => (
						<span key={buff.family}>
							{BUFF_FAMILIES[buff.family].label} +{buff.amount}% {clock(buff.untilSec - nowSec)}
						</span>
					))}
					{running.length > COLLAPSE_ABOVE && (
						<button type='button' className='underline decoration-dotted' onClick={() => setOpen(false)} title='Collapse the list'>
							Hide
						</button>
					)}
				</>
			)}
		</div>
	);
};

export default BuffRow;
