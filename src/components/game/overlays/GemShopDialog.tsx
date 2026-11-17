import React, { useEffect, useState } from 'react';
import { BUILDER_ITEM, GEM_CONFIRM_ABOVE, GEM_SHOP, type GemItem, type GemShopTab } from '@/config/gemShop';
import { NICK_EFFECTS, nickColorValue } from '@/config/nickColors';
import { CHARACTER_NAME_MAX } from '@/lib/authValidation';
import { useGameStore } from '@/stores/gameStore';
import { useGemStore } from '@/stores/gemStore';
import { useUiStore } from '@/stores/uiStore';
import { useWindowStore } from '@/stores/windowStore';
import { notify } from '@/lib/notices';
import { formatNumber } from '@/utils/formatters';
import GameWindow from '../GameWindow';
import { useBadgeChoice } from '../BadgeDialog';
import { Button, Tabs } from '../../../../packages/design-system/src/components/primitives';
import { NickName } from '../../../../packages/design-system/src/components/composites';
import { UpgradeTile } from '../../../../packages/design-system/src/components/upgrade';
import GemIcon from '../GemIcon';
import DailyBoard from '../DailyBoard';
import '@/styles/GemShop.css';

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
 * Four tabs along the top that stay pinned while the content scrolls: Daily reward (the default), Identity (services, as cards), Upgrades (the same tiles as the Merchant's upgrades, so more can be added) and Cosmetics (tiles, with a
 * preview of your name in the effect before you buy it). A bought item reads "Owned". A refusal (a short balance, a cooldown) is a notice, not a line in the row.
 */
const GemShopDialog: React.FC = () => {
	const open = useWindowStore((state) => state.order.includes('gems'));
	const close = useUiStore((state) => state.closeGemShop);
	const openClassDialog = useUiStore((state) => state.openClassDialog);
	const info = useGemStore((state) => state.info);
	const busy = useGemStore((state) => state.busy);
	const gems = useGameStore((state) => state.gems);
	const admin = useUiStore((state) => state.badge.admin);
	const playerName = useGameStore((state) => state.playerName);
	useBadgeChoice();
	const [name, setName] = useState('');
	const [confirm, setConfirm] = useState<string | null>(null);
	const [tab, setTab] = useState<ShopView>('daily');
	/** The name effect shown on the preview strip of the Cosmetics tab (an effect id; none = the plain name) */
	const [previewFx, setPreviewFx] = useState<string | null>(null);

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

	/** A one-time item the account already has (bought, or included for an admin account; Builder #2 is never free): the row reads "Owned" */
	const ownedOf = (item: GemItem): boolean => item.kind === 'once' && ((admin && item.id !== BUILDER_ITEM) || (info?.bought?.[item.id] ?? 0) > 0);

	const buy = async (item: GemItem, value?: string) => {
		setConfirm(null);
		const reply = await useGemStore.getState().buy(item.id, value);
		if (reply?.ok && item.id === 'name_change') setName('');
	};

	/** The click on a Buy button: a refusal is a notice, a dear purchase asks once more (the label turns to Confirm), then it is bought */
	const press = (item: GemItem, blocked: string | null, price: number) => {
		if (blocked) return notify(blocked, 'error');
		if (price > GEM_CONFIRM_ABOVE && confirm !== item.id) return setConfirm(item.id);
		void buy(item);
	};

	const items = tab === 'daily' ? [] : GEM_SHOP.filter((item) => item.tab === tab);
	const daily = info?.daily;
	const current = TABS.find((entry) => entry.id === tab) ?? TABS[0];

	/** One service of the Identity tab as a card: name, what it does, its price and the action (a class change opens the class window, a name change has its own field) */
	const identityCard = (item: GemItem) => {
		const owned = ownedOf(item);
		const { price, blocked } = owned ? { price: item.price, blocked: null } : stateOf(item);
		const asking = confirm === item.id;
		return (
			<div key={item.id} className='gem-card' data-owned={owned}>
				<div className='gem-card-name'>{item.name}</div>
				<div className='gem-card-blurb'>{item.blurb}</div>
				{item.id === 'name_change' && !owned && (
					<div className='gem-card-name-row'>
						<input
							className='ds-amount-field'
							placeholder='New name'
							maxLength={CHARACTER_NAME_MAX}
							value={name}
							onChange={(event) => setName(event.target.value)}
							aria-label='New hero name'
						/>
					</div>
				)}
				<div className='gem-card-foot'>
					{owned ? (
						<span className='gem-card-owned'>Owned</span>
					) : (
						<>
							<span className='gem-card-price'>
								{price === 0 ? 'Free' : formatNumber(price)} {price > 0 && <GemIcon />}
							</span>
							{item.id === 'class_change' ? (
								<Button
									tone={blocked ? 'dark' : 'stone'}
									disabled={busy}
									onClick={() => {
										if (blocked) return notify(blocked, 'error');
										close();
										openClassDialog();
									}}
								>
									Choose
								</Button>
							) : item.id === 'name_change' ? (
								<Button
									tone={blocked ? 'dark' : 'gold'}
									disabled={busy || (blocked === null && name.trim() === '')}
									onClick={() => (blocked ? notify(blocked, 'error') : void buy(item, name.trim()))}
								>
									Buy
								</Button>
							) : (
								<Button tone={blocked ? 'dark' : 'gold'} disabled={busy} onClick={() => press(item, blocked, price)}>
									{asking ? 'Confirm' : 'Buy'}
								</Button>
							)}
						</>
					)}
				</div>
			</div>
		);
	};

	/** One upgrade or cosmetic as the same tile the Merchant's upgrades use (one level: not owned, or owned). A cosmetic that is a name effect previews on the strip above when hovered or clicked. */
	const tile = (item: GemItem) => {
		const owned = ownedOf(item);
		const { price, blocked } = owned ? { price: item.price, blocked: null } : stateOf(item);
		const effect = NICK_EFFECTS.find((entry) => entry.item === item.id);
		return (
			<div
				key={item.id}
				className={effect ? 'gem-preview-tile' : undefined}
				data-on={effect ? previewFx === effect.id : undefined}
				onMouseEnter={effect ? () => setPreviewFx(effect.id) : undefined}
				onClick={effect ? () => setPreviewFx(effect.id) : undefined}
			>
				<UpgradeTile
					name={item.name}
					level={owned ? 1 : 0}
					maxLevel={1}
					now={owned ? item.blurb : undefined}
					next={owned ? undefined : item.blurb}
					nowLabel='You have'
					emptyNow='not owned'
					nextLabel='Get'
					cost={price}
					costText={formatNumber(price)}
					costNode={
						<span className='ds-cost'>
							{formatNumber(price)} <GemIcon />
						</span>
					}
					have={balance}
					shortText={blocked ?? undefined}
					state={owned ? 'maxed' : blocked ? 'short' : 'ready'}
					maxLabel='Owned'
					buyLabel={confirm === item.id ? 'Confirm' : 'Buy'}
					onBuy={() => press(item, blocked, price)}
				/>
			</div>
		);
	};

	return (
		<GameWindow
			id='gems'
			title='Gem shop'
			width={860}
			height={620}
			bar={
				<Tabs
					active={tab}
					onChange={(id) => setTab(id as ShopView)}
					items={[{ id: 'daily', label: 'Daily reward' }, ...TABS.map((entry) => ({ id: entry.id, label: entry.label }))]}
				/>
			}
			barRight={
				<span className='gem-balance-row' title='Your gems'>
					Gems:&nbsp;
					<span className='text-[#ffe27a] tabular-nums' data-testid='gem-balance'>
						{formatNumber(balance)}
					</span>
				</span>
			}
		>
			<div>
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

				{tab === 'identity' && items.length > 0 && (
					<div className='gem-id-grid' data-testid={`gem-${tab}`}>
						{items.map(identityCard)}
					</div>
				)}

				{tab !== 'daily' && tab !== 'identity' && items.length > 0 && (
					<div data-testid={`gem-${tab}`}>
						{tab === 'once' && (
							<>
								<div className='ds-nick-stage' data-testid='gem-preview'>
									<div className='ds-nick-preview'>
										<NickName color={nickColorValue(previewFx)}>{playerName}</NickName>
									</div>
								</div>
								<div className='gem-preview-hint'>
									Hover or click a name effect to preview it on your name. You can also pick them in your character window.
								</div>
							</>
						)}
						<div className='ds-ups gem-two'>
							<div className='ds-ups-grid'>{items.map(tile)}</div>
						</div>
					</div>
				)}
			</div>
		</GameWindow>
	);
};

export default GemShopDialog;
