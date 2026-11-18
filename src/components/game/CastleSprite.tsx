import React from 'react';
import { cn } from '@/lib/utils';
import { castleIconName, type PixelIconName } from '@/config/pixelIcons';
import { useUiStore } from '@/stores/uiStore';
import PixelIcon from './PixelIcon';

interface CastleSpriteProps {
	level: number;
	/** `tile`: absolutely centred on its map tile and free to overflow onto neighbours.
	 *  `inline`: normal flow (dialogs). */
	variant?: 'tile' | 'inline';
	className?: string;
	/** Always the level's own castle, never the player's skin (the "next level" preview) */
	plain?: boolean;
}

/** The castle for a given upgrade level: one 64px sprite per level (castle_1..castle_10, public/pixel/castles), or the castle skin the player bought and picked in the Gem shop (one picture for every level). */
const CastleSprite: React.FC<CastleSpriteProps> = ({ level, variant = 'tile', className, plain = false }) => {
	const skin = useUiStore((state) => (state.castleSkin !== null && state.ownedSkins.includes(state.castleSkin) ? state.castleSkin : null));
	const name = !plain && skin !== null ? (`castle_skin_${skin}` as PixelIconName) : castleIconName(level);
	return <PixelIcon name={name} alt={`Castle level ${level}`} className={cn('castle-sprite', variant === 'inline' && 'castle-inline', className)} />;
};

export default CastleSprite;
