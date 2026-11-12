import React, { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, HoverTip, Inset, Panel, SectionLabel, Slot } from '../../../../packages/design-system/src/components/primitives';
import { SelectBox } from '../../../../packages/design-system/src/components/composites';
import { HintTooltip } from '../../../../packages/design-system/src/components/tooltips';
import { compact, toRarity } from '../../../../packages/design-system/src/logic';
import { ITEM_CATALOG, RARITIES, RARITY_ORDER } from '@/catalog';
import { MERCHANT_GOODS, MERCHANT_SHOP_ITEMS } from '@/config/merchant';
import { pixelIconSrc } from '@/config/pixelIcons';
import { averageItemLevel, gearOf, slotQty } from '@/lib/inventory';
import { resolveItem, sellValueOf } from '@/lib/itemInstance';
import { isAutoSold } from '@/lib/loot/autoSell';
import { countJunk, junkFor } from '@/lib/loot/junk';
import { freeRefreshesLeft, refreshCooldown, refreshCost, secondsToRotation, shelfCells, shopPriceOf } from '@/lib/merchant';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import type { BagSlot, ItemInstance } from '@/types/game';
import { formatNumber, formatTime } from '@/utils/formatters';
import { sellPayout } from '@/utils/game/merchant';
import { itemIconName, slotProps } from '../itemUi';
import GameItemTip from '../hero/GameItemTip';

type Filter = 'all' | 'gear' | 'potion';

/** The look of an item in a slot: its picture and rarity glow. */
const look = (item?: ItemInstance, itemId?: string) => {
	const resolved = item ? resolveItem(item) : null;
	const def = resolved?.def ?? (itemId ? ITEM_CATALOG[itemId] : undefined);
	if (!def) return null;
	return {
		name: resolved?.name ?? def.name,
		icon: pixelIconSrc(itemIconName(def)),
		rarity: toRarity(String(resolved?.instance.rarity ?? def.rarity ?? 'common')),
	};
};

/** One thing on the shelf: its slot with the item card (compared with what you wear, the price on it), the price and a Buy button. */
const ShelfItem: React.FC<{ item?: ItemInstance; itemId?: string; price: number; gold: number; onBuy: () => void }> = ({
	item,
	itemId,
	price,
	gold,
	onBuy,
}) => {
	const l = look(item, itemId);
	if (!l) return null;
	const affordable = gold >= price;
	return (
		<div className='ds-shelf-item'>
			<HoverTip interactive closeDelayMs={100} tip={<GameItemTip item={item} itemId={itemId} compare={!!item} buyPrice={price} />}>
				<Slot large icon={l.icon} rarity={l.rarity} aria-label={l.name} />
			</HoverTip>
			<span className='ds-shelf-price'>
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img src={pixelIconSrc('gold')} alt='' />
				{compact(price)}
			</span>
			<Button
				tone={affordable ? 'stone' : 'dark'}
				disabled={!affordable}
				aria-label={`Buy ${l.name} for ${formatNumber(price)} gold`}
				title={affordable ? undefined : 'Not enough gold'}
				onClick={onBuy}
			>
				{affordable ? 'Buy' : 'Need more'}
			</Button>
		</div>
	);
};

/**
 * The Goods tab: today's shelf (rolled gear and the potions that are always in stock, a Buy button under each, the restock with its free refreshes, cooldown and price), then your bag to sell from (click sells one, Shift-click the stack, a filter for
 * all, gear or potions) next to the Quick sell paper: Sell junk, Sell common, Sell up to uncommon, Sell everything shown (asks twice) and the auto-sell level for new gear. Worn gear is never listed.
 */
const MerchantGoodsTab: React.FC = () => {
	const gold = useGameStore((state) => state.resources.gold);
	const stock = useGameStore((state) => state.merchantStock);
	const playSeconds = useGameStore((state) => state.playSeconds);
	const refreshes = useGameStore((state) => state.merchantRefreshes);
	const refreshState = useGameStore((state) => state.merchantRefresh);
	const worn = useGameStore((state) => Math.round(averageItemLevel(state.equipment)));
	const bag = useGameStore((state) => state.bag);
	const equipment = useGameStore((state) => state.equipment);
	const sellCtx = useGameStore(
		useShallow((state) => ({ merchantUpgrades: state.merchantUpgrades, prestige: state.prestige, tiles: state.tiles, idolLevels: state.idolLevels })),
	);
	const fighting = useGameStore((state) => !!state.combat.fight);
	const autoSellUpTo = useGameStore((state) => state.autoSellUpTo);
	const buyOffer = useGameStore((state) => state.buyOffer);
	const buyItem = useGameStore((state) => state.buyItem);
	const refresh = useGameStore((state) => state.refreshMerchantStock);
	const sellItem = useGameStore((state) => state.sellItem);
	const sellJunk = useGameStore((state) => state.sellJunk);
	const setAutoSell = useGameStore((state) => state.setAutoSell);
	const say = useUiStore((state) => state.showToast);
	const [filter, setFilter] = useState<Filter>('all');
	const [confirm, setConfirm] = useState(false);
	// the "sold out" countdown and the refresh timers move once a second
	const [, setTick] = useState(0);
	useEffect(() => {
		const id = setInterval(() => setTick((n) => n + 1), 1000);
		return () => clearInterval(id);
	}, []);

	const freeLeft = freeRefreshesLeft(refreshState, playSeconds);
	const wait = refreshCooldown(refreshState, playSeconds);
	const cost = freeLeft > 0 ? 0 : refreshCost(refreshes);
	const left = stock ? secondsToRotation(stock, playSeconds) : 0;
	const cells = shelfCells(
		stock,
		MERCHANT_SHOP_ITEMS.map(({ id }) => id),
	);

	const bought = (name: string, price: number) => say(`Purchased ${name} for ${formatNumber(price)} Gold`);

	// the bag as the sell list: every filled slot (kept with its bag index), by the chosen filter
	const entries = bag
		.map((slot: BagSlot, index) => ({ slot, index }))
		.filter((e): e is { slot: NonNullable<BagSlot>; index: number } => !!e.slot)
		.filter(({ slot }) => (filter === 'all' ? true : filter === 'gear' ? !!gearOf(slot) : !gearOf(slot)));
	const worthOf = (slot: NonNullable<BagSlot>): number => {
		const gear = gearOf(slot);
		const unit = gear ? sellValueOf(gear) : ('id' in slot ? ITEM_CATALOG[slot.id]?.sellValue : 0) || 0;
		return sellPayout(unit, slotQty(slot), sellCtx);
	};
	const junkCount = countJunk(bag, junkFor(equipment));
	const worth = entries.reduce((sum, e) => sum + worthOf(e.slot), 0);
	const plainWorth = bag.reduce((sum, slot) => {
		const gear = slot ? gearOf(slot) : null;
		return gear && isAutoSold(gear, 'uncommon') ? sum + sellPayout(sellValueOf(gear), 1, sellCtx) : sum;
	}, 0);

	const sell = (index: number, all: boolean) => {
		const slot = bag[index];
		if (!slot) return;
		const gear = gearOf(slot);
		const name = (gear && resolveItem(gear)?.name) || ('id' in slot ? ITEM_CATALOG[slot.id]?.name : undefined) || 'item';
		const qty = all ? slotQty(slot) : 1;
		const paid = sellItem(index, qty);
		if (paid > 0) say(`Sold ${qty > 1 ? `${formatNumber(qty)} x ` : ''}${name} for ${formatNumber(paid)} Gold`);
		else say(fighting ? 'Finish the fight first' : 'The merchant is not interested');
	};
	const sellRarity = (maxRarity: string) => {
		const { gold: paid, count } = sellJunk(maxRarity);
		say(count > 0 ? `Sold ${formatNumber(count)} piece${count === 1 ? '' : 's'} of gear for ${formatNumber(paid)} Gold` : 'No junk to sell');
	};
	const sellJunkRule = () => {
		const { gold: paid, count } = sellJunk();
		say(count > 0 ? `Sold ${formatNumber(count)} junk item${count === 1 ? '' : 's'} for ${formatNumber(paid)} Gold` : 'No junk to sell');
	};
	const sellShown = () => {
		if (!confirm) return setConfirm(true);
		setConfirm(false);
		let total = 0;
		let stacks = 0;
		for (const { slot, index } of entries) {
			const paid = sellItem(index, slotQty(slot));
			if (paid > 0) {
				total += paid;
				stacks += 1;
			}
		}
		say(
			stacks > 0
				? `Sold ${formatNumber(stacks)} stack${stacks === 1 ? '' : 's'} for ${formatNumber(total)} Gold`
				: fighting
					? 'Finish the fight first'
					: 'Nothing to sell',
		);
	};

	// Auto-sell may go up to (but never include) the two rarest tiers: those are never junk
	const autoChoices = RARITY_ORDER.slice(0, -2);

	return (
		<div className='ds-goods'>
			<Inset className='ds-shelf'>
				<div className='ds-shelf-head'>
					<SectionLabel>Today’s goods</SectionLabel>
					<span className='ds-dim' style={{ fontSize: 12 }}>
						Gear up to item level {worn + MERCHANT_GOODS.maxAboveAverage} (you wear {worn}). Potions never run out.
					</span>
					<span className='ds-dim' style={{ marginLeft: 'auto', fontSize: 12 }}>
						New stock in <b style={{ color: '#fff', fontWeight: 400 }}>{formatTime(left)}</b>
					</span>
					<HoverTip
						placement='below'
						align='center'
						tip={
							<HintTooltip
								title='Restock the shelf now'
								text={`${MERCHANT_GOODS.refresh.freePerWindow} refreshes are free every ${MERCHANT_GOODS.refresh.windowSec / 3600} hours of play, then each one costs double the last; ${MERCHANT_GOODS.refresh.cooldownSec} s between refreshes.`}
							/>
						}
					>
						<Button
							tone='gold'
							disabled={gold < cost || wait > 0}
							onClick={() => {
								if (refresh()) say(`Purchased a new shelf of goods${cost > 0 ? ` for ${formatNumber(cost)} Gold` : ''}`);
							}}
						>
							{wait > 0 ? `Wait ${formatTime(wait)}` : freeLeft > 0 ? `Restock · free (${freeLeft} left)` : `Restock · ${compact(cost)}`}
						</Button>
					</HoverTip>
				</div>
				<div className='ds-shelf-grid'>
					{cells.map((cell) => {
						if (cell.kind === 'offer') {
							const item = stock?.offers[cell.index];
							if (!item) return null;
							const price = shopPriceOf(item);
							const name = resolveItem(item)?.name ?? item.base;
							return (
								<ShelfItem
									key={`${cell.key}:${cell.index}`}
									item={item}
									price={price}
									gold={gold}
									onBuy={() => (buyOffer(cell.index) ? bought(name, price) : gold >= price && say('Your bag is full'))}
								/>
							);
						}
						const def = ITEM_CATALOG[cell.id];
						const price = MERCHANT_SHOP_ITEMS.find((entry) => entry.id === cell.id)?.price;
						if (!def || price === undefined) return null;
						return (
							<ShelfItem
								key={cell.key}
								itemId={cell.id}
								price={price}
								gold={gold}
								onBuy={() => (buyItem(cell.id, 1) ? bought(def.name, price) : gold >= price && say('Your bag is full'))}
							/>
						);
					})}
					{(!stock || stock.offers.length === 0) && (
						<p className='ds-dim' style={{ fontSize: 13 }}>
							The gear is sold out. New goods arrive soon.
						</p>
					)}
				</div>
			</Inset>
			<div className='ds-goods-low'>
				<Inset className='ds-sellbag'>
					<div className='ds-shelf-head'>
						<SectionLabel>Your bag</SectionLabel>
						<span className='ds-dim' style={{ fontSize: 12 }}>
							Worn gear is never listed.
						</span>
						<span className='ds-filters'>
							{(['all', 'gear', 'potion'] as const).map((f) => (
								<button key={f} type='button' data-active={filter === f} onClick={() => (setFilter(f), setConfirm(false))}>
									{f === 'all' ? 'All' : f === 'gear' ? 'Gear' : 'Potions'}
								</button>
							))}
						</span>
					</div>
					<div className='ds-sellbag-grid'>
						{entries.map(({ slot, index }) => {
							const props = slotProps(slot);
							const l = look(props.item, props.itemId);
							if (!l) return null;
							return (
								<HoverTip key={index} interactive closeDelayMs={100} tip={<GameItemTip item={props.item} itemId={props.itemId} compare hints='merchant' />}>
									<Slot icon={l.icon} rarity={l.rarity} count={props.qty} aria-label={l.name} onClick={(e) => sell(index, e.shiftKey)} />
								</HoverTip>
							);
						})}
					</div>
					<div className='ds-dim' style={{ fontSize: 12, marginTop: 'auto' }}>
						Click an item to sell one. Shift-click sells the stack.
					</div>
				</Inset>
				<Panel parchment className='ds-ledger ds-quick'>
					<div className='ds-capi'>Quick sell</div>
					<div className='ds-paper-row' style={{ height: 'auto', padding: '6px 0' }}>
						<span>{entries.length} shown</span>
						<b style={{ color: '#6a3f00' }}>{compact(worth)} gold</b>
					</div>
					<HoverTip
						fill
						tip={
							<HintTooltip
								title={junkCount > 0 ? `Sell ${formatNumber(junkCount)} junk` : 'No junk yet'}
								text='Junk materials from monsters, gear you marked as junk and gear well below what you wear. Mark gear from its right-click menu in the bag.'
							/>
						}
					>
						<Button tone='danger' style={{ minHeight: 40 }} disabled={fighting || junkCount === 0} onClick={sellJunkRule}>
							Sell junk{junkCount > 0 ? ` (${formatNumber(junkCount)})` : ''}
						</Button>
					</HoverTip>
					<div style={{ display: 'flex', gap: 6 }}>
						<Button style={{ flex: 1 }} disabled={fighting} onClick={() => sellRarity('common')}>
							Sell common
						</Button>
						<Button style={{ flex: 1 }} disabled={fighting || plainWorth <= 0} onClick={() => sellRarity('uncommon')}>
							Up to uncommon
						</Button>
					</div>
					<Button tone={confirm ? 'danger' : 'stone'} disabled={fighting || entries.length === 0} onClick={sellShown} onBlur={() => setConfirm(false)}>
						{confirm
							? `Sure? Sell ${entries.length} for ${compact(worth)}`
							: filter === 'all'
								? 'Sell everything shown'
								: filter === 'gear'
									? 'Sell all gear'
									: 'Sell all potions'}
					</Button>
					<div className='ds-paper-rule' />
					<label className='ds-paper-label'>
						Auto-sell new gear up to
						<SelectBox
							value={autoSellUpTo ?? ''}
							onChange={(v) => setAutoSell(v === '' ? null : v)}
							options={[['', 'Off (keep everything)'], ...autoChoices.map((id): [string, string] => [id, RARITIES[id].label])]}
						/>
					</label>
					<div className='ds-paper-foot' style={{ marginTop: 'auto' }}>
						Auto-sell never touches potions, set pieces or anything above the rarity you pick.
					</div>
				</Panel>
			</div>
		</div>
	);
};

export default MerchantGoodsTab;
