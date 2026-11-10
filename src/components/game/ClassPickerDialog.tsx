import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { PLAYER_CLASSES, PLAYER_CLASS_ORDER } from '@/config/playerClasses';
import audioManager from '@/utils/audioManager';
import '@/styles/Heroes.css';
import PixelModal from './PixelModal';
import PixelIcon from './PixelIcon';
import AvatarArt from './AvatarArt';

/** Four heroes to choose from; picking one applies at once. Each class has its own passives (`CLASS_PASSIVES`), so the change is meant to be rare (it costs gems once that sink ships). */
const ClassPickerDialog: React.FC = () => {
	const open = useUiStore((state) => state.classDialogOpen);
	const close = useUiStore((state) => state.closeClassDialog);
	const playerClass = useGameStore((state) => state.playerClass);
	const setPlayerClass = useGameStore((state) => state.setPlayerClass);
	const playerName = useGameStore((state) => state.playerName);

	if (!open) return null;

	return (
		<PixelModal title='Choose your hero' icon={<PixelIcon name='menu_character' alt='' />} size='md' onClose={close}>
			<p className='text-[#a89878] text-sm mb-4 text-center'>Pick the hero for {playerName}. Each hero has its own bonuses.</p>
			<div className='class-grid'>
				{PLAYER_CLASS_ORDER.map((id) => {
					const info = PLAYER_CLASSES[id];
					const selected = id === playerClass;
					return (
						<button
							key={id}
							type='button'
							className='class-card'
							data-selected={selected}
							style={{ '--accent': info.accent } as React.CSSProperties}
							onClick={() => {
								if (!selected) {
									setPlayerClass(id);
									audioManager.playSound('click');
								}
							}}
							onDoubleClick={close}
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
							<span className='class-card-tag'>{selected ? 'Chosen' : 'Choose'}</span>
						</button>
					);
				})}
			</div>
		</PixelModal>
	);
};

export default ClassPickerDialog;
