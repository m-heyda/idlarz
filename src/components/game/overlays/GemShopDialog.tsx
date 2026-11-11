import React, { useEffect, useState } from 'react';
import { GEM_CONFIRM_ABOVE, GEM_SHOP, type GemItem } from '@/config/gemShop';
import { CHARACTER_NAME_MAX } from '@/lib/authValidation';
import { useGameStore } from '@/stores/gameStore';
import { useGemStore } from '@/stores/gemStore';
import { useUiStore } from '@/stores/uiStore';
import { formatNumber } from '@/utils/formatters';
import PixelModal from '../PixelModal';
import GemIcon from '../GemIcon';

const DAY = 86_400;

/** Days and hours left of a cooldown, in words. */
const waitText = (sec: number): string => {
	const days = Math.floor(sec / DAY);
	const hours = Math.ceil((sec % DAY) / 3600);
	return days > 0 ? `${days} d ${hours} h` : `${Math.max(1, hours)} h`;
};

/**
 * The Gem shop window (IDL-230): the header gem chip opens it. It lists what the gems can buy, from the server's price book (`GEM_SHOP`), with the daily bonus on top. Every number comes from the last answer of `POST /api/gems`;
 * nothing here computes a balance. A button is disabled while a request is on its way (a double click cannot buy twice), a short balance says how many gems are missing, and a purchase above {@link GEM_CONFIRM_ABOVE} gems asks first.
 * Only tabs that hold an item are shown (today: Identity).
 */
const GemShopDialog: React.FC = () => {
	const open = useUiStore((state) => state.gemShopOpen);
	const close = useUiStore((state) => state.closeGemShop);
	const openClassDialog = useUiStore((state) => state.openClassDialog);
	const info = useGemStore((state) => state.info);
	const busy = useGemStore((state) => state.busy);
	const message = useGemStore((state) => state.message);
	const gems = useGameStore((state) => state.gems);
	const playerName = useGameStore((state) => state.playerName);
	const [name, setName] = useState('');
	const [confirm, setConfirm] = useState<string | null>(null);

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

	const buy = async (item: GemItem, value?: string) => {
		setConfirm(null);
		const reply = await useGemStore.getState().buy(item.id, value);
		if (reply?.ok && item.id === 'name_change') setName('');
	};

	const identity = GEM_SHOP.filter((item) => item.tab === 'identity');
	const daily = info?.daily;

	return (
		<PixelModal title='Gem shop' icon={<GemIcon />} size='md' onClose={close}>
			<div className='flex items-center justify-between mb-3'>
				<div className='text-sm text-[#d8c8a0]'>
					Hero: <span className='text-[#f1e6c8]'>{playerName}</span>
				</div>
				<div className='flex items-center gap-1 text-[#f1e6c8] font-semibold' title='Your gems'>
					<GemIcon /> <span data-testid='gem-balance'>{formatNumber(balance)}</span>
				</div>
			</div>

			<div className='px-card mb-4 flex items-center justify-between gap-3' data-testid='gem-daily'>
				<div>
					<div className='text-sm text-[#f1e6c8]'>Daily bonus</div>
					<div className='text-xs text-[#a89878]'>
						{daily ? (daily.available ? `Day ${daily.step} of 7: +${daily.gems} gems` : 'Claimed today. Come back tomorrow (UTC).') : 'Checking...'}
					</div>
				</div>
				<button className='px-btn px-btn-gold' disabled={busy || !daily?.available} onClick={() => void useGemStore.getState().claimDaily()}>
					Claim
				</button>
			</div>

			<div role='tablist' className='flex gap-2 mb-3'>
				<button role='tab' aria-selected='true' className='px-tab' data-active='true'>
					Identity
				</button>
			</div>

			<div className='flex flex-col gap-2' data-testid='gem-identity'>
				{identity.map((item) => {
					const { price, blocked } = stateOf(item);
					const needsConfirm = price > GEM_CONFIRM_ABOVE;
					const asking = confirm === item.id;
					return (
						<div key={item.id} className='px-card flex flex-col gap-2'>
							<div className='flex items-center justify-between gap-3'>
								<div>
									<div className='text-sm text-[#f1e6c8]'>{item.name}</div>
									<div className='text-xs text-[#a89878]'>{item.blurb}</div>
								</div>
								<div className='flex items-center gap-2 shrink-0'>
									<span className='flex items-center gap-1 text-[#f1e6c8] tabular-nums'>
										{price === 0 ? 'Free' : formatNumber(price)} {price > 0 && <GemIcon />}
									</span>
									{item.id === 'class_change' ? (
										<button
											className='px-btn'
											disabled={busy || blocked !== null}
											onClick={() => {
												close();
												openClassDialog();
											}}
										>
											Choose
										</button>
									) : item.id === 'name_change' ? null : (
										<button
											className='px-btn px-btn-gold'
											disabled={busy || blocked !== null}
											onClick={() => (needsConfirm && !asking ? setConfirm(item.id) : void buy(item))}
										>
											{asking ? 'Confirm' : 'Buy'}
										</button>
									)}
								</div>
							</div>
							{item.id === 'name_change' && (
								<div className='flex items-center gap-2'>
									<input
										className='px-input flex-1'
										placeholder='New name'
										maxLength={CHARACTER_NAME_MAX}
										value={name}
										onChange={(event) => setName(event.target.value)}
										aria-label='New hero name'
									/>
									<button className='px-btn px-btn-gold' disabled={busy || blocked !== null || name.trim() === ''} onClick={() => void buy(item, name.trim())}>
										Buy
									</button>
								</div>
							)}
							{blocked && <div className='text-xs text-[#d98a6a]'>{blocked}</div>}
						</div>
					);
				})}
			</div>

			{message && (
				<p className='mt-3 text-sm text-[#d98a6a]' role='status'>
					{message}
				</p>
			)}
		</PixelModal>
	);
};

export default GemShopDialog;
