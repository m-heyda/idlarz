import React from 'react';
import { RESOURCE_PIXEL_ICONS } from '@/config/pixelIcons';
import { RESOURCE_ICONS } from '@/config/gameConfig';
import PixelIcon from './PixelIcon';

interface ResourceIconProps {
	resource: string;
	/** 0.6 = 24px inline icon (default), 1 = full 40px sprite */
	scale?: number;
	className?: string;
}

/** Pixel sprite for a resource, falling back to the old emoji for resources without one (e.g. xp). */
const ResourceIcon: React.FC<ResourceIconProps> = ({ resource, scale = 0.6, className }) => {
	const name = RESOURCE_PIXEL_ICONS[resource];
	if (!name) {
		return (
			<span className={className} role='img' aria-label={resource}>
				{RESOURCE_ICONS[resource as keyof typeof RESOURCE_ICONS] ?? resource}
			</span>
		);
	}
	return (
		<PixelIcon
			name={name}
			alt={resource}
			scale={scale}
			className={className ?? 'inline-block align-middle'}
		/>
	);
};

export default ResourceIcon;
