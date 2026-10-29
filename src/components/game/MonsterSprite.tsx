import React from 'react';
import { formatCompact } from '@/utils/formatters';
import { MONSTERS } from '@/config/combatConfig';
import { MONSTER_CATALOG, monsterArtUrl } from '@/catalog/monsters';
import { monsterArtSize } from '@/config/monsterArtSize';
import type { MonsterType } from '@/types/game';
import MonsterArt from './MonsterArt';
import '@/styles/Monsters.css';

/**
 * A monster standing on its tile: idle bob, a level badge, and for bosses a skull in the badge and a golden glow.
 * `art` (map lab only) names a roster monster whose single-frame picture is drawn instead of the type's sheet.
 */
const MonsterSprite: React.FC<{ type: MonsterType; level: number; lucky?: boolean; art?: string }> = ({ type, level, lucky = false, art }) => {
	const wip = art ? MONSTER_CATALOG.find((m) => m.id === art) : undefined;
	const size = wip ? monsterArtSize(wip.id, wip.grade) : undefined;
	const boss = wip ? wip.grade === 'boss' : MONSTERS[type].grade === 'boss';
	return (
		<span className='tile-monster' data-king={wip ? wip.grade === 'boss' : type === 'ratKing'} data-boss={boss} data-lucky={lucky} title={lucky ? 'A lucky monster: bigger rewards' : undefined} style={wip ? { width: size, height: size } : undefined}>
			{wip ? (
				// eslint-disable-next-line @next/next/no-img-element
				<img src={monsterArtUrl(wip)} alt={wip.label} className='tile-monster-img tile-monster-still' draggable={false} />
			) : (
				<MonsterArt type={type} label={MONSTERS[type].label} className='tile-monster-img' />
			)}
			<span className='tile-monster-tier' data-boss={boss}>
				{boss ? '☠ ' : ''}
				{lucky ? '★ ' : ''}
				{formatCompact(level)}
			</span>
		</span>
	);
};

export default MonsterSprite;
