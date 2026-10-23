import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import LevelDetails from '../LevelDetails';
import PixelModal from '../PixelModal';
import PixelIcon from '../PixelIcon';

// Temporary shell: the paper doll and bag come with the character window rework.
const CharacterOverlay: React.FC = () => {
	const { showCharacterWindow, toggleCharacterWindow } = useGameStore();
	if (!showCharacterWindow) return null;
	return (
		<PixelModal
			title='Character'
			icon={<PixelIcon name='menu_character' alt='' />}
			size='lg'
			onClose={toggleCharacterWindow}>
			<div className='px-panel'>
				<LevelDetails />
			</div>
		</PixelModal>
	);
};

export default CharacterOverlay;
