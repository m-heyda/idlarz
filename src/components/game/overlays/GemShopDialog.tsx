import React, { useEffect, useState } from 'react';
import { GEM_CONFIRM_ABOVE, GEM_SHOP, type GemItem, type GemShopTab } from '@/config/gemShop';
import { CHARACTER_NAME_MAX } from '@/lib/authValidation';
import { useGameStore } from '@/stores/gameStore';
import { useGemStore } from '@/stores/gemStore';
import { useUiStore } from '@/stores/uiStore';
import { notify } from '@/lib/notices';
import { formatNumber } from '@/utils/formatters';
import GameModal from '../GameModal';
import { useBadgeChoice } from '../BadgeDialog';
import { Button, Tabs } from '../../../../packages/design-system/src/components/primitives';
import GemIcon from '../GemIcon';
import DailyBoard from '../DailyBoard';

const DAY = 86_400;

/** The window's tabs: the daily reward first, then one per shop tab of the price book (`GemShopTab`). */
type ShopView = 'daily' | GemShopTab;

/**
 * The shop tabs after the daily reward, in order, with what an empty one promises (gems only come in from the daily bonus and achievements, so these are what they will be spent on).
 * Adding a tab, or items to Cosmetics, is a row here plus rows in `GEM_SHOP` (`config/gemShop.ts`); the list below it is drawn from the price book.
 */
const TABS: readonly { id: GemShopTab; label: string; empty: string; soon: readonly string[] }[] = [
	{ id: 'identity', label: 'Identity', empty: '', soon: [] },
	{
		id: 'upgrades',
		label: 'Upgrades',
		empty: 'Upgrades with levels are on the way.',
		soon: ['Longer offline time', 'Bigger bag and farm limits', 'Time boosts'],
	},
	{
		id: 'once',
		label: 'Cosmetics',
		empty: 'More cosmetics are on the way.',
		soon: ['Avatars, badges and titles', 'Name glow and frames', 'Gear'],
	},
];

/** Days and hours left of a cooldown, in words. */
const waitText = (sec: number): string => {
	const days = Math.floor(sec / DAY);
	const hours = Math.ceil((sec % DAY) / 3600);
	return days > 0 ? `${days} d ${hours} h` : `${Math.max(1, hours)} h`;
};

/**
 * The Gem shop window (IDL-230): the header gem chip opens it. It lists what the gems can buy, from the server's price book (`GEM_SHOP`), with the daily bonus on top. Every number comes from the last answer of `POST /api/gems`;
 * nothing here computes a balance. A button is disabled while a request is on its way (a double click cannot buy twice), a short balance says how many gems are missing, and a purchase above {@link GEM_CONFIRM_ABOVE} gems asks first.
 * Four tabs along the top: Daily reward (the default), Identity (services), Upgrades (leveled, later) and Cosmetics (one-time purchases, the name effects now); an empty one says what is coming. A refusal (a short balance, a cooldown) is a notice, not a line in the row.
 */
const GemShopDialog: React.FC = () => {
	const open = useUiStore((state) => state.gemShopOpen);
	const close = useUiStore((state) => state.closeGemShop);
	const openClassDialog = useUiStore((state) => state.openClassDialog);
	const info = useGemStore((state) => state.info);
	const busy = useGemStore((state) => state.busy);
	const gems = useGameStore((state) => state.gems);
	const admin = useUiStore((state) => state.badge.admin);
	useBadgeChoice();
	const playerName = useGameStore((state) => state.playerName);
	const [name, setName] = useState('');
	const [confirm, setConfirm] = useState<string | null>(null);
	const [tab, setTab] = useState<ShopView>('daily');

	useEffect(() => {
		if (open) void useGemStore.getState().refresh();
	}, [open]);

	if (!open) return null;

	const balance = info?.gems ?? gems;
	const nowSec = info?.serverNowSec ?? Math.floor(Date.now() / 1000);

	/** The state of an item for the row: its price now, and why it cannot be bought (null = it can). */
	const stateOf = (item: GemItem): { price: number; blocked: string | null } => {
		const price = item.id === 'attr_respec' && info?.freeRespec ? 0 : item.price;
		if (item.id === 'name_change' && info?.nameChangedAt) {
			const left = info.nameChangedAt + item.cooldownSec - nowSec;
			if (left > 0) return { price, blocked: `Again in ${waitText(left)}` };
		}
		if (balance < price) return { price, blocked: `${formatNumber(price - balance)} more gems needed` };
		return { price, blocked: null };
	};

	/** A one-time item the account already has (bought, or included for an admin account): the row shows MAX and is dimmed */
	const ownedOf = (item: GemItem): boolean => item.kind === 'once' && (admin || (info?.bought?.[item.id] ?? 0) > 0);

	const buy = async (item: GemItem, value?: string) => {
		setConfirm(null);
		const reply = await useGemStore.getState().buy(item.id, value);
		if (reply?.ok && item.id === 'name_change') setName('');
	};

	const items = tab === 'daily' ? [] : GEM_SHOP.filter((item) => item.tab === tab);
	const daily = info?.daily;
	const current = TABS.find((entry) => entry.id === tab) ?? TABS[0];
	/** A button on a row that cannot be bought now says why in a notice instead of staying silent */
	const refuse = (blocked: string) => notify(blocked, 'error');

	return (
		<GameModal title='Gem shop' size='md' onClose={close}>
			<div className='flex flex-col gap-4 px-1 pb-1'>
				<Tabs
					active={tab}
					onChange={(id) => setTab(id as ShopView)}
					items={[{ id: 'daily', label: 'Daily reward' }, ...TABS.map((entry) => ({ id: entry.id, label: entry.label }))]}
				/>

				<div className='flex items-center justify-between gap-3 text-sm text-[#a89878]'>
					<div>
						Hero: <span className='text-[#f1e6c8]'>{playerName}</span>
					</div>
					<div title='Your gems'>
						Gems:{' '}
						<span className='text-[#ffe27a] tabular-nums' data-testid='gem-balance'>
							{formatNumber(balance)}
						</span>
					</div>
				</div>

				{tab === 'daily' && <DailyBoard daily={daily} busy={busy} onClaim={() => void useGemStore.getState().claimDaily()} />}

				{tab !== 'daily' && items.length === 0 && (
					<div className='ds-listrow' style={{ textAlign: 'center' }} data-testid='gem-soon'>
						<div className='text-[#ecdcb4]'>{current.empty}</div>
						<ul className='text-xs text-[#a89878] flex flex-col gap-1'>
							{current.soon.map((line) => (
								<li key={line}>{line}</li>
							))}
						</ul>
					</div>
				)}

				{items.length > 0 && (
					<ul className='flex flex-col gap-2' data-testid={`gem-${tab}`}>
						{items.map((item) => {
							const owned = ownedOf(item);
							const { price, blocked } = owned ? { price: item.price, blocked: null } : stateOf(item);
							const needsConfirm = price > GEM_CONFIRM_ABOVE;
							const asking = confirm === item.id;
							return (
								<li key={item.id} className='ds-listrow' data-owned={owned}>
									<div className='flex items-center justify-between gap-3'>
										<div className='min-w-0 flex-1'>
											<div className='font-semibold'>{item.name}</div>
											<div className='text-xs text-[#a89878]'>{item.blurb}</div>
										</div>
										<div className='flex flex-col items-end gap-1 shrink-0'>
											{owned ? (
												<Button tone='purple' className='ds-btn-max' aria-disabled='true' tabIndex={-1} title='You have this'>
													MAX
												</Button>
											) : (
												<span className='flex items-center gap-1 tabular-nums text-[#ffe27a]'>
													{price === 0 ? 'Free' : formatNumber(price)} {price > 0 && <GemIcon />}
												</span>
											)}
											{owned ? null : item.id === 'class_change' ? (
												<Button
													tone={blocked ? 'dark' : 'stone'}
													disabled={busy}
													onClick={() => {
														if (blocked) return refuse(blocked);
														close();
														openClassDialog();
													}}
												>
													Choose
												</Button>
											) : item.id === 'name_change' ? null : (
												<Button
													tone={blocked ? 'dark' : 'gold'}
													disabled={busy}
													onClick={() => (blocked ? refuse(blocked) : needsConfirm && !asking ? setConfirm(item.id) : void buy(item))}
												>
													{asking ? 'Confirm' : 'Buy'}
												</Button>
											)}
										</div>
									</div>
									{item.id === 'name_change' && (
										<div className='flex items-center gap-2'>
											<input
												className='ds-amount-field'
												style={{ flex: 1, width: 'auto' }}
												placeholder='New name'
												maxLength={CHARACTER_NAME_MAX}
												value={name}
												onChange={(event) => setName(event.target.value)}
												aria-label='New hero name'
											/>
											<Button
												tone={blocked ? 'dark' : 'gold'}
												disabled={busy || (blocked === null && name.trim() === '')}
												onClick={() => (blocked ? refuse(blocked) : void buy(item, name.trim()))}
											>
												Buy
											</Button>
										</div>
									)}
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</GameModal>
	);
};

export default GemShopDialog;
