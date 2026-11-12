import React, { useEffect, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useGemStore } from '@/stores/gemStore';
import { useUiStore } from '@/stores/uiStore';
import { PLAYER_CLASSES, PLAYER_CLASS_ORDER, type PlayerClassId } from '@/config/playerClasses';
import { gemItemById } from '@/config/gemShop';
import { describeClassPassives } from '@/lib/classPassives';
import audioManager from '@/utils/audioManager';
import '@/styles/Heroes.css';
import GameModal from './GameModal';
import { Button } from '../../../packages/design-system/src/components/primitives';
import PixelIcon from './PixelIcon';
import AvatarArt from './AvatarArt';
import GemIcon from './GemIcon';

/**
 * Four heroes to choose from, shown as their portraits. Changing class is a purchase of the gem shop (`class_change`, 500 gems): clicking a hero opens a confirmation that names the hero, its bonuses, the price and the gem balance before and after; the server charges, refuses it
 * during a fight, and writes the class on the profile. Each class has its own passives (`CLASS_PASSIVES`).
 */
const ClassPickerDialog: React.FC = () => {
	const open = useUiStore((state) => state.classDialogOpen);
	const close = useUiStore((state) => state.closeClassDialog);
	const playerClass = useGameStore((state) => state.playerClass);
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
	const missing = Math.max(0, price - gems);

	const confirm = async () => {
		if (!pick || busy) return;
		const reply = await useGemStore.getState().buy('class_change', pick);
		if (reply?.ok) close();
		else setPick(null);
	};

	const bonuses = pick ? [...describeClassPassives(pick).combat, ...describeClassPassives(pick).economy] : [];

	return (
		<>
			<GameModal title='Choose your hero' icon={<PixelIcon name='menu_character' alt='' />} size='md' onClose={close}>
				<p className='ds-dim' style={{ textAlign: 'center', margin: '0 0 12px' }}>
					Each hero has its own bonuses. Changing hero costs {price} <GemIcon />.
				</p>
				<div className='class-grid'>
					{PLAYER_CLASS_ORDER.map((id) => {
						const info = PLAYER_CLASSES[id];
						const current = id === playerClass;
						return (
							<button
								key={id}
								type='button'
								className='class-card'
								data-selected={current}
								disabled={current}
								style={{ '--accent': info.accent } as React.CSSProperties}
								onClick={() => {
									setPick(id);
									audioManager.playSound('click');
								}}
							>
								<AvatarArt id={null} playerClass={id} scale={2} className='class-card-portrait' />
								<span className='class-card-name'>{info.label}</span>
								<span className='class-card-race'>{info.race}</span>
								<span className='class-card-tag'>{current ? 'Current' : 'Choose'}</span>
							</button>
						);
					})}
				</div>
				{message && (
					<p style={{ marginTop: 10, textAlign: 'center', color: '#ff9a7a' }} role='status'>
						{message}
					</p>
				)}
			</GameModal>
			{picked && pick && (
				<GameModal title={`Become a ${picked.label}?`} size='sm' onClose={() => setPick(null)}>
					<div data-testid='class-confirm' className='flex flex-col items-center gap-3 text-center'>
						<AvatarArt id={null} playerClass={pick} scale={2} />
						<p className='text-sm text-[#f1e6c8]'>
							{picked.race} {picked.label}: {bonuses.join(', ')}.
						</p>
						<p className='text-sm text-[#d8c8a0]'>
							This costs {price} <GemIcon />. You have {gems} <GemIcon />
							{missing === 0 && (
								<>
									, {gems - price} <GemIcon /> left after
								</>
							)}
							.
						</p>
						{missing > 0 && <p className='text-xs text-[#d98a6a]'>You need {missing} more gems.</p>}
						{message && (
							<p className='text-xs text-[#d98a6a]' role='status'>
								{message}
							</p>
						)}
						<div className='flex gap-3'>
							<Button disabled={busy} onClick={() => setPick(null)}>
								Cancel
							</Button>
							<Button tone='gold' disabled={busy || missing > 0} onClick={() => void confirm()}>
								Pay {price} <GemIcon />
							</Button>
						</div>
					</div>
				</GameModal>
			)}
		</>
	);
};

export default ClassPickerDialog;
