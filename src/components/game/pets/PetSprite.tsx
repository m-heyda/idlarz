import React, { useEffect, useRef, useState } from 'react';
import { petById } from '@/catalog/pets';
import {
	FIRST_SPEECH_MS,
	PET_STEP_PX,
	SPEECH_SHOW_MS,
	nextSpeechDelayMs,
	nextStepDelayMs,
	nextWanderStep,
	pickPetPhrase,
	startWander,
	type WanderPos,
} from '@/lib/pets';

/**
 * A pet walking around the castle, drawn inside the castle tile: it takes a short random step every 1.5 to 4 seconds (it stands still when the player asked for reduced motion), faces the way it walks, and now and then says a phrase in a speech bubble.
 * Cosmetic only; it never takes a click (`pointer-events: none`).
 */
const PetSprite: React.FC<{ petId: string }> = ({ petId }) => {
	const pet = petById(petId);
	const [pos, setPos] = useState<WanderPos>(startWander);
	const [said, setSaid] = useState<string | null>(null);
	const lastPhrase = useRef(-1);
	const speech = pet?.speech;

	useEffect(() => {
		if (!pet || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
		let timer: ReturnType<typeof setTimeout>;
		const step = () => {
			setPos((at) => nextWanderStep(at, Math.random));
			timer = setTimeout(step, nextStepDelayMs(Math.random));
		};
		timer = setTimeout(step, nextStepDelayMs(Math.random));
		return () => clearTimeout(timer);
	}, [pet]);

	useEffect(() => {
		if (!speech) return;
		let timer: ReturnType<typeof setTimeout>;
		const speak = () => {
			const index = pickPetPhrase(speech, lastPhrase.current, Math.random);
			if (index < 0) return;
			lastPhrase.current = index;
			setSaid(speech[index]);
			timer = setTimeout(() => {
				setSaid(null);
				timer = setTimeout(speak, nextSpeechDelayMs(Math.random));
			}, SPEECH_SHOW_MS);
		};
		timer = setTimeout(speak, FIRST_SPEECH_MS);
		return () => clearTimeout(timer);
	}, [speech]);

	if (!pet) return null;
	const mirrored = pos.facing !== pet.facing;
	return (
		<div
			className='absolute pointer-events-none z-[6]'
			style={{
				left: '50%',
				top: '50%',
				width: 40,
				height: 40,
				marginLeft: -20,
				marginTop: -4,
				transform: `translate(${pos.x * PET_STEP_PX}px, ${pos.y * PET_STEP_PX}px)`,
				transition: 'transform 1.2s ease-in-out',
			}}
			data-testid='pet-sprite'
		>
			{said && (
				<div
					className='absolute bottom-full left-1/2 mb-1 w-max max-w-[170px] -translate-x-1/2 border-2 border-[#2a1f10] bg-[#f4ead0] px-2 py-1 text-center text-[11px] leading-tight text-[#2a1f10]'
					role='status'
					data-testid='pet-speech'
				>
					{said}
				</div>
			)}
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src={pet.icon}
				alt={pet.name}
				width={40}
				height={40}
				draggable={false}
				style={{ imageRendering: 'pixelated', transform: mirrored ? 'scaleX(-1)' : undefined }}
			/>
		</div>
	);
};

export default PetSprite;
