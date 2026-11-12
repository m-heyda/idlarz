import React, { useMemo } from 'react';
import { TILE_SIZE } from '@/config/biomes';
import { activeBuildTimers } from '@/lib/buildTimers';
import { idolEconomy } from '@/lib/idolEconomy';
import { useGameStore } from '@/stores/gameStore';
import { useViewStore } from '@/stores/viewStore';
import { getTile } from '@/utils/world';
import PixelIcon from '../PixelIcon';
import '@/styles/BuildTimers.css';

/** More rows than this fold into one "+N more" line, so a long queue never covers the map. */
const MAX_ROWS = 4;

/**
 * The running constructions, bottom left (they used to be one chip in the top bar): one row per castle or building upgrade with its picture, name, target level, time left and a thin progress bar; a click shows that tile on the map.
 * Built for several at once: the list comes from `activeBuildTimers`, which takes every running upgrade, and the rows stack upwards from the corner. Nothing is drawn while nothing is being built.
 */
const BuildTimers: React.FC = () => {
	const castleUpgrade = useGameStore((state) => state.castleUpgrade);
	const buildingUpgrade = useGameStore((state) => state.buildingUpgrade);
	const tiles = useGameStore((state) => state.tiles);
	const prestige = useGameStore((state) => state.prestige);
	const idolLevels = useGameStore((state) => state.idolLevels);
	const centerOn = useViewStore((state) => state.centerOn);
	const buildTimePct = useMemo(() => idolEconomy(tiles, idolLevels ?? {}).buildTimePct, [tiles, idolLevels]);

	const timers = activeBuildTimers({
		castleUpgrade,
		buildingUpgrades: buildingUpgrade ? [buildingUpgrade] : [],
		buildingAt: (x, y) => getTile(tiles, x, y)?.building,
		prestige,
		buildTimePct,
	});
	if (timers.length === 0) return null;
	const shown = timers.slice(0, MAX_ROWS);
	const more = timers.length - shown.length;

	return (
		<div className='bt-stack' data-testid='build-timers' aria-label='Constructions in progress'>
			{more > 0 && <div className='bt-more'>+{more} more building</div>}
			{shown.map((timer) => (
				<button
					key={timer.key}
					type='button'
					className='bt-row'
					title={`${timer.title} to level ${timer.toLevel}: click to find it on the map`}
					aria-label={`${timer.title} to level ${timer.toLevel}: ${timer.label} left. Show it on the map`}
					onClick={() => centerOn((timer.x + 0.5) * TILE_SIZE, (timer.y + 0.5) * TILE_SIZE)}
				>
					<span className='bt-art'>
						{timer.art ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img src={timer.art} alt='' width={28} height={28} className='pixelated' draggable={false} />
						) : (
							<PixelIcon name='castle_1' alt='' scale={0.6} />
						)}
					</span>
					<span className='bt-text'>
						<span className='bt-title'>{timer.title}</span>
						<span className='bt-sub'>to level {timer.toLevel}</span>
					</span>
					<span className='bt-time'>{timer.label}</span>
					<span className='bt-bar' aria-hidden='true'>
						<span style={{ width: `${Math.round(timer.progress * 100)}%` }} />
					</span>
				</button>
			))}
		</div>
	);
};

export default BuildTimers;
