import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { RESOURCES, RESOURCE_TIERS, resourcesInTier, type ResourceKey, type ResourceTier } from '@/catalog';
import { RESOURCE_ICONS } from '@/config/gameConfig';
import { RESOURCE_PIXEL_ICONS, SHINE_SHEETS } from '@/config/pixelIcons';
import { formatHeaderAmount, formatPercent, formatRateAuto } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import PixelIcon from './PixelIcon';
import StableNumber from './StableNumber';
import HeaderTip from './HeaderTip';

const ICON_SCALE = 0.5; // the 40px sprites drawn at 20px
/** Room for the longest ordinary amount ("12.3K") at the small header size, so a chip keeps its width while its number ticks */
const AMOUNT_SLOT = '2.8em';

const exactOf = (n: number) => Math.floor(n).toLocaleString('en-US');

const iconOf = (key: ResourceKey) => {
	const name = RESOURCE_PIXEL_ICONS[key];
	return name ? (
		<PixelIcon name={name} alt={RESOURCES[key].label} scale={ICON_SCALE} shine={!!SHINE_SHEETS[name]} />
	) : (
		<span className='text-base leading-none' role='img' aria-label={RESOURCES[key].label}>
			{RESOURCE_ICONS[key]}
		</span>
	);
};

interface Row {
	key: ResourceKey;
	amount: number;
	/** Production per second; left out for currencies that nothing produces (gems, embers) */
	rate?: number;
	/** Income bonus as a fraction (0.2 = +20%) */
	bonus?: number;
}

interface GroupProps {
	tier: { id: ResourceTier; label: string };
	rows: Row[];
	showNumbers: boolean;
	align: 'center' | 'start';
	onOpenEmbers: () => void;
}

/**
 * One tier of the resource catalog: a boxed strip of small icons (with small amounts when the cog menu asks for them). Hovering it
 * opens a list of every resource in the tier with its amount and production; a click pins that list open (touch screens, or just to
 * read it for a while). A tier can grow to dozens of resources and the strip stays as wide as its icons.
 */
const ResourceGroup: React.FC<GroupProps> = ({ tier, rows, showNumbers, align, onOpenEmbers }) => {
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

	const hasEmbers = rows.some((row) => row.key === 'embers');

	return (
		<div
			ref={ref}
			className='hdr-group hdr-has-tip'
			data-pinned={pinned}
			role='button'
			tabIndex={0}
			aria-label={`${tier.label}: show the list`}
			onClick={() => setPinned((p) => !p)}
			onKeyDown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					setPinned((p) => !p);
				}
			}}>
			{rows.map((row) => {
				const isEmbers = row.key === 'embers';
				return (
					<span
						key={row.key}
						className={cn('hdr-chip', isEmbers && 'is-link')}
						title={RESOURCES[row.key].label}
						onClick={
							isEmbers
								? (event) => {
										event.stopPropagation();
										onOpenEmbers();
									}
								: undefined
						}>
						{iconOf(row.key)}
						{showNumbers && <StableNumber value={formatHeaderAmount(row.amount)} minWidth={AMOUNT_SLOT} className='font-semibold text-[11px] text-[#f1e6c8]' />}
					</span>
				);
			})}
			<HeaderTip align={align} width={270}>
				<div className='px-tip-title mb-1'>{tier.label}</div>
				<div className='hdr-rows text-xs'>
					{rows.map((row) => {
						const production = row.rate === undefined ? null : formatRateAuto(row.rate);
						const bonus = row.bonus !== undefined && row.bonus > 0.0005 ? `+${formatPercent(row.bonus * 100)}` : null;
						return (
							<React.Fragment key={row.key}>
								{iconOf(row.key)}
								<span className='px-tip-muted truncate' title={bonus ? `Bonus ${bonus}` : undefined}>
									{RESOURCES[row.key].label}
								</span>
								<span className='text-[#f1e6c8] text-right' title={exactOf(row.amount)}>
									{formatHeaderAmount(row.amount)}
								</span>
								<span className={cn('text-right min-w-[4.5em]', production ? 'text-[#f0d27a]' : 'px-tip-muted')}>
									{row.rate === undefined ? '' : (production ?? 'none')}
								</span>
							</React.Fragment>
						);
					})}
				</div>
				{hasEmbers && <div className='pt-1 mt-1 border-t px-rule text-xs text-[#9be26a]'>Click the green gem to open the Ember shop.</div>}
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
	const compact = useUiStore((state) => state.compactHeader);
	const toggleRebirth = useUiStore((state) => state.toggleRebirth);

	const amountOf = (key: ResourceKey): number =>
		key === 'gems' ? gems : key === 'embers' ? embers : (resources as unknown as Record<string, number>)[key] ?? 0;

	return (
		<>
			{RESOURCE_TIERS.map((tier, t) => {
				const keys = resourcesInTier(tier.id);
				if (keys.length === 0) return null;
				const rows: Row[] = keys.map((key) => {
					// production only exists for what the land and farm make; gems and embers come in lumps
					const produced = key in resources && key !== 'xp';
					return {
						key,
						amount: amountOf(key),
						rate: produced ? resourceRates.total[key as keyof typeof resourceRates.total] : undefined,
						bonus: produced ? resourceRates.modifiers[key as keyof typeof resourceRates.modifiers] : undefined,
					};
				});
				return <ResourceGroup key={tier.id} tier={tier} rows={rows} showNumbers={!compact} align={t === 0 ? 'start' : 'center'} onOpenEmbers={toggleRebirth} />;
			})}
		</>
	);
};

export default ResourceDisplay;
