import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import {
	PIXEL_ICON_SIZES,
	PixelIconName,
	SHINE_FRAMES,
	SHINE_SHEETS,
	pixelIconSrc,
} from '@/config/pixelIcons';

interface PixelSheetProps {
	/** A one-row sprite sheet from the icon set (its size is the whole sheet) */
	name: PixelIconName;
	frames: number;
	/** Integer multiple of the frame size */
	scale?: number;
	/** Length of one loop */
	durationMs?: number;
	alt?: string;
	className?: string;
}

/** Plays a one-row sprite sheet with stepped CSS (no JS): twinkles, the chest's idle sparkle. */
export const PixelSheet: React.FC<PixelSheetProps> = ({
	name,
	frames,
	scale = 1,
	durationMs = 1200,
	alt = '',
	className,
}) => {
	const [sheetW, h] = PIXEL_ICON_SIZES[name];
	const w = sheetW / frames;
	return (
		<span
			role={alt ? 'img' : undefined}
			aria-label={alt || undefined}
			aria-hidden={alt ? undefined : true}
			className={cn('px-shine shrink-0 select-none', className)}
			style={
				{
					'--px-w': `${w * scale}px`,
					'--px-h': `${h * scale}px`,
					'--px-frames': frames,
					'--px-ms': `${durationMs}ms`,
					'--px-sheet': `url(${pixelIconSrc(name)})`,
				} as React.CSSProperties
			}
		/>
	);
};

interface PixelIconProps {
	name: PixelIconName;
	alt?: string;
	/** Integer multiple of the native sprite size (0.5 is fine for tiny inline use). */
	scale?: number;
	/** Twinkle with the sprite's shine strip, when it has one (gold, gems, crystals, mana, mystery box) */
	shine?: boolean;
	className?: string;
}

const PixelIcon: React.FC<PixelIconProps> = ({ name, alt = '', scale = 1, shine = false, className }) => {
	const [w, h] = PIXEL_ICON_SIZES[name];
	const sheet = shine ? SHINE_SHEETS[name] : undefined;
	if (sheet) {
		return <PixelSheet name={sheet} frames={SHINE_FRAMES} scale={scale} alt={alt} className={className} />;
	}
	return (
		<Image
			src={pixelIconSrc(name)}
			alt={alt}
			width={w * scale}
			height={h * scale}
			unoptimized
			draggable={false}
			className={cn('pixelated shrink-0 select-none', className)}
		/>
	);
};

export default PixelIcon;
