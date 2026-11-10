import React from 'react';
import PixelModal from '../PixelModal';
import { GAME_TITLE } from '@/config/branding';

/** Shown in a tab that does not own the game (another tab is running it). */
const TabLockOverlay: React.FC<{ onTakeOver: () => void }> = ({ onTakeOver }) => (
	<PixelModal title='Already open in another tab' size='sm' hideClose closeOnBackdrop={false} onClose={() => undefined}>
		<p className='text-sm text-[#d8c8a0] mb-4'>
			{GAME_TITLE} is running in another tab or window. Only one can play at a time, otherwise the saves would overwrite each other.
		</p>
		<div className='flex justify-center'>
			<button className='px-btn' onClick={onTakeOver}>
				Play here instead
			</button>
		</div>
	</PixelModal>
);

export default TabLockOverlay;
