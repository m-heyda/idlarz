import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/uiStore';
import { resolveAvatar } from '@/catalog/avatars';
import AvatarArt from './AvatarArt';

interface CharacterPortraitProps {
	/** Kept for callers: both draw the avatar bust now (the full-figure heroes are gone) */
	variant?: 'full' | 'bust';
	scale?: number;
	className?: string;
}

/** The player's character in their chosen class - used everywhere the hero appears. */
const CharacterPortrait: React.FC<CharacterPortraitProps> = ({ variant = 'full', scale = 1, className }) => {
	const playerClass = useGameStore((state) => state.playerClass);
	const avatarId = useUiStore((state) => state.avatarId);

	// the portrait is the player's avatar (IDL-71), or their class's default avatar until one is chosen (the old full-figure class heroes were removed on 2026-11-16, so `full` draws the same bust)
	void variant;
	return <AvatarArt id={resolveAvatar(avatarId, playerClass).id} playerClass={playerClass} scale={scale} className={cn('character-portrait', className)} />;
};

export default CharacterPortrait;
