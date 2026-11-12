import React, { useEffect, useRef, useState } from 'react';
import { Button, Divider, Inset, Panel, SectionLabel, Slot } from '../../../../packages/design-system/src/components/primitives';
import { AmountInput } from '../../../../packages/design-system/src/components/composites';
import { clampAmount, compact } from '../../../../packages/design-system/src/logic';
import { MERCHANT_BUYABLE, MERCHANT_BUY_MULTIPLIER, MERCHANT_RESOURCE_INFO, MERCHANT_RESOURCE_PRICES } from '@/config/merchant';
import { RESOURCE_PIXEL_ICONS, pixelIconSrc, type PixelIconName } from '@/config/pixelIcons';
import { useGameStore } from '@/stores/gameStore';
import { MERCHANT_CUSTOM_MAX, useUiStore } from '@/stores/uiStore';
import { formatNumber, formatRate, parseAmount, tidy } from '@/utils/formatters';
import { buyCost, sellMultiplier, sellPayout } from '@/utils/game/merchant';

type ResourceKey = keyof typeof MERCHANT_RESOURCE_PRICES;
const RESOURCES = Object.keys(MERCHANT_RESOURCE_PRICES) as ResourceKey[];
const isBuyable = (resource: ResourceKey) => (MERCHANT_BUYABLE as readonly string[]).includes(resource);
const GREEN = '#17561f';
const BLUE = '#1a3f92';

const iconOf = (key: string): string => pixelIconSrc((RESOURCE_PIXEL_ICONS[key] ?? 'gold') as PixelIconName);

/** How much one Sell or Buy moves: a number of units, or all of it (everything you hold, or everything you can pay for). */
type Amount = number | 'max';
const PRESETS = [
	{ id: 1_000, label: '1K' },
	{ id: 1_000_000, label: '1M' },
	{ id: 1_000_000_000, label: '1B' },
	{ id: 'max', label: 'Max' },
];

/**
 * The Resources tab: the stock ledger on paper (what you hold, income, what a unit sells for with Haggler, what it costs) and the trade ticket of the selected resource with the amount (1K, 1M, 1B, Max, a typed amount or the slider),
 * what you receive or pay, and the Sell / Buy button. The amount you set is remembered (also across visits); a click on a resource in the top bar opens the Merchant with that row selected.
 */
const MerchantResourcesTab: React.FC = () => {
	const resources = useGameStore((state) => state.resources);
	const resourceRates = useGameStore((state) => state.resourceRates);
	const merchantUpgrades = useGameStore((state) => state.merchantUpgrades);
	const prestige = useGameStore((state) => state.prestige);
	const sellResources = useGameStore((state) => state.sellResources);
	const buyResource = useGameStore((state) => state.buyResource);
	const showToast = useUiStore((state) => state.showToast);
	// kept in the ui store (and remembered): they survive switching tabs or closing the window
	const preset = useUiStore((state) => state.merchantPreset);
	const setPreset = useUiStore((state) => state.setMerchantPreset);
	const custom = useUiStore((state) => state.merchantCustom);
	const setCustom = useUiStore((state) => state.setMerchantCustom);
	const picked = useUiStore((state) => state.merchantSelect);
	const clearPicked = useUiStore((state) => state.clearMerchantSelect);
	const [local, setLocal] = useState<ResourceKey>(RESOURCES[0]);
	const [mode, setMode] = useState<'sell' | 'buy'>('sell');
	const tableRef = useRef<HTMLDivElement>(null);

	const selected: ResourceKey = picked && (RESOURCES as string[]).includes(picked) ? (picked as ResourceKey) : local;
	// bring the selected row into view when the selection changes, not on every render (the player may have scrolled away since)
	useEffect(() => {
		if (picked) tableRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
	}, [picked]);

	const ctx = { merchantUpgrades, prestige };
	const haggle = sellMultiplier(ctx);
	const info = MERCHANT_RESOURCE_INFO[selected];
	const price = MERCHANT_RESOURCE_PRICES[selected];
	const canBuy = isBuyable(selected);
	const buying = mode === 'buy' && canBuy;
	const have = resources[selected];
	const rate = resourceRates.total[selected as keyof typeof resourceRates.total] ?? 0;

	// the most one click can move: all you hold, or all the gold buys (whole units)
	const affordable = canBuy ? Math.floor(resources.gold / (price * MERCHANT_BUY_MULTIPLIER)) : 0;
	const max = buying ? affordable : Math.floor(have);
	// a typed amount wins while it reads as a number; a preset click clears it
	const typed = custom.trim() === '' ? null : parseAmount(custom);
	const wanted: Amount = typed ?? (preset as Amount);
	const units = wanted === 'max' ? (buying ? affordable : have) : Math.min(wanted, max);
	const shown = wanted === 'max' ? max : clampAmount(wanted, max);

	const gold = buying ? buyCost(selected, Math.max(0, Math.floor(units))) : sellPayout(price, units, ctx);
	const base = buying ? gold : price * units;
	const bonus = buying ? 0 : gold - base;
	const canAct = buying ? units >= 1 : units > 0;

	const act = () => {
		if (!canAct) return;
		if (buying) {
			if (buyResource(selected, units)) showToast(`Purchased ${info.label} x${formatNumber(units)} for ${formatNumber(gold)} Gold`);
		} else if (sellResources(selected, units)) showToast(`Sold ${formatNumber(units)} ${info.label} for ${formatNumber(gold)} Gold`);
	};
	const pick = (key: ResourceKey) => {
		clearPicked();
		setLocal(key);
		if (!isBuyable(key)) setMode('sell');
	};

	return (
		<div className='ds-merch-res'>
			<Panel parchment className='ds-ledger ds-stock'>
				<div className='ds-capi'>Stock ledger</div>
				<div className='ds-stock-head'>
					<span>Resource</span>
					<span>You have</span>
					<span>Income</span>
					<span>Sell</span>
					<span>Buy</span>
				</div>
				<div ref={tableRef}>
					{RESOURCES.map((key) => {
						const r = resourceRates.total[key as keyof typeof resourceRates.total] ?? 0;
						const rowBuyable = isBuyable(key);
						return (
							<button
								type='button'
								key={key}
								className='ds-stock-row'
								data-active={key === selected}
								title={`${MERCHANT_RESOURCE_INFO[key].label}: ${MERCHANT_RESOURCE_INFO[key].priceDescription}`}
								onClick={() => pick(key)}
							>
								<span className='ds-stock-name'>
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img src={iconOf(key)} alt='' />
									{MERCHANT_RESOURCE_INFO[key].label}
								</span>
								<span>{compact(Math.floor(resources[key]))}</span>
								<span style={{ color: r ? GREEN : '#8a7a5a' }}>{r ? `+${Math.round(r)}/s` : '—'}</span>
								<span>{tidy((MERCHANT_RESOURCE_PRICES[key] * haggle).toFixed(2))}</span>
								<span style={{ color: rowBuyable ? BLUE : '#8a7a5a' }}>
									{rowBuyable ? tidy((MERCHANT_RESOURCE_PRICES[key] * MERCHANT_BUY_MULTIPLIER).toFixed(2)) : 'not sold'}
								</span>
							</button>
						);
					})}
				</div>
				<div className='ds-paper-foot'>
					Prices per unit in gold. Haggler: +{formatNumber((haggle - 1) * 100)}% on sales. Buying costs {MERCHANT_BUY_MULTIPLIER}x base. Goods you do not buy
					are earned, never bought.
				</div>
			</Panel>

			<Panel className='ds-ticket'>
				<div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
					<Slot large icon={iconOf(selected)} />
					<div>
						<div style={{ fontSize: 18 }}>{info.label}</div>
						<div className='ds-dim' style={{ fontSize: 12 }}>
							You have {compact(Math.floor(have))}
							{rate ? ` · ${formatRate(rate)} income` : ''}
						</div>
					</div>
				</div>
				<div style={{ display: 'flex', gap: 6 }}>
					<Button className='ds-mode-sell' data-selected={!buying} style={{ flex: 1 }} onClick={() => setMode('sell')}>
						Sell
					</Button>
					<Button className='ds-mode-buy' data-selected={buying} style={{ flex: 1 }} disabled={!canBuy} onClick={() => setMode('buy')}>
						Buy
					</Button>
				</div>
				<AmountInput
					value={shown}
					max={max}
					text={custom}
					onTextChange={setCustom}
					presets={PRESETS}
					activePreset={preset}
					onPreset={(id) => {
						setPreset(id as Amount);
						setCustom('');
					}}
					onSlider={(n) => setCustom(String(n))}
					parse={parseAmount}
					format={compact}
					maxLength={MERCHANT_CUSTOM_MAX}
				/>
				<Inset style={{ fontSize: 13 }}>
					<div style={{ display: 'flex', justifyContent: 'space-between' }}>
						<span className='ds-dim'>
							{formatNumber(units)} × {tidy((buying ? price * MERCHANT_BUY_MULTIPLIER : price).toFixed(2))} gold
						</span>
						<span>{compact(base)}</span>
					</div>
					{!buying ? (
						<div style={{ display: 'flex', justifyContent: 'space-between' }}>
							<span className='ds-dim'>Haggler +{formatNumber((haggle - 1) * 100)}%</span>
							<span className='ds-good'>+{compact(bonus)}</span>
						</div>
					) : null}
					<Divider />
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
						<SectionLabel>{buying ? 'You pay' : 'You receive'}</SectionLabel>
						<span style={{ fontSize: 22, color: !buying || resources.gold >= gold ? 'var(--ds-good)' : 'var(--ds-bad)' }}>{compact(gold)} gold</span>
					</div>
				</Inset>
				<Button tone='gold' size='sm' style={{ minHeight: 38 }} disabled={!canAct} onClick={act}>
					{buying ? 'Buy' : 'Sell'} {compact(units)} {info.label.toLowerCase()}
				</Button>
			</Panel>
		</div>
	);
};

export default MerchantResourcesTab;
