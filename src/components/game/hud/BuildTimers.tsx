import React, { useMemo } from 'react';
import { TILE_SIZE } from '@/config/biomes';
import { activeBuildTimers } from '@/lib/buildTimers';
import { buildTimeCutPct } from '@/lib/buildTimeCut';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { useViewStore } from '@/stores/viewStore';
import { getTile } from '@/utils/world';
import PixelIcon from '../PixelIcon';
import '@/styles/BuildTimers.css';

/**
 * The running constructions, bottom left (they used to be one chip in the top bar): one entry per castle or building upgrade; a click shows that tile on the map. Nothing is drawn while nothing is being built.
 * Every running upgrade is always listed (the list comes from `activeBuildTimers`), never folded into a "+N more" line, in one of two views the player switches with the button on top (remembered: `buildQueueCompact`):
 * - **full**: one row each with the picture, name, target level, time left and a thin progress bar; a long queue scrolls inside the stack instead of covering the map;
 * - **compact**: one small plate each with the picture, the target level and the time left, three to a line.
 * @category Pacing/Build queue
 */
const BuildTimers: React.FC = () => {
	const castleUpgrade = useGameStore((state) => state.castleUpgrade);
	const buildingUpgrades = useGameStore((state) => state.buildingUpgrades);
	const tiles = useGameStore((state) => state.tiles);
	const prestige = useGameStore((state) => state.prestige);
	const idolLevels = useGameStore((state) => state.idolLevels);
	const paragonSpent = useGameStore((state) => state.paragonSpent);
	const centerOn = useViewStore((state) => state.centerOn);
	const compact = useUiStore((state) => state.buildQueueCompact);
	const setPref = useUiStore((state) => state.setPref);
	const equipment = useGameStore((state) => state.equipment);
	const buildTimePct = useMemo(() => buildTimeCutPct(tiles, idolLevels, equipment, paragonSpent), [tiles, idolLevels, equipment, paragonSpent]);

	const timers = activeBuildTimers({
		castleUpgrade,
		buildingUpgrades,
		buildingAt: (x, y) => getTile(tiles, x, y)?.building,
		prestige,
		buildTimePct,
	});
	if (timers.length === 0) return null;

	const art = (timer: (typeof timers)[number], size: number) =>
		timer.art ? (
			// eslint-disable-next-line @next/next/no-img-element
			<img src={timer.art} alt='' width={size} height={size} className='pixelated' draggable={false} />
		) : (
			<PixelIcon name='castle_1' alt='' scale={0.5} />
		);
	const find = (timer: (typeof timers)[number]) => centerOn((timer.x + 0.5) * TILE_SIZE, (timer.y + 0.5) * TILE_SIZE);

	return (
		<div className='bt-stack' data-testid='build-timers' data-view={compact ? 'compact' : 'full'} aria-label='Constructions in progress'>
			<button
				type='button'
				className='bt-toggle'
				aria-pressed={compact}
				title={compact ? 'Show every construction as a full row' : 'Show every construction as a small plate'}
				onClick={() => setPref('buildQueueCompact', !compact)}
			>
				<span>Building ({timers.length})</span>
				<span className='bt-toggle-mode'>{compact ? 'Compact' : 'Full'}</span>
			</button>
			<div className={compact ? 'bt-list bt-list-compact' : 'bt-list'}>
				{timers.map((timer) =>
					compact ? (
						<button
							key={timer.key}
							type='button'
							className='bt-plate'
							title={`${timer.title} to level ${timer.toLevel}, ${timer.label} left: click to find it on the map`}
							aria-label={`${timer.title} to level ${timer.toLevel}: ${timer.label} left. Show it on the map`}
							onClick={() => find(timer)}
						>
							<span className='bt-art'>
								{art(timer, 22)}
								<span className='bt-level'>{timer.toLevel}</span>
							</span>
							<span className='bt-time'>{timer.label}</span>
							<span className='bt-bar' aria-hidden='true'>
								<span style={{ width: `${Math.round(timer.progress * 100)}%` }} />
							</span>
						</button>
					) : (
						<button
							key={timer.key}
							type='button'
							className='bt-row'
							title={`${timer.title} to level ${timer.toLevel}: click to find it on the map`}
							aria-label={`${timer.title} to level ${timer.toLevel}: ${timer.label} left. Show it on the map`}
							onClick={() => find(timer)}
						>
							<span className='bt-art'>{art(timer, 22)}</span>
							<span className='bt-text'>
								<span className='bt-title'>{timer.title}</span>
								<span className='bt-sub'>to level {timer.toLevel}</span>
							</span>
							<span className='bt-time'>{timer.label}</span>
							<span className='bt-bar' aria-hidden='true'>
								<span style={{ width: `${Math.round(timer.progress * 100)}%` }} />
							</span>
						</button>
					),
				)}
			</div>
		</div>
	);
};

export default BuildTimers;
