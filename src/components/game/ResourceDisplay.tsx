import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { RESOURCES, RESOURCE_TIERS, resourcesInTier, type ResourceKey } from '@/catalog';
import { RESOURCE_ICONS } from '@/config/gameConfig';
import { RESOURCE_PIXEL_ICONS, SHINE_SHEETS } from '@/config/pixelIcons';
import { formatHeaderAmount, formatPercent, formatRateAuto } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import PixelIcon from './PixelIcon';
import StableNumber from './StableNumber';
import HeaderTip, { TipLine } from './HeaderTip';

const CHIP_ICON_SCALE = 0.5; // the 40px sprites drawn at 20px
const TIP_ICON_SCALE = 0.8; // 32px in the tooltip
/** Room for the longest ordinary amount ("12.3K"), so a chip keeps its width while its number ticks */
const AMOUNT_SLOT = '2.9em';

const exactOf = (n: number) => Math.floor(n).toLocaleString('en-US');

const iconOf = (key: ResourceKey, scale: number) => {
	const name = RESOURCE_PIXEL_ICONS[key];
	return name ? (
		<PixelIcon name={name} alt={RESOURCES[key].label} scale={scale} shine={!!SHINE_SHEETS[name]} />
	) : (
		<span className='text-lg' role='img' aria-label={RESOURCES[key].label}>
			{RESOURCE_ICONS[key]}
		</span>
	);
};

interface ChipProps {
	resource: ResourceKey;
	amount: number;
	/** Production per second; left out for currencies that nothing produces (gems, embers) */
	rate?: number;
	/** Income bonus as a fraction (0.2 = +20%) */
	bonus?: number;
	hint?: string;
	/** Overrides the click that pins the tooltip (the Embers chip opens the rebirth window instead) */
	onActivate?: () => void;
	align?: 'center' | 'start';
}

/**
 * One currency in the header: a small icon and the amount. The tooltip (hover, or pinned by a click for touch screens) has
 * the name, the exact amount and the production per second / minute / hour, whichever reads best.
 */
const ResourceChip: React.FC<ChipProps> = ({ resource, amount, rate, bonus = 0, hint, onActivate, align }) => {
	const [pinned, setPinned] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!pinned) return;
		const away = (event: PointerEvent) => {
			if (!ref.current?.contains(event.target as Node)) setPinned(false);
		};
		const escape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setPinned(false);
		};
		document.addEventListener('pointerdown', away);
		document.addEventListener('keydown', escape);
		return () => {
			document.removeEventListener('pointerdown', away);
			document.removeEventListener('keydown', escape);
		};
	}, [pinned]);

	const label = RESOURCES[resource].label;
	const activate = onActivate ?? (() => setPinned((p) => !p));
	const production = rate === undefined ? undefined : formatRateAuto(rate);

	return (
		<div
			ref={ref}
			className={cn('hdr-pill hdr-has-tip', onActivate && 'cursor-pointer')}
			data-pinned={pinned}
			role='button'
			tabIndex={0}
			aria-label={`${label}: ${exactOf(amount)}`}
			onClick={activate}
			onKeyDown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					activate();
				}
			}}>
			{iconOf(resource, CHIP_ICON_SCALE)}
			<StableNumber value={formatHeaderAmount(amount)} minWidth={AMOUNT_SLOT} className='font-semibold text-[12px] text-[#f1e6c8]' />
			<HeaderTip align={align}>
				<div className='flex items-center gap-2'>
					{iconOf(resource, TIP_ICON_SCALE)}
					<div className='px-tip-title flex-1'>{label}</div>
					<div className='text-xs text-[#f1e6c8]'>{exactOf(amount)}</div>
				</div>
				{(rate !== undefined || hint) && (
					<div className='pt-1 mt-1 border-t px-rule space-y-1 text-xs'>
						{rate !== undefined && <TipLine label='Production' value={production ?? 'None yet'} accent={!!production} />}
						{rate !== undefined && bonus > 0.0005 && <TipLine label='Bonus' value={`+${formatPercent(bonus * 100)}`} />}
						{hint && <div className='text-[#9be26a]'>{hint}</div>}
					</div>
				)}
			</HeaderTip>
		</div>
	);
};

/**
 * The currencies and materials, one boxed group per tier of the resource catalog (Currency | base materials | T1 materials).
 * A new tier or resource shows up here by being added to the catalog.
 */
const ResourceDisplay: React.FC = () => {
	const resources = useGameStore((state) => state.resources);
	const resourceRates = useGameStore((state) => state.resourceRates);
	const gems = useGameStore((state) => state.gems);
	const embers = useGameStore((state) => state.prestige.legacyPoints); // saved under its old name, see PrestigeState
	const toggleRebirth = useUiStore((state) => state.toggleRebirth);

	const amountOf = (key: ResourceKey): number =>
		key === 'gems' ? gems : key === 'embers' ? embers : (resources as unknown as Record<string, number>)[key] ?? 0;

	return (
		<>
			{RESOURCE_TIERS.map((tier, t) => {
				const keys = resourcesInTier(tier.id);
				if (keys.length === 0) return null;
				return (
					<div className='hdr-group' key={tier.id} role='group' aria-label={tier.label}>
						{keys.map((key, i) => {
							// production only exists for what the land and farm make; gems and embers come in lumps
							const produced = key in resources && key !== 'xp';
							return (
								<ResourceChip
									key={key}
									resource={key}
									amount={amountOf(key)}
									rate={produced ? resourceRates.total[key as keyof typeof resourceRates.total] : undefined}
									bonus={produced ? resourceRates.modifiers[key as keyof typeof resourceRates.modifiers] : undefined}
									hint={key === 'embers' ? 'Click to open the Ember shop.' : undefined}
									onActivate={key === 'embers' ? toggleRebirth : undefined}
									align={t === 0 && i === 0 ? 'start' : 'center'}
								/>
							);
						})}
					</div>
				);
			})}
		</>
	);
};

export default ResourceDisplay;
