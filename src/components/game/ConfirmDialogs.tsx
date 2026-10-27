import React, { useEffect } from 'react';
import audioManager from '@/utils/audioManager';
import { MONSTERS } from '@/config/combatConfig';
import { ITEM_CATALOG, RARITIES } from '@/catalog';
import { gearOf, slotQty } from '@/lib/inventory';
import { resolveItem } from '@/lib/itemInstance';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import PixelIcon from './PixelIcon';
import PixelModal from './PixelModal';
import { itemIconName } from './itemUi';

/** "Dismiss this monster?": removes it from the map for good, no fight and no loot. */
const DismissBody: React.FC<{ id: number }> = ({ id }) => {
	const close = useUiStore((state) => state.askDismissMonster);
	const monster = useGameStore((state) => state.monsters.find((m) => m.id === id));
	const dismissMonster = useGameStore((state) => state.dismissMonster);
	const showToast = useUiStore((state) => state.showToast);
	const done = () => close(null);

	// the monster is gone (beaten, or it left the ward): nothing to confirm
	useEffect(() => {
		if (!monster) close(null);
	}, [monster, close]);
	if (!monster) return null;
	const label = `${MONSTERS[monster.type].label} (level ${monster.level})`;

	return (
		<PixelModal title='Dismiss monster?' size='sm' onClose={done}>
			<div className='px-card text-sm'>
				<p className='text-[#ecdcb4] mb-2'>
					Remove the <span className='text-[#f0d27a]'>{label}</span> from the map?
				</p>
				<p className='text-[#a89878] mb-3'>
					It disappears for good and you get no loot or XP for it. Use it when a monster is too strong and the map is full, so a
					new one can appear.
				</p>
				<div className='flex justify-between'>
					<button className='px-btn' onClick={done}>
						Cancel
					</button>
					<button
						className='px-btn px-btn-red'
						onClick={() => {
							if (dismissMonster(id)) {
								audioManager.playSound('click');
								showToast(`${MONSTERS[monster.type].label} dismissed`);
							}
							done();
						}}>
						Dismiss
					</button>
				</div>
			</div>
		</PixelModal>
	);
};

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
			showToast(`Discarded ${amount > 1 ? `${amount} x ` : ''}${name}`);
		} else {
			audioManager.playSound('wrong');
		}
		done();
	};

	return (
		<PixelModal title='Discard item?' size='sm' onClose={done}>
			<div className='px-card text-sm'>
				<div className='flex items-center gap-3 mb-2'>
					<PixelIcon name={itemIconName(def)} alt='' />
					<span style={{ color }}>
						{name}
						{qty > 1 ? ` x${qty}` : ''}
					</span>
				</div>
				<p className='text-[#a89878] mb-3'>It is destroyed for good, not sold: you get no gold. To get gold for it, sell it to the merchant.</p>
				<div className='flex justify-between gap-2 flex-wrap'>
					<button className='px-btn' onClick={done}>
						Cancel
					</button>
					<div className='flex gap-2'>
						{qty > 1 && (
							<button className='px-btn px-btn-red' onClick={() => discard(1)}>
								Discard 1
							</button>
						)}
						<button className='px-btn px-btn-red' onClick={() => discard(qty)}>
							{qty > 1 ? `Discard all (${qty})` : 'Discard'}
						</button>
					</div>
				</div>
			</div>
		</PixelModal>
	);
};

/** Both confirmations, mounted once on the page; the ui store says which one is open. */
const ConfirmDialogs: React.FC = () => {
	const dismissId = useUiStore((state) => state.dismissMonsterId);
	const discardIndex = useUiStore((state) => state.discardIndex);
	return (
		<>
			{dismissId !== null && <DismissBody id={dismissId} />}
			{discardIndex !== null && <DiscardBody index={discardIndex} />}
		</>
	);
};

export default ConfirmDialogs;
