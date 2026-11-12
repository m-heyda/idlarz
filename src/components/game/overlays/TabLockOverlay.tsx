import React from 'react';
import GameModal from '../GameModal';
import { Button } from '../../../../packages/design-system/src/components/primitives';
import { GAME_TITLE } from '@/config/branding';

/** Shown in a tab that does not own the game (another tab is running it). */
const TabLockOverlay: React.FC<{ onTakeOver: () => void }> = ({ onTakeOver }) => (
	<GameModal title='Already open in another tab' size='sm' closeOnBackdrop={false} onClose={() => undefined}>
		<p style={{ margin: '0 0 14px' }}>
			{GAME_TITLE} is running in another tab or window. Only one can play at a time, otherwise the saves would overwrite each other.
		</p>
		<div style={{ display: 'flex', justifyContent: 'center' }}>
			<Button tone='gold' onClick={onTakeOver}>
				Play here instead
			</Button>
		</div>
	</GameModal>
);

export default TabLockOverlay;
