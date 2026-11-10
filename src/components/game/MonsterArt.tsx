import React from 'react';
import { cn } from '@/lib/utils';
import { MONSTER_CATALOG, monsterSpriteUrl } from '@/catalog/monsters';
import { monsterArtSize } from '@/config/monsterArtSize';
import { useIsDiscovered } from '@/stores/bestiaryStore';
import type { MonsterType } from '@/types/game';
import '@/styles/Monsters.css';

/** What the name of a monster the player has not met yet reads as (the picture is a black "?" silhouette, see {@link MonsterArt}). */
export const UNKNOWN_MONSTER = 'Unknown monster';

/**
 * A monster's picture (public/pixel/enemies); `scale` 1 is the size it has on the map, bigger ones are for the fight window.
 * A type the player has not fought yet (the bestiary store: server's `stats.seen`) is drawn as a black silhouette with a "?" on it and no name.
 */
const MonsterArt: React.FC<{ type: MonsterType; scale?: number; label?: string; className?: string }> = ({ type, scale = 1, label, className }) => {
	const known = useIsDiscovered(type);
	const entry = MONSTER_CATALOG.find((m) => m.id === type);
	if (!entry) return null;
	const size = monsterArtSize(entry.id, entry.grade) * scale;
	const img = (
		// eslint-disable-next-line @next/next/no-img-element
		<img
			src={monsterSpriteUrl(entry)}
			alt={known ? (label ?? entry.label) : UNKNOWN_MONSTER}
			width={size}
			height={size}
			className={cn('monster-art', className, !known && 'monster-unknown')}
			style={{ imageRendering: 'pixelated' }}
			draggable={false}
		/>
	);
	if (known) return img;
	return (
		<span className='monster-unknown-wrap' style={{ width: size, height: size }}>
			{img}
			<span className='monster-unknown-mark' aria-hidden>
				?
			</span>
		</span>
	);
};

export default MonsterArt;
