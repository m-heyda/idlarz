import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import {
	PARAGON_CAP_POINTS,
	PARAGON_CATEGORIES,
	PARAGON_CATEGORY_LABEL,
	PARAGON_CATEGORY_STYLE,
	PARAGON_GLYPH,
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

/** The medallion of one upgrade: its icon in a ring that fills with the points (a capped upgrade, round) or in a diamond with an infinity mark (an uncapped one). */
const Medallion: React.FC<{ u: ParagonUpgrade; points: number; full: boolean }> = ({ u, points, full }) => {
	const fill = u.capped ? Math.min(1, points / PARAGON_CAP_POINTS) : points > 0 ? 1 : 0;
	return (
		<span
			className='px-paragon-medal'
			data-capped={u.capped}
			data-full={full}
			data-spent={points > 0}
			style={{ '--fill': `${fill * 360}deg` } as React.CSSProperties}
		>
			<span className='px-paragon-medal-in'>
				<span className='px-paragon-glyph' aria-hidden='true'>
					{PARAGON_GLYPH[u.id]}
				</span>
			</span>
			{!u.capped && <span className='px-paragon-inf'>∞</span>}
			{full && <span className='px-paragon-check'>✓</span>}
		</span>
	);
};

/** One upgrade: its medallion, its effect now and with the next point, the points (of the cap, for a capped one) and the + button (shift adds 5). */
const Node: React.FC<{ u: ParagonUpgrade; points: number; free: number; onSpend: (n: number) => void }> = ({ u, points, free, onSpend }) => {
	const full = paragonRoom(u, points) <= 0;
	const next = paragonEffect(u, points + 1) - paragonEffect(u, points);
	const can = free > 0 && !full;
	const tip = `${u.blurb} ${u.capped ? `Up to ${PARAGON_CAP_POINTS} points, then full.` : 'No cap: every point counts for a little less than the last.'}`;
	return (
		<div className='px-paragon-row' data-capped={u.capped} data-full={full} data-can={can} data-spent={points > 0} title={tip}>
			<Medallion u={u} points={points} full={full} />
			<div className='px-paragon-row-text'>
				<span className='px-paragon-name'>
					{u.name} <span className='px-paragon-points'>{u.capped ? `${points} / ${PARAGON_CAP_POINTS}` : points}</span>
				</span>
				<span className='px-paragon-effect'>
					{paragonEffectText(u, paragonEffect(u, points))}
					{full ? ' (full)' : `  (next ${paragonEffectText(u, next)})`}
				</span>
			</div>
			<button
				type='button'
				className='px-paragon-plus'
				disabled={!can}
				title={full ? 'This upgrade is full' : free > 0 ? 'Spend a point (shift: five)' : 'No free points'}
				aria-label={`Spend a point in ${u.name}`}
				onClick={(e) => onSpend(e.shiftKey ? 5 : 1)}
			>
				+
			</button>
		</div>
	);
};

/**
 * The Paragon tab of the Hero window (docs/plan/paragon.md): one point per paragon level, spent in four coloured categories of five upgrades (three capped at 25 points, two uncapped and growing with a square root). Each upgrade is a medallion with an existing
 * symbol (`PARAGON_GLYPH`, a text character), a progress ring for the capped ones and a diamond for the uncapped ones; no pictures. A click previews the point at once and the server is asked for it (`spendParagon`); Respec opens the Gem shop (the first one is free).
 */
const HeroParagon: React.FC = () => {
	const xp = useGameStore((state) => state.resources.xp);
	const spent = useGameStore((state) => state.paragonSpent);
	const spend = useGameStore((state) => state.spendParagon);
	const toggleGemShop = useUiStore((state) => state.toggleGemShop);
	const { paragon: level, progress } = calculateParagon(xp);
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
				<span className='px-paragon-ring'>
					<span className='px-paragon-level'>✦ {formatCompact(level)}</span>
				</span>
				<div className='px-paragon-next' title='Progress to the next paragon level'>
					<span className='px-paragon-next-label'>Next paragon level</span>
					<span className='px-paragon-next-bar'>
						<span className='px-paragon-next-fill' style={{ width: `${Math.round(progress * 100)}%` }} />
					</span>
				</div>
				<span className='px-paragon-free' data-has={free > 0}>
					<strong>{formatCompact(free)}</strong> free point{free === 1 ? '' : 's'}
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
				{PARAGON_CATEGORIES.map((cat) => {
					const upgrades = PARAGON_UPGRADES.filter((u) => u.category === cat);
					const inCat = upgrades.reduce((sum, u) => sum + (spent[u.id] ?? 0), 0);
					const style = PARAGON_CATEGORY_STYLE[cat];
					return (
						<section key={cat} className='px-paragon-col' data-cat={cat} style={{ '--cat': style.color } as React.CSSProperties}>
							<h3 className='px-paragon-cat'>
								<span className='px-paragon-emblem'>
									<span className='px-paragon-glyph'>{style.glyph}</span>
								</span>
								<span className='px-paragon-cat-name'>{PARAGON_CATEGORY_LABEL[cat]}</span>
								<span className='px-paragon-cat-pts'>{inCat} points</span>
							</h3>
							{upgrades.map((u) => (
								<Node
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
					);
				})}
			</div>
		</div>
	);
};

export default HeroParagon;
