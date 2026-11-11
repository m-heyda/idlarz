import React from 'react';
import { cn } from '@/lib/utils';
import { MONSTER_CATALOG, monsterSpriteUrl, usesPlaceholderArt } from '@/catalog/monsters';
import { monsterArtSize } from '@/config/monsterArtSize';
import { useIsDiscovered } from '@/stores/bestiaryStore';
import type { MonsterType } from '@/types/game';
import '@/styles/Monsters.css';

/**
 * The roster entry of the map lab's art preview (`art` names another monster whose picture is drawn instead); undefined for a real game monster, which is drawn by {@link MonsterArt}
 * (so the "?" silhouette applies). Every real monster type is in the catalog too, so looking the type itself up would send every monster around the silhouette (the bug where the
 * map showed real art while the queue showed shadows).
 */
export const labPreviewOf = (art: string | undefined) => (art ? MONSTER_CATALOG.find((m) => m.id === art) : undefined);

/** What the name of a monster the player has not met yet reads as (the picture is a black "?" silhouette, see {@link MonsterArt}). A met monster whose real sprite is not made yet draws the stand-in (a teal slime) without the "?" (`monster-placeholder`), so the two read differently. */
export const UNKNOWN_MONSTER = 'Unknown monster';

/**
 * A monster's picture (public/pixel/enemies); `scale` 1 is the size it has on the map, bigger ones are for the fight window.
 * {@link MonsterPicture} draws it for a given `known` (the store-free part); the default export reads the store. A type the player has not fought yet (the bestiary store: server's `stats.seen`) is drawn as a black silhouette with a "?" on it and no name.
 */
export const MonsterPicture: React.FC<{ type: MonsterType; known: boolean; scale?: number; label?: string; className?: string }> = ({
	type,
	known,
	scale = 1,
	label,
	className,
}) => {
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
			className={cn('monster-art', className, !known && 'monster-unknown', known && usesPlaceholderArt(entry) && 'monster-placeholder')}
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

const MonsterArt: React.FC<{ type: MonsterType; scale?: number; label?: string; className?: string }> = (props) => (
	<MonsterPicture {...props} known={useIsDiscovered(props.type)} />
);

export default MonsterArt;
