import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { Resources } from '@/types/game';
import { formatNumber } from '@/utils/formatters';
import { FARM_PRODUCT_KEYS, HEADER_DISPLAYED_RESOURCES_INFO, RESOURCE_ICONS } from '@/config/gameConfig';
import { RESOURCE_PIXEL_ICONS } from '@/config/pixelIcons';
import PixelIcon from './PixelIcon';
import GemIcon from './GemIcon';
import StableNumber from './StableNumber';

const CHIP_ICON_SCALE = 0.6; // 40px sprites drawn at 24px

interface ChipProps {
	icon: React.ReactNode;
	value: string;
	/** Second line: the rate per second, or a short note */
	sub: string;
	subClassName: string;
	onClick?: () => void;
	children?: React.ReactNode; // tooltip
}

/** One compact currency: a small icon, the amount and the rate under it. */
const Chip: React.FC<ChipProps> = ({ icon, value, sub, subClassName, onClick, children }) => (
	<div
		className={`group relative flex items-center gap-1.5 ${onClick ? 'cursor-pointer' : ''}`}
		onClick={onClick}>
		{icon}
		{/* Digits sit in equal cells and the block reserves room for the widest value, so growing numbers
		    never shift the icon or the next chip */}
		<div className='flex flex-col leading-tight'>
			<StableNumber value={value} className='font-semibold text-[13px] text-[#f1e6c8] min-w-[3.9em]' />
			<StableNumber value={sub} className={`text-[10px] min-w-[5.2em] ${subClassName}`} />
		</div>
		<div className='absolute top-full left-1/2 -translate-x-1/2 mt-1 w-max opacity-0 group-hover:opacity-100 pointer-events-none z-[60] transition-opacity duration-150'>
			{children}
		</div>
	</div>
);

const ResourceDisplay: React.FC = () => {
	const resources = useGameStore((state) => state.resources);
	const resourceRates = useGameStore((state) => state.resourceRates);
	const gems = useGameStore((state) => state.prestige.legacyPoints);
	const rebirths = useGameStore((state) => state.prestige.rebirths);
	const toggleLegacy = useUiStore((state) => state.toggleLegacy);

	const resourcesToDisplay = (Object.keys(resources) as Array<keyof Resources>).filter((resource) => {
		if (resource === 'xp') return false;
		// Farm products appear once the pen has made some, so a new game starts with a clean header
		if ((FARM_PRODUCT_KEYS as readonly string[]).includes(resource)) {
			return resources[resource] > 0 || resourceRates.total[resource] > 0;
		}
		return true;
	});

	return (
		<>
			{resourcesToDisplay.map((resource) => {
				const baseRate = resourceRates.base[resource];
				const totalRate = resourceRates.total[resource];
				const modifierPercent = Math.round(resourceRates.modifiers[resource] * 100);

				const resourceInfo = (HEADER_DISPLAYED_RESOURCES_INFO as Record<string, { icon: string; label: string; description: string }>)[resource] || {
					icon: RESOURCE_ICONS[resource] || '🥩',
					label: resource.charAt(0).toUpperCase() + resource.slice(1),
					description: `${resource.charAt(0).toUpperCase() + resource.slice(1)} from the farm; sell it to the merchant`,
				};

				return (
					<Chip
						key={resource}
						icon={
							RESOURCE_PIXEL_ICONS[resource] ? (
								<PixelIcon
									name={RESOURCE_PIXEL_ICONS[resource]!}
									alt={resource}
									scale={CHIP_ICON_SCALE}
									shine={resource === 'gold'}
								/>
							) : (
								<div className='text-xl' role='img' aria-label={resource}>
									{resourceInfo.icon}
								</div>
							)
						}
						value={formatNumber(resources[resource])}
						sub={`${formatNumber(totalRate)}/s`}
						subClassName={totalRate > 0 ? 'text-green-400' : 'text-gray-400'}>
						<div className='px-tooltip text-sm min-w-[200px]'>
							<div className='px-tip-title mb-1'>{resourceInfo.label}</div>
							<div className='px-tip-muted text-xs mb-2'>{resourceInfo.description}</div>
							<div className='space-y-1 text-xs'>
								<div className='flex justify-between gap-4'>
									<span className='px-tip-muted'>Base Rate</span>
									<span>{formatNumber(baseRate)}/s</span>
								</div>
								<div className='flex justify-between gap-4'>
									<span className='px-tip-muted'>Modifier</span>
									<span className='text-green-400'>{modifierPercent}%</span>
								</div>
								<div className='flex justify-between gap-4 pt-1 border-t px-rule'>
									<span className='text-[#f0d27a]'>Total Rate</span>
									<span className='text-[#f0d27a]'>{formatNumber(totalRate)}/s</span>
								</div>
							</div>
						</div>
					</Chip>
				);
			})}

			{/* Gems are the rebirth currency (not a resource): shown once you have rebirthed or hold some */}
			{(rebirths > 0 || gems > 0) && (
				<Chip
					icon={<GemIcon scale={CHIP_ICON_SCALE} />}
					value={formatNumber(gems)}
					sub='Gems'
					subClassName='text-[#9be26a]'
					onClick={toggleLegacy}>
					<div className='px-tooltip text-sm min-w-[200px]'>
						<div className='px-tip-title mb-1'>Gems</div>
						<div className='px-tip-muted text-xs'>
							Earned by rebirthing. Click to open the Legacy window and spend them.
						</div>
					</div>
				</Chip>
			)}
		</>
	);
};

export default ResourceDisplay;
