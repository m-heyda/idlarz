import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import {
	PARAGON_CAP_POINTS,
	PARAGON_CATEGORIES,
	PARAGON_CATEGORY_LABEL,
	PARAGON_UPGRADES,
	paragonEffect,
	paragonEffectText,
	paragonRoom,
	type ParagonUpgrade,
} from '@/config/paragon';
import { paragonFree, paragonSpent as spentTotal } from '@/lib/offline/paragon';
import { calculateParagon } from '@/utils/game/character';
import audioManager from '@/utils/audioManager';
import { formatCompact } from '@/utils/formatters';
import '@/styles/Paragon.css';

/** One upgrade row: its effect now and with the next point, the points (of the cap, for a capped one) and the + button (shift adds 5). */
const Row: React.FC<{ u: ParagonUpgrade; points: number; free: number; onSpend: (n: number) => void }> = ({ u, points, free, onSpend }) => {
	const full = paragonRoom(u, points) <= 0;
	const next = paragonEffect(u, points + 1) - paragonEffect(u, points);
	const can = free > 0 && !full;
	return (
		<div className='px-paragon-row' data-capped={u.capped} data-full={full}>
			<div className='px-paragon-row-text'>
				<span className='px-paragon-name'>
					{u.name} <span className='px-paragon-points'>{u.capped ? `${points} / ${PARAGON_CAP_POINTS}` : points}</span>
				</span>
				<span className='px-paragon-effect' title={u.blurb}>
					{paragonEffectText(u, paragonEffect(u, points))}
					{full ? ' (full)' : `  (next ${paragonEffectText(u, next)})`}
				</span>
			</div>
			<button
				type='button'
				className='px-paragon-plus'
				disabled={!can}
				title={full ? 'This upgrade is full' : free > 0 ? 'Spend a point (shift: five)' : 'No free points'}
				onClick={(e) => onSpend(e.shiftKey ? 5 : 1)}
			>
				+
			</button>
		</div>
	);
};

/**
 * The Paragon tab of the Hero window (docs/plan/paragon.md): one point per paragon level, spent in four categories of five upgrades (three capped at 25 points, two uncapped and growing with a square root). A click previews the point at once and the server is asked for it
 * (`spendParagon`); Respec opens the Gem shop (the first one is free).
 */
const HeroParagon: React.FC = () => {
	const xp = useGameStore((state) => state.resources.xp);
	const spent = useGameStore((state) => state.paragonSpent);
	const spend = useGameStore((state) => state.spendParagon);
	const toggleGemShop = useUiStore((state) => state.toggleGemShop);
	const level = calculateParagon(xp).paragon;
	const free = paragonFree(xp, spent);
	const used = spentTotal(spent);

	if (level <= 0)
		return (
			<div className='px-paragon'>
				<div className='px-paragon-empty'>
					<strong>Paragon</strong>
					<span>Reach level 100 and keep earning XP: every paragon level gives one point to spend here.</span>
				</div>
			</div>
		);

	return (
		<div className='px-paragon'>
			<div className='px-paragon-head'>
				<span className='px-paragon-level'>✦ {formatCompact(level)}</span>
				<span className='px-paragon-free' data-has={free > 0}>
					{free} free point{free === 1 ? '' : 's'}
				</span>
				<span className='px-paragon-used'>{used} spent</span>
				<button
					type='button'
					className='px-paragon-respec'
					disabled={used === 0}
					onClick={toggleGemShop}
					title='Give every paragon point back (the first respec is free)'
				>
					Respec
				</button>
			</div>
			<div className='px-paragon-grid'>
				{PARAGON_CATEGORIES.map((cat) => (
					<section key={cat} className='px-paragon-col'>
						<h3 className='px-paragon-cat'>{PARAGON_CATEGORY_LABEL[cat]}</h3>
						{PARAGON_UPGRADES.filter((u) => u.category === cat).map((u) => (
							<Row
								key={u.id}
								u={u}
								points={spent[u.id] ?? 0}
								free={free}
								onSpend={(n) => {
									if (spend(u.id, n) > 0) audioManager.playSound('click');
								}}
							/>
						))}
					</section>
				))}
			</div>
		</div>
	);
};

export default HeroParagon;
