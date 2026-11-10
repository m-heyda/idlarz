import React from 'react';
import { AVATAR_SILHOUETTE, avatarById } from '@/catalog/avatars';
import { PLAYER_CLASSES, DEFAULT_PLAYER_CLASS, type PlayerClassId } from '@/config/playerClasses';
import PixelIcon from './PixelIcon';

interface AvatarArtProps {
	/** Avatar id; null/unknown shows the class bust (`playerClass`) */
	id: string | null | undefined;
	playerClass?: PlayerClassId;
	/** A black cut-out instead of the picture (an avatar the player has not unlocked) */
	locked?: boolean;
	scale?: number;
	className?: string;
}

/**
 * One avatar as a 40x40 bust. This is the only place that turns a catalog entry into pixels, so the real portraits (IDL-72) replace the placeholder busts here and in
 * `catalog/avatars.ts` and nowhere else.
 */
const AvatarArt: React.FC<AvatarArtProps> = ({ id, playerClass = DEFAULT_PLAYER_CLASS, locked = false, scale = 1, className }) => {
	const avatar = avatarById(id);
	if (locked) {
		return (
			<span className={className} style={{ display: 'inline-flex', lineHeight: 0, filter: 'brightness(0) opacity(0.55)' }} aria-hidden>
				<PixelIcon name={AVATAR_SILHOUETTE} scale={scale} alt='' />
			</span>
		);
	}
	const art = avatar ? avatar.portrait : (PLAYER_CLASSES[playerClass] ?? PLAYER_CLASSES[DEFAULT_PLAYER_CLASS]).bust;
	return (
		<span className={className} style={{ display: 'inline-flex', lineHeight: 0, filter: avatar && avatar.hue ? `hue-rotate(${avatar.hue}deg)` : undefined }}>
			<PixelIcon name={art} scale={scale} alt={avatar?.name ?? ''} />
		</span>
	);
};

export default AvatarArt;
