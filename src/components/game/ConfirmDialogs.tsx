import React, { useEffect } from 'react';
import { formatCompact } from '@/utils/formatters';
import audioManager from '@/utils/audioManager';
import { ITEM_CATALOG, RARITIES } from '@/catalog';
import { gearOf, slotQty } from '@/lib/inventory';
import { resolveItem } from '@/lib/itemInstance';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import PixelIcon from './PixelIcon';
import GameModal from './GameModal';
import { itemIconName } from './itemUi';
import { Button } from '../../../packages/design-system/src/components/primitives';

/** "Discard this item?": one or the whole stack, thrown away for nothing (selling pays gold; this does not). */
const DiscardBody: React.FC<{ index: number }> = ({ index }) => {
	const askDiscard = useUiStore((state) => state.askDiscard);
	const slot = useGameStore((state) => state.bag[index]);
	const discardItem = useGameStore((state) => state.discardItem);
	const showToast = useUiStore((state) => state.showToast);
	const done = () => askDiscard(null);
	const gear = slot ? gearOf(slot) : null;
	const resolved = gear ? resolveItem(gear) : null;
	const def = resolved?.def ?? (slot && 'id' in slot ? ITEM_CATALOG[slot.id] : undefined);
	const name = resolved?.name ?? def?.name ?? '';
	const color = RARITIES[(resolved?.instance.rarity ?? def?.rarity ?? 'common') as keyof typeof RARITIES].color;
	const qty = slot ? slotQty(slot) : 0;

	useEffect(() => {
		if (!slot || !def) askDiscard(null);
	}, [slot, def, askDiscard]);
	if (!slot || !def) return null;
	const discard = (amount: number) => {
		if (discardItem(index, amount)) {
			audioManager.playSound('click');
			showToast(`Discarded ${amount > 1 ? `${formatCompact(amount)} x ` : ''}${name}`);
		} else {
			audioManager.playSound('wrong');
		}
		done();
	};

	return (
		<GameModal title='Discard item?' size='sm' onClose={done}>
			<div className='ds-listrow text-sm' style={{ marginBottom: 10 }}>
				<div className='flex items-center gap-3 mb-2'>
					<PixelIcon name={itemIconName(def)} alt='' />
					<span style={{ color }}>
						{name}
						{qty > 1 ? ` x${formatCompact(qty)}` : ''}
					</span>
				</div>
				<p className='text-[#a89878] mb-3'>It is destroyed for good, not sold: you get no gold. To get gold for it, sell it to the merchant.</p>
				<div className='flex justify-between gap-2 flex-wrap'>
					<Button onClick={done}>Cancel</Button>
					<div className='flex gap-2'>
						{qty > 1 && (
							<Button tone='danger' onClick={() => discard(1)}>
								Discard 1
							</Button>
						)}
						<Button tone='danger' onClick={() => discard(qty)}>
							{qty > 1 ? `Discard all (${formatCompact(qty)})` : 'Discard'}
						</Button>
					</div>
				</div>
			</div>
		</GameModal>
	);
};

/** The confirmation dialogs, mounted once on the page; the ui store says which one is open. */
const ConfirmDialogs: React.FC = () => {
	const discardIndex = useUiStore((state) => state.discardIndex);
	return <>{discardIndex !== null && <DiscardBody index={discardIndex} />}</>;
};

export default ConfirmDialogs;
