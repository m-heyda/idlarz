import React, { useEffect, useState } from 'react';
import { GEM_CONFIRM_ABOVE, GEM_SHOP, type GemItem, type GemShopTab } from '@/config/gemShop';
import { CHARACTER_NAME_MAX } from '@/lib/authValidation';
import { useGameStore } from '@/stores/gameStore';
import { useGemStore } from '@/stores/gemStore';
import { useUiStore } from '@/stores/uiStore';
import { formatNumber } from '@/utils/formatters';
import GameModal from '../GameModal';
import { useBadgeChoice } from '../BadgeDialog';
import { Button, Tabs } from '../../../../packages/design-system/src/components/primitives';
import GemIcon from '../GemIcon';
import DailyBoard from '../DailyBoard';

const DAY = 86_400;

/** The tabs, in order, with what an empty one promises (gems only come in from the daily bonus and achievements, so these are what they will be spent on). */
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
		label: 'One-time',
		empty: 'One-time purchases are on the way.',
		soon: ['Cosmetics: avatars, badges and titles', 'Name glow and frames', 'Gear'],
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
 * Three tabs: Identity (services), Upgrades (leveled, later) and One-time (later); an empty one says what is coming.
 */
const GemShopDialog: React.FC = () => {
	const open = useUiStore((state) => state.gemShopOpen);
	const close = useUiStore((state) => state.closeGemShop);
	const openClassDialog = useUiStore((state) => state.openClassDialog);
	const info = useGemStore((state) => state.info);
	const busy = useGemStore((state) => state.busy);
	const message = useGemStore((state) => state.message);
	const gems = useGameStore((state) => state.gems);
	const admin = useUiStore((state) => state.badge.admin);
	useBadgeChoice();
	const playerName = useGameStore((state) => state.playerName);
	const [name, setName] = useState('');
	const [confirm, setConfirm] = useState<string | null>(null);
	const [tab, setTab] = useState<GemShopTab>('identity');

	useEffect(() => {
		if (open) void useGemStore.getState().refresh();
	}, [open]);

	if (!open) return null;

	const balance = info?.gems ?? gems;
	const nowSec = info?.serverNowSec ?? Math.floor(Date.now() / 1000);

	/** The state of an item for the row: its price now, and why it cannot be bought (null = it can). */
	const stateOf = (item: GemItem): { price: number; blocked: string | null } => {
		const price = item.id === 'attr_respec' && info?.freeRespec ? 0 : item.id === 'name_colors' && admin ? 0 : item.price;
		if (item.id === 'name_colors') {
			if (admin) return { price, blocked: 'Included for admin accounts' };
			if ((info?.bought?.[item.id] ?? 0) > 0) return { price, blocked: 'Owned: open the name window from your Character' };
		}
		if (item.id === 'name_change' && info?.nameChangedAt) {
			const left = info.nameChangedAt + item.cooldownSec - nowSec;
			if (left > 0) return { price, blocked: `Again in ${waitText(left)}` };
		}
		if (balance < price) return { price, blocked: `${formatNumber(price - balance)} more gems needed` };
		return { price, blocked: null };
	};

	const buy = async (item: GemItem, value?: string) => {
		setConfirm(null);
		const reply = await useGemStore.getState().buy(item.id, value);
		if (reply?.ok && item.id === 'name_change') setName('');
	};

	const items = GEM_SHOP.filter((item) => item.tab === tab);
	const daily = info?.daily;
	const current = TABS.find((entry) => entry.id === tab) ?? TABS[0];

	return (
		<GameModal title='Gem shop' icon={<GemIcon />} size='md' onClose={close}>
			<div className='flex flex-col gap-4 px-1 pb-1'>
				<div className='flex items-center justify-between gap-3'>
					<div className='text-sm text-[#a89878]'>
						Hero: <span className='text-[#f1e6c8]'>{playerName}</span>
					</div>
					<div className='ds-chip' title='Your gems'>
						<GemIcon /> <span data-testid='gem-balance'>{formatNumber(balance)}</span>
					</div>
				</div>

				<DailyBoard daily={daily} busy={busy} onClaim={() => void useGemStore.getState().claimDaily()} />

				<Tabs active={tab} onChange={(id) => setTab(id as GemShopTab)} items={TABS.map((entry) => ({ id: entry.id, label: entry.label }))} />

				{items.length === 0 && (
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
							const { price, blocked } = stateOf(item);
							const needsConfirm = price > GEM_CONFIRM_ABOVE;
							const asking = confirm === item.id;
							return (
								<li key={item.id} className='ds-listrow'>
									<div className='flex items-center justify-between gap-3'>
										<div className='min-w-0 flex-1'>
											<div className='font-semibold'>{item.name}</div>
											<div className='text-xs text-[#a89878]'>{item.blurb}</div>
										</div>
										<div className='flex flex-col items-end gap-1 shrink-0'>
											<span className='flex items-center gap-1 tabular-nums text-[#ffe27a]'>
												{price === 0 ? 'Free' : formatNumber(price)} {price > 0 && <GemIcon />}
											</span>
											{item.id === 'class_change' ? (
												<Button
													disabled={busy || blocked !== null}
													onClick={() => {
														close();
														openClassDialog();
													}}
												>
													Choose
												</Button>
											) : item.id === 'name_change' ? null : (
												<Button
													tone='gold'
													disabled={busy || blocked !== null}
													onClick={() => (needsConfirm && !asking ? setConfirm(item.id) : void buy(item))}
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
											<Button tone='gold' disabled={busy || blocked !== null || name.trim() === ''} onClick={() => void buy(item, name.trim())}>
												Buy
											</Button>
										</div>
									)}
									{blocked && <div className='text-xs text-[#d98a6a]'>{blocked}</div>}
								</li>
							);
						})}
					</ul>
				)}

				{message && (
					<p className='text-sm text-center text-[#d98a6a]' role='status'>
						{message}
					</p>
				)}
			</div>
		</GameModal>
	);
};

export default GemShopDialog;
