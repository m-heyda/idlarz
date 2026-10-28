import React from 'react';
import { formatCompact } from '@/utils/formatters';
import { MONSTERS } from '@/config/combatConfig';
import type { MonsterType } from '@/types/game';
import MonsterArt from './MonsterArt';
import '@/styles/Monsters.css';

/** A monster standing on its tile: idle bob, a level badge, and for bosses a skull in the badge and a golden glow. */
const MonsterSprite: React.FC<{ type: MonsterType; level: number; lucky?: boolean }> = ({ type, level, lucky = false }) => {
	const boss = MONSTERS[type].grade === 'boss';
	return (
		<span className='tile-monster' data-king={type === 'ratKing'} data-boss={boss} data-lucky={lucky} title={lucky ? 'A lucky monster: bigger rewards' : undefined}>
			<MonsterArt type={type} label={MONSTERS[type].label} className='tile-monster-img' />
			<span className='tile-monster-tier' data-boss={boss}>
				{boss ? '☠ ' : ''}
				{lucky ? '★ ' : ''}
				{formatCompact(level)}
			</span>
		</span>
	);
};

export default MonsterSprite;
