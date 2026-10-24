import React, { useEffect, useCallback } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { Resources } from '@/types/game';
import { formatNumber } from '@/utils/formatters';
import { FARM_PRODUCT_KEYS, HEADER_DISPLAYED_RESOURCES_INFO, RESOURCE_ICONS } from '@/config/gameConfig';
import { RESOURCE_PIXEL_ICONS } from '@/config/pixelIcons';
import { emitFloat, mergeItems, takeTileTap, FloatItem } from '@/lib/floatText';
import PixelIcon from './PixelIcon';
import StableNumber from './StableNumber';

const ResourceDisplay: React.FC = () => {
	const resources = useGameStore((state) => state.resources);
	const resourceRates = useGameStore((state) => state.resourceRates);
	const clickForGold = useGameStore((state) => state.clickForGold);

	// Define resources to display (including meat)
	const resourcesToDisplay = Object.keys(resources) as Array<keyof Resources>;

	// A real click on the map earns gold (rate limited in the store); a click on an owned tile also carries
	// that tile's tap bonus (already applied by the store). Both show up as one popup under the cursor.
	// Clicks on windows, the header or buttons never pay, and neither do synthetic clicks.
	const handleGameClick = useCallback(
		(e: MouseEvent) => {
			const items: FloatItem[] = [];

			const onMap = e.target instanceof Element && !!e.target.closest('[data-click-area]');
			if (onMap) {
				const goldToAdd = clickForGold({
					eventId: e.timeStamp,
					now: performance.now(),
					trusted: e.isTrusted,
				});
				if (goldToAdd > 0) items.push({ resource: 'gold', amount: goldToAdd });
			}

			const tap = takeTileTap();
			if (items.length === 0 && !tap) return;

			emitFloat({
				x: e.clientX,
				y: e.clientY,
				items: mergeItems(items, tap?.items ?? []),
				lucky: tap?.lucky,
			});
		},
		[clickForGold]
	);

	// Add global click listener
	useEffect(() => {
		window.addEventListener('click', handleGameClick);

		return () => {
			window.removeEventListener('click', handleGameClick);
		};
	}, [handleGameClick]);

	return (
		<>
			{resourcesToDisplay.map((resource) => {
				const baseRate = resourceRates.base[resource];
				const totalRate = resourceRates.total[resource];
				const modifier = resourceRates.modifiers[resource];

				// Format modifier as percentage
				const modifierPercent = Math.round(modifier * 100);

				if (resource === 'xp' || (FARM_PRODUCT_KEYS as readonly string[]).includes(resource)) {
					return null;
				}

				// Get resource info or use fallback for meat if not in header info
				const resourceInfo = (HEADER_DISPLAYED_RESOURCES_INFO as Record<string, { icon: string; label: string; description: string }>)[resource] || {
					icon: RESOURCE_ICONS[resource] || '🥩',
					label: resource.charAt(0).toUpperCase() + resource.slice(1),
					description: `${resource.charAt(0).toUpperCase() + resource.slice(1)} resource generated from farm animals`,
				};

				return (
					<div
						key={resource}
						className='group relative flex items-center justify-center gap-2 text-sm'>
						{RESOURCE_PIXEL_ICONS[resource] ? (
							<PixelIcon
								name={RESOURCE_PIXEL_ICONS[resource]!}
								alt={resource}
								shine={resource === 'gold'}
							/>
						) : (
							<div
								className='text-xl md:text-2xl'
								role='img'
								aria-label={resource}>
								{resourceInfo.icon}
							</div>
						)}
						{/* Fixed-width text block: digits sit in equal cells and the block reserves room for
						    the widest value, so growing numbers never shift the icon or the next resource */}
						<div className='flex flex-col'>
							<StableNumber
								value={formatNumber(resources[resource])}
								className='font-semibold text-sm md:text-base text-[#f1e6c8] min-w-[4.6em]'
							/>
							<StableNumber
								value={`${formatNumber(totalRate)}/s`}
								className={`text-xs min-w-[5.6em] ${
									totalRate > 0 ? 'text-green-400' : 'text-gray-400'
								}`}
							/>
						</div>

						{/* Tooltip */}
						<div className='absolute top-full left-1/2 -translate-x-1/2 mt-1 w-max opacity-0 group-hover:opacity-100 pointer-events-none z-[60] transition-opacity duration-150'>
							<div className='px-tooltip text-sm min-w-[200px]'>
								<div className='px-tip-title mb-1'>{resourceInfo.label}</div>
								<div className='px-tip-muted text-xs mb-2'>
									{resourceInfo.description}
								</div>
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
										<span className='text-[#f0d27a]'>
											{formatNumber(totalRate)}/s
										</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				);
			})}
		</>
	);
};

export default ResourceDisplay;
