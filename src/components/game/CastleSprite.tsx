import React from 'react';
import { cn } from '@/lib/utils';
import { castleIconName } from '@/config/pixelIcons';
import PixelIcon from './PixelIcon';

interface CastleSpriteProps {
	level: number;
	/** `tile`: absolutely centred on its map tile and free to overflow onto neighbours.
	 *  `inline`: normal flow (dialogs). */
	variant?: 'tile' | 'inline';
	className?: string;
}

/** The castle for a given upgrade level: one 64px sprite per level (castle_1..castle_10, public/pixel/castles). */
const CastleSprite: React.FC<CastleSpriteProps> = ({ level, variant = 'tile', className }) => (
	<PixelIcon name={castleIconName(level)} alt={`Castle level ${level}`} className={cn('castle-sprite', variant === 'inline' && 'castle-inline', className)} />
);

export default CastleSprite;
