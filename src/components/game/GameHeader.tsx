import React, { useEffect, useRef } from 'react';
import { useClickIncome } from '@/hooks/useClickIncome';
import HudDock from './hud/HudDock';
import HudTopBar from './hud/HudTopBar';

/**
 * The game's HUD, drawn with the design system (IDL-325): the wooden top bar (hero portrait, resource trays, Gem shop, Deeds, game menu) and the stone dock of windows along the bottom.
 * `useClickIncome` registers the map click listener; the real height of the bar is published as --header-h so windows and toasts sit below it.
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
		<>
			<div ref={ref} className='ds-root fixed top-0 left-0 right-0 z-50'>
				<HudTopBar />
			</div>
			<HudDock />
		</>
	);
};

export default GameHeader;
