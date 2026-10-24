import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { Resources } from '@/types/game';
import { formatNumber } from '@/utils/formatters';
import {
	GEMS_INFO,
	HEADER_DISPLAYED_RESOURCES_INFO,
	MERCHANT_RESOURCE_PRICES,
	RESOURCE_ICONS,
} from '@/config/gameConfig';
import { RESOURCE_PIXEL_ICONS } from '@/config/pixelIcons';
import PixelIcon from './PixelIcon';
import GemIcon from './GemIcon';
import StableNumber from './StableNumber';

const PILL_ICON_SCALE = 0.6; // the 40px sprites drawn at 24px
const TIP_ICON_SCALE = 0.8; // 32px in the tooltip

/** Header order: money, building materials, food, farm products. Gems (the rebirth currency) close the row. */
const GROUPS: (keyof Resources)[][] = [['gold'], ['wood', 'stone', 'coal'], ['food', 'meat'], ['eggs', 'milk', 'hide']];

interface Info {
	label: string;
	description: string;
	usedFor?: string;
	source?: string;
}

const infoOf = (resource: string): Info =>
	(HEADER_DISPLAYED_RESOURCES_INFO as Record<string, Info>)[resource] ?? {
		label: resource.charAt(0).toUpperCase() + resource.slice(1),
		description: '',
	};

interface PillProps {
	icon: React.ReactNode;
	tipIcon: React.ReactNode;
	value: string;
	info: Info;
	/** The exact amount, shown in the tooltip */
	exact: string;
	onClick?: () => void;
	children?: React.ReactNode; // extra tooltip lines
}

/**
 * One currency in the header: just the icon and the amount. Everything else (what it is, what it is for, where it comes
 * from, the rates) is in the tooltip.
 */
const Pill: React.FC<PillProps> = ({ icon, tipIcon, value, info, exact, onClick, children }) => (
	<div className={`hdr-pill ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick} aria-label={`${info.label}: ${exact}`}>
		{icon}
		{/* digits sit in equal cells so a ticking number never nudges its neighbours */}
		<StableNumber value={value} className='font-semibold text-[12px] text-[#f1e6c8] min-w-[3.6em]' />
		<div className='hdr-tip'>
			<div className='px-tooltip text-sm w-[300px]'>
				<div className='flex items-center gap-2 mb-1'>
					{tipIcon}
					<div className='flex-1'>
						<div className='px-tip-title'>{info.label}</div>
						<div className='text-xs text-[#f1e6c8]'>{exact}</div>
					</div>
				</div>
				{info.description && <div className='px-tip-muted text-xs mb-2'>{info.description}</div>}
				<div className='space-y-1 text-xs'>
					{info.usedFor && (
						<div>
							<span className='text-[#f0d27a]'>Used for: </span>
							<span>{info.usedFor}</span>
						</div>
					)}
					{info.source && (
						<div>
							<span className='text-[#f0d27a]'>Comes from: </span>
							<span>{info.source}</span>
						</div>
					)}
					{children}
				</div>
			</div>
		</div>
	</div>
);

const Line: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
	<div className={`flex justify-between gap-4 ${accent ? 'text-[#f0d27a]' : ''}`}>
		<span className={accent ? '' : 'px-tip-muted'}>{label}</span>
		<span>{value}</span>
	</div>
);

const ResourceDisplay: React.FC = () => {
	const resources = useGameStore((state) => state.resources);
	const resourceRates = useGameStore((state) => state.resourceRates);
	const gems = useGameStore((state) => state.prestige.legacyPoints);
	const toggleLegacy = useUiStore((state) => state.toggleLegacy);

	const exactOf = (n: number) => Math.floor(n).toLocaleString('en-US');

	return (
		<>
			{GROUPS.map((group, g) => (
				<div className='hdr-group' key={g}>
					{group
						.filter((resource) => resource in resources)
						.map((resource) => {
							const info = infoOf(resource);
							const rate = resourceRates.total[resource];
							const price = (MERCHANT_RESOURCE_PRICES as Record<string, number>)[resource];
							const iconName = RESOURCE_PIXEL_ICONS[resource];
							const make = (scale: number) =>
								iconName ? (
									<PixelIcon name={iconName} alt={resource} scale={scale} shine={resource === 'gold'} />
								) : (
									<span className='text-xl' role='img' aria-label={resource}>
										{RESOURCE_ICONS[resource as keyof typeof RESOURCE_ICONS]}
									</span>
								);
							return (
								<Pill
									key={resource}
									icon={make(PILL_ICON_SCALE)}
									tipIcon={make(TIP_ICON_SCALE)}
									value={formatNumber(resources[resource])}
									exact={exactOf(resources[resource])}
									info={info}>
									<div className='pt-1 mt-1 border-t px-rule space-y-1'>
										<Line label='Per second' value={`${formatNumber(rate)}/s`} accent />
										<Line label='Per minute' value={formatNumber(rate * 60)} />
										<Line label='Per hour' value={formatNumber(rate * 3600)} />
										<Line label='Base rate' value={`${formatNumber(resourceRates.base[resource])}/s`} />
										<Line label='Modifier' value={`+${Math.round(resourceRates.modifiers[resource] * 100)}%`} />
										{price !== undefined && <Line label='Merchant pays' value={`${price} gold each`} />}
									</div>
								</Pill>
							);
						})}
				</div>
			))}

			{/* Gems: the rebirth currency (not a resource); click to open the Legacy window */}
			<div className='hdr-group'>
				<Pill
					icon={<GemIcon scale={PILL_ICON_SCALE} />}
					tipIcon={<GemIcon scale={TIP_ICON_SCALE} />}
					value={formatNumber(gems)}
					exact={exactOf(gems)}
					info={GEMS_INFO}
					onClick={toggleLegacy}>
					<div className='pt-1 mt-1 border-t px-rule text-[#9be26a]'>Click to open the Legacy window.</div>
				</Pill>
			</div>
		</>
	);
};

export default ResourceDisplay;
