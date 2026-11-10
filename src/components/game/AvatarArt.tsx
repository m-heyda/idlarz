import React from 'react';
import Image from 'next/image';
import { avatarArtUrl, avatarById } from '@/catalog/avatars';
import { PLAYER_CLASSES, DEFAULT_PLAYER_CLASS, type PlayerClassId } from '@/config/playerClasses';
import PixelIcon from './PixelIcon';

interface AvatarArtProps {
	/** Avatar id; null/unknown shows the class bust (`playerClass`) */
	id: string | null | undefined;
	playerClass?: PlayerClassId;
	/** A black cut-out of the picture (an avatar the player has not unlocked) */
	locked?: boolean;
	scale?: number;
	className?: string;
}

/**
 * One avatar as a 40x40 bust. This is the only place that turns a catalog entry into pixels, so a new portrait set changes this file and `catalog/avatars.ts` only.
 */
const AvatarArt: React.FC<AvatarArtProps> = ({ id, playerClass = DEFAULT_PLAYER_CLASS, locked = false, scale = 1, className }) => {
	const avatar = avatarById(id);
	if (avatar) {
		// the portraits are 64x64; `scale` 1 is the 40 px bust size of the old class busts, so every use keeps its layout
		const size = Math.round(40 * scale);
		return (
			<span
				className={className}
				style={{ display: 'inline-flex', lineHeight: 0, filter: locked ? 'brightness(0) opacity(0.55)' : undefined }}
				aria-hidden={locked}
			>
				<Image
					src={avatarArtUrl(avatar)}
					alt={locked ? '' : avatar.name}
					width={size}
					height={size}
					unoptimized
					draggable={false}
					className='pixelated shrink-0 select-none'
				/>
			</span>
		);
	}
	const info = PLAYER_CLASSES[playerClass] ?? PLAYER_CLASSES[DEFAULT_PLAYER_CLASS];
	return (
		<span className={className} style={{ display: 'inline-flex', lineHeight: 0 }}>
			<PixelIcon name={info.bust} scale={scale} alt={`${info.race} ${info.label}`} />
		</span>
	);
};

export default AvatarArt;
