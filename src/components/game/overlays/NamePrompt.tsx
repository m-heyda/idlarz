import React, { useState, useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { countOwnedTiles } from '@/utils/gameUtils';
import PixelModal from '../PixelModal';
import Tutorial from './Tutorial';

const NAME_MAX_LENGTH = 9;

const NamePrompt = () => {
	const [name, setName] = useState('');
	const [showPrompt, setShowPrompt] = useState(false);
	const [showIntroduction, setShowIntroduction] = useState(false);
	const { playerName, setPlayerName, tiles } = useGameStore();

	// Count owned tiles to determine if we should show the name prompt
	useEffect(() => {
		// Count all owned tiles
		const ownedTileCount = countOwnedTiles(tiles);

		// Show the prompt if:
		// 1. Player has exactly 2 owned tiles (castle + first purchase)
		// 2. Their name is still the default "Explorer"
		const shouldShowPrompt = ownedTileCount === 2 && playerName === 'Explorer';

		setShowPrompt(shouldShowPrompt);
	}, [tiles, playerName]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (name.trim()) {
			setPlayerName(name);
			setShowPrompt(false);
			setShowIntroduction(true);
		}
	};

	const handleCloseIntroduction = () => {
		setShowIntroduction(false);
	};

	if (!showPrompt && !showIntroduction) {
		return null;
	}

	if (showIntroduction) {
		return (
			<PixelModal
				title={`Welcome, ${playerName}!`}
				size='lg'
				closeOnBackdrop={false}
				onClose={handleCloseIntroduction}>

					<Tutorial />

					<div className='flex justify-center mt-6'>
						<button
							onClick={handleCloseIntroduction}
							className='px-btn px-btn-blue'>
							Start Your Adventure
						</button>
					</div>
			</PixelModal>
		);
	}

	return (
		<PixelModal title='Your Journey Begins!' size='sm' hideClose closeOnBackdrop={false} onClose={() => {}}>
				<p className='mb-4 text-sm text-center text-[#a89878]'>
					You have taken your first step into the vast unknown.
					<br/>
					Now, what shall history remember you as?
				</p>

				<form onSubmit={handleSubmit}>
					<div className='mb-4'>
						<input
							type='text'
							value={name}
							onChange={(e) => setName(e.target.value)}
							maxLength={NAME_MAX_LENGTH}
							className='px-input'
							placeholder={`Your name (${NAME_MAX_LENGTH} chars max)`}
							autoFocus
						/>
						<div className='text-xs text-[#a89878] mt-1 text-right'>
							{NAME_MAX_LENGTH - name.length} characters remaining
						</div>
					</div>

					<div className='flex justify-center'>
						<button
							type='submit'
							disabled={!name.trim()}
							className='px-btn'>
							Begin Your Journey
						</button>
					</div>
				</form>
		</PixelModal>
	);
};

export default NamePrompt;
