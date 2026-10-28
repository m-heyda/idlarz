import React, { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { MERCHANT_BUYABLE, MERCHANT_BUY_MULTIPLIER, MERCHANT_RESOURCE_INFO, MERCHANT_RESOURCE_PRICES } from '@/config/gameConfig';
import { formatCompact, formatNumber } from '@/utils/formatters';
import { buyCost, sellMultiplier, sellPayout } from '@/utils/gameUtils';
import ResourceIcon from '../../ResourceIcon';
import { TipButton } from './TipButton';
import '@/styles/Inventory.css';

type ResourceKey = keyof typeof MERCHANT_RESOURCE_PRICES;
const RESOURCES = Object.keys(MERCHANT_RESOURCE_PRICES) as ResourceKey[];
const isBuyable = (resource: ResourceKey) => (MERCHANT_BUYABLE as readonly string[]).includes(resource);

/** How much one Sell or Buy click moves: a number of units, a share of what you hold (or can pay for), or all of it. */
type Amount = 1 | 10 | 100 | 0.25 | 0.5 | 'max';
const AMOUNTS: { value: Amount; label: string }[] = [
	{ value: 1, label: '1' },
	{ value: 10, label: '10' },
	{ value: 100, label: '100' },
	{ value: 0.25, label: '25%' },
	{ value: 0.5, label: '50%' },
	{ value: 'max', label: 'Max' },
];

/** `amount` of `have` units: a count (at most `have`, whole units), a share of them (rounded down), or all of them (as they are, unless `whole`). */
const amountOf = (amount: Amount, have: number, whole: boolean): number => {
	if (amount === 'max') return whole ? Math.floor(have) : have;
	if (amount < 1) return Math.floor(have * amount);
	return Math.min(amount, Math.floor(have));
};

/** The label of a Sell or Buy button: the number of units it moves, "all" / "max" for everything. */
const unitsLabel = (amount: Amount, units: number) => (amount === 'max' ? 'all' : formatCompact(units));

/**
 * The Resources tab: one row per resource (what you hold, what it sells for with Haggler, what it costs) and one amount for every Sell and
 * Buy button, picked once at the top. The gold a click pays or costs shows when the pointer rests on the button.
 */
export const MerchantResources: React.FC = () => {
	const resources = useGameStore((state) => state.resources);
	const merchantUpgrades = useGameStore((state) => state.merchantUpgrades);
	const prestige = useGameStore((state) => state.prestige);
	const sellResources = useGameStore((state) => state.sellResources);
	const buyResource = useGameStore((state) => state.buyResource);
	const showToast = useUiStore((state) => state.showToast);
	const [amount, setAmount] = useState<Amount>(10);

	const ctx = { merchantUpgrades, prestige };
	const haggle = sellMultiplier(ctx);
	const unitsToBuy = (resource: ResourceKey) =>
		isBuyable(resource) ? amountOf(amount, Math.floor(resources.gold / (MERCHANT_RESOURCE_PRICES[resource] * MERCHANT_BUY_MULTIPLIER)), true) : 0;

	const sell = (resource: ResourceKey) => {
		const units = amountOf(amount, resources[resource], false);
		if (units <= 0) return;
		const gold = sellPayout(MERCHANT_RESOURCE_PRICES[resource], units, ctx);
		if (sellResources(resource, units)) showToast(`Sold ${formatNumber(units)} ${MERCHANT_RESOURCE_INFO[resource].label} for ${formatNumber(gold)} Gold`);
	};

	const buy = (resource: ResourceKey) => {
		const units = unitsToBuy(resource);
		if (units < 1) return;
		const price = buyCost(resource, units);
		if (buyResource(resource, units)) showToast(`Purchased ${MERCHANT_RESOURCE_INFO[resource].label} x${formatNumber(units)} for ${formatNumber(price)} Gold`);
	};

	return (
		<div className='px-card'>
			<div className='mr-amounts' role='group' aria-label='Amount to sell or buy'>
				<span className='text-xs text-[#a89878]'>Amount</span>
				{AMOUNTS.map(({ value, label }) => (
					<button key={String(value)} className='px-btn px-btn-sm mr-chip' data-active={amount === value} aria-pressed={amount === value} onClick={() => setAmount(value)}>
						{label}
					</button>
				))}
				<span className='text-xs text-[#a89878] mr-note'>
					Selling pays +{formatNumber((haggle - 1) * 100)}% (Haggler), buying costs {MERCHANT_BUY_MULTIPLIER}x the base price
				</span>
			</div>

			<div className='mr-table'>
				<div className='mr-row mr-head'>
					<span />
					<span>Resource</span>
					<span className='mr-num'>You have</span>
					<span className='mr-num'>Sells for</span>
					<span className='mr-num'>Costs</span>
					<span />
					<span />
				</div>
				{RESOURCES.map((resource) => {
					const info = MERCHANT_RESOURCE_INFO[resource];
					const price = MERCHANT_RESOURCE_PRICES[resource];
					const sellUnits = amountOf(amount, resources[resource], false);
					const sellGold = sellPayout(price, sellUnits, ctx);
					const canBuy = isBuyable(resource);
					const buyUnits = unitsToBuy(resource);
					return (
						<div className='mr-row' key={resource} title={`${info.label}: ${info.priceDescription}`}>
							<ResourceIcon resource={resource} scale={1} />
							<span className='mr-name'>{info.label}</span>
							<span className='mr-num'>{formatNumber(Math.floor(resources[resource]))}</span>
							<span className='mr-num text-yellow-400'>
								{formatNumber(price * haggle)} <ResourceIcon resource='gold' />
							</span>
							<span className='mr-num text-yellow-400'>
								{canBuy ? (
									<>
										{formatNumber(price * MERCHANT_BUY_MULTIPLIER)} <ResourceIcon resource='gold' />
									</>
								) : (
									<span className='text-[#6a5a48]'>-</span>
								)}
							</span>
							<TipButton
								className='px-btn px-btn-sm px-btn-gold'
								label={<>Sell {unitsLabel(amount, sellUnits)}</>}
								ariaLabel={`Sell ${formatNumber(sellUnits)} ${info.label} for ${formatNumber(sellGold)} gold`}
								disabled={sellUnits <= 0}
								onClick={() => sell(resource)}
								tip={
									sellUnits > 0 ? (
										<span className='text-yellow-400'>
											{formatNumber(sellUnits)} {info.label} pays +{formatNumber(sellGold)} <ResourceIcon resource='gold' />
										</span>
									) : (
										<span className='px-tip-muted'>You have none to sell</span>
									)
								}
							/>
							{canBuy ? (
								<TipButton
									label={<>Buy {unitsLabel(amount, buyUnits)}</>}
									ariaLabel={`Buy ${formatNumber(buyUnits)} ${info.label} for ${formatNumber(buyCost(resource, buyUnits))} gold`}
									disabled={buyUnits < 1}
									onClick={() => buy(resource)}
									tip={
										buyUnits >= 1 ? (
											<span className='text-yellow-400'>
												{formatNumber(buyUnits)} {info.label} costs {formatNumber(buyCost(resource, buyUnits))} <ResourceIcon resource='gold' />
											</span>
										) : (
											<span className='text-[#ff8a6a]'>Not enough gold for one</span>
										)
									}
								/>
							) : (
								<span />
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
};
