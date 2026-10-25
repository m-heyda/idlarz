import React, { useEffect, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { countOwnedTiles } from '@/utils/gameUtils';
import { formatTime } from '@/utils/formatters';

/** Frames per second and the slowest frame of the last half second, from a requestAnimationFrame loop. */
const useFps = (): { fps: number; worstMs: number } => {
	const [sample, setSample] = useState({ fps: 0, worstMs: 0 });
	useEffect(() => {
		let raf = 0;
		let frames = 0;
		let worst = 0;
		let last = performance.now();
		let windowStart = last;
		const loop = (now: number) => {
			frames++;
			worst = Math.max(worst, now - last);
			last = now;
			if (now - windowStart >= 500) {
				setSample({ fps: Math.round((frames * 1000) / (now - windowStart)), worstMs: Math.round(worst) });
				frames = 0;
				worst = 0;
				windowStart = now;
			}
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	}, []);
	return sample;
};

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
	<div className='flex justify-between gap-4'>
		<span className='text-[#a89878]'>{label}</span>
		<span className='text-[#ecdcb4] tabular-nums'>{value}</span>
	</div>
);

const StatsBody: React.FC = () => {
	const { fps, worstMs } = useFps();
	const tiles = useGameStore((state) => countOwnedTiles(state.tiles));
	const monsters = useGameStore((state) => state.monsters.length);
	const playSeconds = useGameStore((state) => Math.floor(state.playSeconds));
	const fpsColor = fps >= 50 ? 'text-green-400' : fps >= 30 ? 'text-amber-300' : 'text-red-400';

	return (
		<div className='fixed bottom-4 right-4 z-40 px-panel text-xs pointer-events-none min-w-[170px]' aria-label='Statistics'>
			<div className='px-h mb-1'>Statistics</div>
			<Row label='FPS' value={<span className={fpsColor}>{fps}</span>} />
			<Row label='Slowest frame' value={`${worstMs} ms`} />
			<Row label='Tiles owned' value={tiles} />
			<Row label='Monsters' value={monsters} />
			<Row label='Time played' value={formatTime(playSeconds)} />
		</div>
	);
};

/** The small statistics panel (bottom right) the global menu toggles with "Show statistics". */
const StatsOverlay: React.FC = () => {
	const show = useUiStore((state) => state.showStats);
	return show ? <StatsBody /> : null;
};

export default StatsOverlay;
