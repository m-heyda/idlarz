import React, { useEffect, useState } from 'react';
import { CASTLE_SKINS, castleSkinItemId } from '@/config/castleSkins';
import { GEM_CONFIRM_ABOVE, gemItemById } from '@/config/gemShop';
import { pixelIconSrc, type PixelIconName } from '@/config/pixelIcons';
import { notify } from '@/lib/notices';
import { useGameStore } from '@/stores/gameStore';
import { useGemStore } from '@/stores/gemStore';
import { useUiStore } from '@/stores/uiStore';
import { formatNumber } from '@/utils/formatters';
import { Button } from '../../../packages/design-system/src/components/primitives';
import { reportCuriosity } from '@/lib/curiosityClient';
import GemIcon from './GemIcon';
import '@/styles/GemShop.css';

/**
 * The castle skins: a hint and a grid of cards (the castle, its name, then the price and Buy, or Owned and Use / In use). One component for both places that sell and equip them, the Gem shop's Cosmetics tab and the castle window's Skins tab,
 * so the cards, the purchase (`gemStore.buy`, the server prices and records it) and the equip (`uiStore.setCastleSkin`, remembered on this device) are written once. It asks the Gem shop for the account's record when it is shown.
 */
const CastleSkinsSection: React.FC = () => {
	const info = useGemStore((state) => state.info);
	const busy = useGemStore((state) => state.busy);
	const gems = useGameStore((state) => state.gems);
	const castleSkin = useUiStore((state) => state.castleSkin);
	const setCastleSkin = useUiStore((state) => state.setCastleSkin);
	const [confirm, setConfirm] = useState<number | null>(null);

	useEffect(() => {
		void useGemStore.getState().refresh();
	}, []);

	const balance = info?.gems ?? gems;

	const press = async (n: number, price: number) => {
		if (balance < price) return notify(`${formatNumber(price - balance)} more gems needed`, 'error');
		if (price > GEM_CONFIRM_ABOVE && confirm !== n) return setConfirm(n);
		setConfirm(null);
		await useGemStore.getState().buy(castleSkinItemId(n));
	};

	return (
		<div data-testid='castle-skins'>
			<div className='gem-preview-hint'>
				A skin replaces your castle on the map at every level. Pick it with Use; press In use again to go back to the level castles.
			</div>
			<div className='gem-cos-grid gem-skins'>
				{CASTLE_SKINS.map((skin) => {
					const item = gemItemById(castleSkinItemId(skin.n));
					const price = item?.price ?? 0;
					const owned = (info?.bought?.[castleSkinItemId(skin.n)] ?? 0) > 0;
					const using = castleSkin === skin.n;
					return (
						<div key={skin.n} className='gem-card gem-cosmetic' data-owned={owned} data-on={using || undefined}>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img className='gem-skin-art' src={pixelIconSrc(`castle_skin_${skin.n}` as PixelIconName)} alt='' draggable={false} />
							<div className='gem-card-name'>{skin.name}</div>
							<div className='gem-card-foot'>
								{owned ? (
									<>
										<span className='gem-card-owned'>Owned</span>
										<Button
											tone={using ? 'dark' : 'stone'}
											onClick={() => {
												setCastleSkin(using ? null : skin.n);
												// putting a skin on the castle is a secret deed
												if (!using) reportCuriosity('castle_skin');
											}}
										>
											{using ? 'In use' : 'Use'}
										</Button>
									</>
								) : (
									<>
										<span className='gem-card-price'>
											{formatNumber(price)} <GemIcon />
										</span>
										<Button tone={balance < price ? 'dark' : 'gold'} disabled={busy} onClick={() => void press(skin.n, price)}>
											{confirm === skin.n ? 'Confirm' : 'Buy'}
										</Button>
									</>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default CastleSkinsSection;
