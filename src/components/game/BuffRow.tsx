import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { BUFF_FAMILIES } from '@/catalog/buffs';

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
	const running = buffs.filter((buff) => buff.untilSec > nowSec);
	if (running.length === 0) return null;
	return (
		<div className='flex flex-wrap justify-center gap-x-3 text-xs px-tip-muted mb-2' aria-label='Active potion effects'>
			{running.map((buff) => (
				<span key={buff.family}>
					{BUFF_FAMILIES[buff.family].label} +{buff.amount}% {clock(buff.untilSec - nowSec)}
				</span>
			))}
		</div>
	);
};

export default BuffRow;
