import React, { useEffect, useRef } from 'react';
import ResourceDisplay from './ResourceDisplay';
import { PlayerCard, HeaderButtons } from './HeaderMenu';
import { useClickIncome } from '@/hooks/useClickIncome';

/**
 * One compact row: player card, every currency as a small chip (wrapping to a second row on narrow screens) and the
 * Menu / Legacy / Settings buttons. The real height is published as --header-h so windows and toasts sit below it.
 */
const GameHeader: React.FC = () => {
	useClickIncome();
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const publish = () => document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`);
		publish();
		const observer = new ResizeObserver(publish);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	return (
		<div ref={ref} className='pixel-header fixed top-0 left-0 right-0 z-50'>
			<div className='max-w-[96%] mx-auto px-3 py-1'>
				<div className='flex items-center gap-4'>
					<div className='pixel-divider-right shrink-0 pr-5'>
						<PlayerCard />
					</div>
					<div className='flex flex-wrap items-center gap-x-4 gap-y-1 flex-1 min-w-0'>
						<ResourceDisplay />
					</div>
					<HeaderButtons />
				</div>
			</div>
		</div>
	);
};

export default GameHeader;
