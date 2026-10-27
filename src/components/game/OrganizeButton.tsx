import React from 'react';
import { useGameStore } from '@/stores/gameStore';

/** Tidies the bag from the left: stacks merged, then the gear by slot and quality (see `organizeBag` in lib/inventory). */
const OrganizeButton: React.FC<{ onNotice?: (message: string) => void }> = ({ onNotice }) => {
	const organizeBag = useGameStore((state) => state.organizeBag);
	return (
		<button
			className='px-btn px-btn-sm'
			title='Merge stacks and sort the bag: potions first, then gear by slot, rarity and level'
			onClick={() => {
				if (!organizeBag()) onNotice?.('Finish the fight first');
			}}>
			Organize
		</button>
	);
};

export default OrganizeButton;
