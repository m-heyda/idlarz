import React from 'react';
import { MONSTER_PIXEL_ICONS } from '@/config/pixelIcons';
import { MONSTERS } from '@/config/combatConfig';
import type { MonsterType } from '@/types/game';
import PixelIcon from './PixelIcon';
import '@/styles/Monsters.css';

/** A monster standing on its tile: idle bob, tier badge for rats, bigger and golden for the Rat King. */
const MonsterSprite: React.FC<{ type: MonsterType; tier: number }> = ({ type, tier }) => (
	<span className='tile-monster' data-king={type === 'ratKing'}>
		<PixelIcon name={MONSTER_PIXEL_ICONS[type]} alt={MONSTERS[type].label} className='tile-monster-img' />
		{type === 'rat' && <span className='tile-monster-tier'>{tier}</span>}
	</span>
);

export default MonsterSprite;
