import React from 'react';
import { formatCompact } from '@/utils/formatters';
import { MONSTERS } from '@/config/combatConfig';
import { MONSTER_CATALOG, monsterSpriteUrl } from '@/catalog/monsters';
import { monsterArtSize } from '@/config/monsterArtSize';
import type { MonsterType } from '@/types/game';
import MonsterArt from './MonsterArt';
import '@/styles/Monsters.css';

/**
 * A monster standing on its tile: idle bob, a level badge, and for bosses a skull in the badge and a golden glow.
 * `art` (map lab only) names another roster monster whose picture is drawn instead of the type's own.
 */
const MonsterSprite: React.FC<{
	type: MonsterType;
	level: number;
	lucky?: boolean;
	art?: string;
	/** At its top level: the badge turns blue and glows */
	maxed?: boolean;
	/** Still growing: the time to the next level and how much of the wait has passed (draws the bar under the monster) */
	growth?: { leftSec: number; fraction: number };
	/** The length of one wait, for the bar */
	intervalSec?: number;
	/** Its place in the battle queue (1 = next), 0 or left out when it is not queued */
	queued?: number;
}> = ({ type, level, lucky = false, art, maxed = false, growth, intervalSec = 1800, queued = 0 }) => {
	const wip = MONSTER_CATALOG.find((m) => m.id === (art ?? type));
	const size = wip ? monsterArtSize(wip.id, wip.grade) : undefined;
	const boss = wip ? wip.grade === 'boss' : MONSTERS[type].grade === 'boss';
	return (
		<span
			className='tile-monster'
			data-king={boss}
			data-boss={boss}
			data-lucky={lucky}
			title={lucky ? 'A lucky monster: bigger rewards' : undefined}
			style={wip ? { width: size, height: size } : undefined}
		>
			{wip ? (
				// eslint-disable-next-line @next/next/no-img-element
				<img src={monsterSpriteUrl(wip)} alt={wip.label} className='tile-monster-img tile-monster-still' draggable={false} />
			) : (
				<MonsterArt type={type} label={MONSTERS[type].label} className='tile-monster-img' />
			)}
			{queued > 0 && (
				<span className='tile-monster-queue' title={queued === 1 ? 'Fought next' : `Number ${queued} in the queue`} aria-label={`Queued, number ${queued}`}>
					{queued}
				</span>
			)}
			{growth && (
				// the bar restarts with every level (key) and fills over the time that is left
				<span
					key={level}
					className='tile-monster-grow'
					aria-hidden
					style={{ '--grow-left': `${growth.leftSec}s`, '--grow-from': growth.fraction, '--grow-total': `${intervalSec}s` } as React.CSSProperties}
				/>
			)}
			<span className='tile-monster-tier' data-boss={boss} data-maxed={maxed} title={maxed ? 'Fully grown' : undefined}>
				{boss ? '☠ ' : ''}
				{lucky ? '★ ' : ''}
				{formatCompact(level)}
			</span>
		</span>
	);
};

export default MonsterSprite;
