import React from 'react';
import { useUiStore } from '@/stores/uiStore';
import PixelModal from '../PixelModal';
import Tutorial from './Tutorial';

/** The full guide, reopened on demand from Settings. */
const TutorialDialog: React.FC = () => {
	const open = useUiStore((state) => state.tutorialOpen);
	const close = useUiStore((state) => state.closeTutorial);
	if (!open) return null;
	return (
		<PixelModal title='Guide' size='lg' onClose={close}>
			<Tutorial />
			<div className='flex justify-center mt-6'>
				<button className='px-btn px-btn-blue' onClick={close}>
					Close
				</button>
			</div>
		</PixelModal>
	);
};

export default TutorialDialog;
