import React from 'react';
import { cn } from '@/lib/utils';
import { MONSTER_CATALOG, monsterSpriteUrl } from '@/catalog/monsters';
import { monsterArtSize } from '@/config/monsterArtSize';
import type { MonsterType } from '@/types/game';
import '@/styles/Monsters.css';

/** A monster's picture (public/pixel/enemies); `scale` 1 is the size it has on the map, bigger ones are for the fight window. */
const MonsterArt: React.FC<{ type: MonsterType; scale?: number; label?: string; className?: string }> = ({ type, scale = 1, label, className }) => {
	const entry = MONSTER_CATALOG.find((m) => m.id === type);
	if (!entry) return null;
	const size = monsterArtSize(entry.id, entry.grade) * scale;
	return (
		// eslint-disable-next-line @next/next/no-img-element
		<img
			src={monsterSpriteUrl(entry)}
			alt={label ?? entry.label}
			width={size}
			height={size}
			className={cn('monster-art', className)}
			style={{ imageRendering: 'pixelated' }}
			draggable={false}
		/>
	);
};

export default MonsterArt;
