import React, { useEffect, useRef, useState } from 'react';
import { petById } from '@/catalog/pets';
import { usePetStore } from '@/stores/petStore';
import { useUiStore } from '@/stores/uiStore';
import GameModal from '../GameModal';
import { Button } from '../../../../packages/design-system/src/components/primitives';

/**
 * The welcome letter of a special pet: asked from the server once the start of the game is done (`ready`), shown once after the welcome-back window, then never again.
 * The server decides who gets one (only the account the pet was granted to), and the text comes in its answer, so nobody else's browser ever holds it. Polish first, with a PL / EN switch that only changes this window.
 * Closing it (the button or the corner) tells the server it was read.
 */
const PetWelcomeDialog: React.FC<{ ready: boolean }> = ({ ready }) => {
	const offlineReportOpen = useUiStore((state) => state.offlineReport !== null);
	const letter = usePetStore((state) => state.letter);
	const [lang, setLang] = useState<'pl' | 'en'>('pl');
	const asked = useRef(false);

	useEffect(() => {
		if (!ready || asked.current) return;
		asked.current = true;
		void usePetStore.getState().sync();
	}, [ready]);

	if (!letter || offlineReportOpen) return null;
	const pet = petById(letter.petId);
	const text = letter[lang];
	const close = () => void usePetStore.getState().closeLetter(letter.petId);

	return (
		<GameModal title={text.title} size='md' onClose={close} closeOnBackdrop={false}>
			<div className='flex flex-col gap-4 px-1 pb-1' data-testid='pet-welcome'>
				<div className='flex justify-end gap-1' role='group' aria-label='Language'>
					{(['pl', 'en'] as const).map((code) => (
						<Button key={code} size='sm' tone={lang === code ? 'gold' : 'stone'} aria-pressed={lang === code} onClick={() => setLang(code)}>
							{code.toUpperCase()}
						</Button>
					))}
				</div>
				{pet && (
					<div className='flex justify-center'>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src={pet.icon} alt={pet.name} width={84} height={84} style={{ imageRendering: 'pixelated' }} />
					</div>
				)}
				<div className='flex flex-col gap-3 text-sm leading-relaxed text-[#d8c9a8]'>
					{text.body.map((paragraph) => (
						<p key={paragraph}>{paragraph}</p>
					))}
				</div>
				<div className='flex justify-center'>
					<Button onClick={close}>{text.button}</Button>
				</div>
			</div>
		</GameModal>
	);
};

export default PetWelcomeDialog;
