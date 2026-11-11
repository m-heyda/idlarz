import React, { useEffect, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useGemStore } from '@/stores/gemStore';
import { useUiStore } from '@/stores/uiStore';
import { PLAYER_CLASSES, PLAYER_CLASS_ORDER, type PlayerClassId } from '@/config/playerClasses';
import { gemItemById } from '@/config/gemShop';
import { describeClassPassives } from '@/lib/classPassives';
import audioManager from '@/utils/audioManager';
import '@/styles/Heroes.css';
import PixelModal from './PixelModal';
import PixelIcon from './PixelIcon';
import AvatarArt from './AvatarArt';
import GemIcon from './GemIcon';

/**
 * Four heroes to choose from. Changing class is a purchase of the gem shop (`class_change`, 500 gems): the player picks a hero, sees what the change brings and costs, and confirms; the server charges, refuses it during a fight, and writes the class
 * on the profile. Each class has its own passives (`CLASS_PASSIVES`).
 */
const ClassPickerDialog: React.FC = () => {
	const open = useUiStore((state) => state.classDialogOpen);
	const close = useUiStore((state) => state.closeClassDialog);
	const playerClass = useGameStore((state) => state.playerClass);
	const playerName = useGameStore((state) => state.playerName);
	const gems = useGameStore((state) => state.gems);
	const busy = useGemStore((state) => state.busy);
	const message = useGemStore((state) => state.message);
	const [pick, setPick] = useState<PlayerClassId | null>(null);

	useEffect(() => {
		if (open) setPick(null);
	}, [open]);

	if (!open) return null;

	const price = gemItemById('class_change')?.price ?? 0;
	const picked = pick && pick !== playerClass ? PLAYER_CLASSES[pick] : null;

	const confirm = async () => {
		if (!pick || busy) return;
		const reply = await useGemStore.getState().buy('class_change', pick);
		if (reply?.ok) close();
	};

	return (
		<PixelModal title='Choose your hero' icon={<PixelIcon name='menu_character' alt='' />} size='md' onClose={close}>
			<p className='text-[#a89878] text-sm mb-4 text-center'>
				Pick the hero for {playerName}. Each hero has its own bonuses. Changing costs {price} <GemIcon />.
			</p>
			<div className='class-grid'>
				{PLAYER_CLASS_ORDER.map((id) => {
					const info = PLAYER_CLASSES[id];
					const current = id === playerClass;
					const selected = current || id === pick;
					return (
						<button
							key={id}
							type='button'
							className='class-card'
							data-selected={selected}
							style={{ '--accent': info.accent } as React.CSSProperties}
							onClick={() => {
								if (!current) {
									setPick(id);
									audioManager.playSound('click');
								}
							}}
						>
							<span className='class-card-stage'>
								<PixelIcon name={info.full} scale={2} alt={`${info.race} ${info.label}`} />
							</span>
							<span className='class-card-avatar' title='Default avatar'>
								<AvatarArt id={null} playerClass={id} scale={0.6} />
							</span>
							<span className='class-card-name'>{info.label}</span>
							<span className='class-card-race'>{info.race}</span>
							<span className='class-card-blurb'>{info.blurb}</span>
							<span className='class-card-tag'>{current ? 'Chosen' : id === pick ? 'Selected' : 'Choose'}</span>
						</button>
					);
				})}
			</div>
			{picked && (
				<div className='px-card mt-4 flex items-center justify-between gap-3' data-testid='class-confirm'>
					<div className='text-sm text-[#f1e6c8]'>
						Become a {picked.label}?
						<div className='text-xs text-[#a89878]'>{[...describeClassPassives(pick!).combat, ...describeClassPassives(pick!).economy].join(', ')}</div>
						{gems < price && <div className='text-xs text-[#d98a6a]'>{price - gems} more gems needed.</div>}
					</div>
					<button className='px-btn px-btn-gold shrink-0' disabled={busy || gems < price} onClick={() => void confirm()}>
						Confirm ({price} <GemIcon />)
					</button>
				</div>
			)}
			{message && (
				<p className='mt-3 text-sm text-[#d98a6a]' role='status'>
					{message}
				</p>
			)}
		</PixelModal>
	);
};

export default ClassPickerDialog;
