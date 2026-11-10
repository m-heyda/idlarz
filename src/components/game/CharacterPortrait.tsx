import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { DEFAULT_PLAYER_CLASS, PLAYER_CLASSES } from '@/config/playerClasses';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/uiStore';
import { avatarById } from '@/catalog/avatars';
import PixelIcon from './PixelIcon';
import AvatarArt from './AvatarArt';

interface CharacterPortraitProps {
	/** 'full' = the whole figure (56x80), 'bust' = head and shoulders (40x40) */
	variant?: 'full' | 'bust';
	scale?: number;
	className?: string;
}

/** The player's character in their chosen class - used everywhere the hero appears. */
const CharacterPortrait: React.FC<CharacterPortraitProps> = ({ variant = 'full', scale = 1, className }) => {
	const playerClass = useGameStore((state) => state.playerClass);
	const avatarId = useUiStore((state) => state.avatarId);
	const info = PLAYER_CLASSES[playerClass] ?? PLAYER_CLASSES[DEFAULT_PLAYER_CLASS];

	// the head-and-shoulders portrait is the player's avatar (IDL-71) once one is chosen; the full figure is always the class hero
	if (variant === 'bust' && avatarById(avatarId)) {
		return <AvatarArt id={avatarId} playerClass={playerClass} scale={scale} className={cn('character-portrait', className)} />;
	}

	return (
		<span className={cn('character-portrait', className)}>
			<PixelIcon name={variant === 'bust' ? info.bust : info.full} scale={scale} alt={`${info.race} ${info.label}`} />
		</span>
	);
};

export default CharacterPortrait;
