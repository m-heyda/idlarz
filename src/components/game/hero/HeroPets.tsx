import React from 'react';
import { LOCKED_PETS, petById } from '@/catalog/pets';
import { usePetStore } from '@/stores/petStore';
import '@/styles/Pets.css';

/** The size a pet is drawn at, in px (every card shows its pet 128 px tall, whatever the size of its sheet's frames) */
const SHOWN_PX = 128;

/** The first walking frame of a locked pet's sprite sheet, cut out with CSS and scaled to `SHOWN_PX` (greyed by the card). */
const Frame: React.FC<{ sheet: string; frameW: number; frameH: number; sheetW: number; sheetH: number }> = ({ sheet, frameW, frameH, sheetW, sheetH }) => {
	const scale = SHOWN_PX / frameH;
	return (
		<span
			className='px-pet-frame'
			role='img'
			aria-hidden='true'
			style={{ width: frameW * scale, height: SHOWN_PX, backgroundImage: `url(${sheet})`, backgroundSize: `${sheetW * scale}px ${sheetH * scale}px` }}
		/>
	);
};

/**
 * The Pets tab of the Hero window: the pets players will be able to unlock with achievements later are shown greyed with "Coming soon" (they only exist as pictures for now, nothing can be owned or bought), and a pet the account really owns is shown in colour
 * with its name. The special pet of one player (Yuki) is the server's grant (`usePetStore().owned`); for everyone else it does not show at all, not even as a locked card.
 */
const HeroPets: React.FC = () => {
	const owned = usePetStore((state) => state.owned);
	const mine = owned.map((id) => petById(id)).filter((pet) => pet !== undefined);
	return (
		<div className='px-pets'>
			<div className='px-pets-head'>
				<strong>Pets</strong>
				<span>Pets are coming. You will unlock them with achievements later.</span>
			</div>
			<div className='px-pets-grid'>
				{mine.map((pet) => (
					<div className='px-pet-card' data-owned='true' key={pet.id}>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img className='px-pet-icon' src={pet.icon} alt='' />
						<span className='px-pet-name'>{pet.name}</span>
						<span className='px-pet-note'>A gift for you. No effect yet.</span>
					</div>
				))}
				{LOCKED_PETS.map((pet) => (
					<div className='px-pet-card' data-owned='false' key={pet.id}>
						<Frame {...pet} />
						<span className='px-pet-name'>{pet.name}</span>
						<span className='px-pet-note'>Unlock with an achievement. Coming soon.</span>
					</div>
				))}
			</div>
		</div>
	);
};

export default HeroPets;
