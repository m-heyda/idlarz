import React from 'react';
import Image from 'next/image';
import { artAvatar, avatarArtUrl } from '@/catalog/avatars';
import { PLAYER_CLASSES, DEFAULT_PLAYER_CLASS, type PlayerClassId } from '@/config/playerClasses';

interface AvatarArtProps {
	/** Avatar id, drawn exactly as given (no class lock); null/unknown shows the default avatar of `playerClass`. A player's own avatar goes through `resolveAvatar` first. */
	id: string | null | undefined;
	playerClass?: PlayerClassId;
	/** A dark, grey version of the picture with a question mark (an avatar the player has not unlocked); the face stays hidden */
	locked?: boolean;
	scale?: number;
	className?: string;
}

/**
 * One avatar as a 40x40 bust. This is the only place that turns a catalog entry into pixels, so a new portrait set changes this file and `catalog/avatars.ts` only.
 */
const AvatarArt: React.FC<AvatarArtProps> = ({ id, playerClass = DEFAULT_PLAYER_CLASS, locked = false, scale = 1, className }) => {
	const avatar = artAvatar(id, PLAYER_CLASSES[playerClass] ? playerClass : DEFAULT_PLAYER_CLASS);
	// the portraits are 64x64; `scale` 1 is the 40 px bust size of the old class busts, so every use keeps its layout
	const size = Math.round(40 * scale);
	return (
		<span className={className} style={{ position: 'relative', display: 'inline-flex', lineHeight: 0 }} aria-hidden={locked}>
			<Image
				src={avatarArtUrl(avatar)}
				alt={locked ? '' : avatar.name}
				width={size}
				height={size}
				unoptimized
				draggable={false}
				className='pixelated shrink-0 select-none'
				style={locked ? { filter: 'grayscale(1) brightness(0.18) contrast(0.9)' } : undefined}
			/>
			{locked && (
				<span
					aria-hidden='true'
					style={{
						position: 'absolute',
						inset: 0,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						fontFamily: 'var(--font-pixel)',
						fontSize: Math.round(size * 0.5),
						lineHeight: 1,
						color: '#a89878',
						textShadow: '0 2px 0 #000',
					}}
				>
					?
				</span>
			)}
		</span>
	);
};

export default AvatarArt;
